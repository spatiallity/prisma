import type { Metadata } from 'next'
import Link from 'next/link'
import { PageHeader, EmptyState } from '@/components/ui/page-header'
import { Card, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Table, Td, Th, Tr } from '@/components/ui/table'
import { Badge } from '@/components/ui/badge'
import { Alert } from '@/components/ui/alert'
import { requirePermission } from '@/lib/auth/session'
import { createClient } from '@/lib/supabase/server'
import { can } from '@/lib/auth/permissions'
import { cn } from '@/lib/utils'
import type { Database, RoutingLeadTimeView } from '@/lib/supabase/types'
import { formatDays } from '@/lib/routing'
import { AddRoutingButton } from './forms'
import { RoutingTable } from './routing-table'
import { RoutingMatrix } from './routing-matrix'

export const metadata: Metadata = { title: 'Routing Monitor' }

/**
 * Section 23/24 — where every document sits and how long it has been there.
 * `mode` narrows the same table: the Section 7 submenu entries are views of
 * this page, not separate screens.
 */
export async function RoutingMonitor({
  mode = 'open',
  step,
}: {
  mode?: 'open' | 'history'
  /** Narrows the open list to documents currently sitting at this step —
   *  set by clicking one of the summary cards. */
  step?: string
}) {
  const user = await requirePermission('routing', 'view')
  const mayEdit = can(user.permissions, 'routing', 'edit')

  const supabase = await createClient()

  const [{ data: documents, error }, { data: lead }, { data: spks }, { data: templates }, { data: finalisasiDesigns }] =
    await Promise.all([
      supabase.from('spk_routing').select('*').order('created_at', { ascending: false }),
      supabase.from('v_routing_lead_time').select('*'),
      supabase
        .from('spks')
        .select('id, spk_number, site_code, work_name, status, opname_marked_at')
        .order('spk_number'),
      supabase.from('routing_templates').select('id').eq('status', 'Active').order('code'),
      // Finalisasi Desain opens (any stage) once Desain Siteplan hits Finish —
      // that's the "eligible for routing" signal, whether or not it's routed yet.
      supabase.from('designs').select('spk_id').eq('phase', 'finalisasi').eq('status', 'Active'),
    ])

  const spkById = Object.fromEntries((spks ?? []).map((s) => [s.id, s]))
  const opnameBySpk = Object.fromEntries((spks ?? []).map((s) => [s.id, s.opname_marked_at]))

  // Section 27 — an SPK ready for routing but not yet routed (no spk_routing
  // row) still needs to show up as "Drafting Invoice: Not Yet" so it isn't
  // invisible while sitting between Desain and routing.
  const routedSpkIds = new Set((documents ?? []).map((d) => d.spk_id))
  const virtualSpkIds = [...new Set((finalisasiDesigns ?? []).map((d) => d.spk_id))].filter(
    (spkId) => !routedSpkIds.has(spkId),
  )

  // The stage a document is actually sitting in: the first one not finished.
  const currentByDoc = new Map<string, RoutingLeadTimeView>()
  const overdueByDoc = new Map<string, boolean>()
  for (const row of lead ?? []) {
    if (row.is_overdue && row.status !== 'Completed') overdueByDoc.set(row.spk_routing_id, true)
    if (row.status === 'Completed') continue
    const held = currentByDoc.get(row.spk_routing_id)
    if (!held || row.sequence < held.sequence) currentByDoc.set(row.spk_routing_id, row)
  }
  const currentByDocPlain = Object.fromEntries(currentByDoc)

  const defaultTemplateId = templates?.[0]?.id ?? null

  const filtered = (documents ?? []).filter((doc) => {
    if (mode === 'history') return doc.status === 'Completed' || doc.status === 'Rejected'
    if (doc.status === 'Completed' || doc.status === 'Rejected') return false
    if (step && currentByDoc.get(doc.id)?.step_name !== step) return false
    return true
  })

  const overdueCount = filtered.filter((doc) => overdueByDoc.get(doc.id)).length

  // History's table still shows PIC + revision count per current-at-the-time
  // step — only needed here, the matrix shows every step's own state instead.
  let picByStage: Record<string, string | null> = {}
  const revisionCountByStep: Record<string, number> = {}
  if (mode === 'history') {
    const { data: stages } = await supabase.from('routing_history').select('id, pic_name')
    picByStage = Object.fromEntries((stages ?? []).map((s) => [s.id, s.pic_name]))

    const currentStepIds = [...currentByDoc.values()].map((v) => v.routing_history_id)
    const { data: revisions } = currentStepIds.length
      ? await supabase
          .from('routing_step_revisions')
          .select('routing_history_id')
          .in('routing_history_id', currentStepIds)
      : { data: [] }
    for (const r of revisions ?? []) {
      revisionCountByStep[r.routing_history_id] = (revisionCountByStep[r.routing_history_id] ?? 0) + 1
    }
  }

  const title = mode === 'history' ? 'Routing History' : 'Routing Monitor'
  const description =
    mode === 'history'
      ? 'Dokumen yang sudah selesai atau ditolak, beserta lead time totalnya.'
      : 'Posisi setiap dokumen dan berapa lama tertahan di tahap sekarang.'

  return (
    <>
      <PageHeader
        title={title}
        description={description}
        actions={
          mode === 'open' &&
          mayEdit && (
            <AddRoutingButton
              spks={(spks ?? [])
                .filter((s) => s.status === 'Draft' || s.status === 'On Going')
                .map((s) => ({ id: s.id, label: `${s.spk_number} — ${s.work_name}` }))}
              templateId={defaultTemplateId}
            />
          )
        }
      />

      {error && (
        <Alert tone="danger" className="mb-4" title="Gagal memuat data">
          {error.message}
        </Alert>
      )}

      {mode === 'open' && (
        <StepSummaryCards
          templateId={defaultTemplateId}
          currentByDoc={currentByDocPlain}
          activeStep={step}
        />
      )}

      <Card className="mb-5 overflow-hidden">
        <CardHeader>
          <div>
            <CardTitle>{filtered.length} dokumen</CardTitle>
            {step && (
              <CardDescription>
                Difilter ke tahap <strong className="text-slate-700">{step}</strong> —{' '}
                <Link href="/routing" className="font-bold text-primary hover:underline">
                  hapus filter
                </Link>
              </CardDescription>
            )}
          </div>
          {overdueCount > 0 && (
            <Badge tone="danger">{overdueCount} lewat SLA</Badge>
          )}
        </CardHeader>

        {filtered.length === 0 ? (
          <EmptyState
            title={
              mode === 'history'
                ? 'Belum ada dokumen selesai'
                : 'Tidak ada dokumen berjalan'
            }
            description={
              mode === 'history'
                ? 'Dokumen akan muncul di sini setelah tahap terakhirnya selesai.'
                : 'Rutekan dokumen agar posisinya bisa dipantau.'
            }
          />
        ) : mode === 'open' ? (
          <RoutingMatrixSection
            docs={filtered}
            spkById={spkById}
            templateId={defaultTemplateId}
            currentByDoc={currentByDocPlain}
            overdueByDoc={Object.fromEntries(overdueByDoc)}
            mayEdit={mayEdit}
            opnameBySpk={opnameBySpk}
            virtualSpkIds={step ? [] : virtualSpkIds}
          />
        ) : (
          <RoutingTable
            docs={filtered}
            spkById={spkById}
            currentByDoc={currentByDocPlain}
            picByStage={picByStage}
            revisionCountByStep={revisionCountByStep}
            mode={mode}
          />
        )}
      </Card>

      {mode === 'history' && <StageAverages />}
    </>
  )
}

/** Section 6-column overview — how many open documents are sitting at each
 *  step right now. Same shape as the matrix's own columns, so the two never
 *  disagree about what a "step" is. */
async function StepSummaryCards({
  templateId,
  currentByDoc,
  activeStep,
}: {
  templateId: string | null
  currentByDoc: Record<string, RoutingLeadTimeView>
  activeStep?: string
}) {
  const supabase = await createClient()
  const { data: steps } = templateId
    ? await supabase
        .from('routing_template_steps')
        .select('id, name, sequence')
        .eq('template_id', templateId)
        .order('sequence')
    : { data: [] }

  const countByStep = new Map<string, number>()
  for (const current of Object.values(currentByDoc)) {
    countByStep.set(current.step_name, (countByStep.get(current.step_name) ?? 0) + 1)
  }

  if (!steps || steps.length === 0) return null

  return (
    <div className="mb-5 grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
      {steps.map((step) => {
        const active = activeStep === step.name
        return (
          <Link
            key={step.id}
            href={active ? '/routing' : `/routing?step=${encodeURIComponent(step.name)}`}
            className={cn(
              'block rounded-xl border p-4 transition-colors',
              active
                ? 'border-primary bg-primary-soft'
                : 'border-slate-200 bg-surface hover:border-primary/40',
            )}
          >
            <div className="truncate text-[11px] font-extrabold tracking-wider text-slate-500 uppercase">
              {step.name}
            </div>
            <div className="tnum mt-1 text-2xl font-black text-slate-900">
              {countByStep.get(step.name) ?? 0}
            </div>
          </Link>
        )
      })}
    </div>
  )
}

type RoutingDoc = Database['public']['Tables']['spk_routing']['Row']
type HistoryCell = {
  id: string
  status: Database['public']['Tables']['routing_history']['Row']['status']
  started_at: string | null
  completed_at: string | null
  pic_name: string | null
  note: string | null
}

/** Fetches the full step history for the filtered docs and shapes it into
 *  the matrix's per-doc, per-sequence lookup. */
async function RoutingMatrixSection({
  docs,
  spkById,
  templateId,
  currentByDoc,
  overdueByDoc,
  mayEdit,
  opnameBySpk,
  virtualSpkIds,
}: {
  docs: RoutingDoc[]
  spkById: Record<string, { id: string; spk_number: string; site_code: string | null; work_name?: string }>
  templateId: string | null
  currentByDoc: Record<string, RoutingLeadTimeView>
  overdueByDoc: Record<string, boolean>
  mayEdit: boolean
  opnameBySpk: Record<string, string | null>
  /** SPKs eligible for routing (Finalisasi Desain opened) with no spk_routing
   *  row yet — shown as placeholder rows so they aren't invisible while
   *  waiting to be routed. */
  virtualSpkIds: string[]
}) {
  const supabase = await createClient()
  const docIds = docs.map((d) => d.id)

  const [{ data: steps }, { data: history }] = await Promise.all([
    templateId
      ? supabase
          .from('routing_template_steps')
          .select('id, name, sequence')
          .eq('template_id', templateId)
          .order('sequence')
      : Promise.resolve({ data: [] }),
    docIds.length
      ? supabase
          .from('routing_history')
          .select('id, spk_routing_id, sequence, status, started_at, completed_at, pic_name, note')
          .in('spk_routing_id', docIds)
      : Promise.resolve({ data: [] }),
  ])

  const historyByDoc: Record<string, Record<number, HistoryCell>> = {}
  for (const row of history ?? []) {
    ;(historyByDoc[row.spk_routing_id] ??= {})[row.sequence] = row
  }

  // "Drafting invoice" is done once the document has entered Document
  // Control (sequence 1) — that's the moment the invoice starts its routing.
  const invoiceDraftedBySpk: Record<string, boolean> = {}
  for (const doc of docs) {
    invoiceDraftedBySpk[doc.spk_id] = !!historyByDoc[doc.id]?.[1]
  }

  const stepIds = (history ?? []).map((h) => h.id)
  const { data: revisions } = stepIds.length
    ? await supabase
        .from('routing_step_revisions')
        .select('id, routing_history_id, note, resubmit_at')
        .in('routing_history_id', stepIds)
        .order('created_at')
    : { data: [] }
  const revisionsByStep: Record<string, { id: string; note: string | null; resubmit_at: string }[]> = {}
  for (const r of revisions ?? []) {
    ;(revisionsByStep[r.routing_history_id] ??= []).push(r)
  }

  const currentSequenceByDoc = Object.fromEntries(
    Object.entries(currentByDoc).map(([docId, current]) => [docId, current.sequence]),
  )

  return (
    <RoutingMatrix
      docs={docs}
      virtualSpkIds={virtualSpkIds}
      spkById={spkById}
      steps={steps ?? []}
      historyByDoc={historyByDoc}
      revisionsByStep={revisionsByStep}
      currentSequenceByDoc={currentSequenceByDoc}
      overdueByDoc={overdueByDoc}
      mayEdit={mayEdit}
      invoiceDraftedBySpk={invoiceDraftedBySpk}
      opnameBySpk={opnameBySpk}
    />
  )
}

/** Section 24 — how long each stage takes on average, across all documents. */
async function StageAverages() {
  const supabase = await createClient()
  const { data: rows } = await supabase
    .from('v_routing_stage_average')
    .select('*')
    .order('avg_duration_days', { ascending: false })

  if (!rows || rows.length === 0) return null

  return (
    <Card className="overflow-hidden">
      <CardHeader>
        <CardTitle>Rata-rata lead time per tahap</CardTitle>
      </CardHeader>
      <Table>
        <thead>
          <tr>
            <Th>Tahap</Th>
            <Th className="text-right">Selesai</Th>
            <Th className="text-right">Rata-rata</Th>
            <Th className="text-right">Terlama</Th>
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => (
            <Tr key={row.step_name}>
              <Td className="font-bold text-slate-900">{row.step_name}</Td>
              <Td className="tnum text-right">{row.completed_count}</Td>
              <Td className="tnum text-right font-bold">
                {formatDays(row.avg_duration_days)}
              </Td>
              <Td className="tnum text-right text-muted-foreground">
                {formatDays(row.max_duration_days)}
              </Td>
            </Tr>
          ))}
        </tbody>
      </Table>
    </Card>
  )
}

export default async function RoutingPage({
  searchParams,
}: {
  searchParams: Promise<{ step?: string }>
}) {
  const { step } = await searchParams
  return <RoutingMonitor mode="open" step={step} />
}
