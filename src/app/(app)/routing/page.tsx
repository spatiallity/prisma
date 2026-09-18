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
import { canStartRouting } from '@/lib/workflow-rules'
import { AddRoutingButton } from './forms'
import { RoutingTable } from './routing-table'
import { RoutingMatrix } from './routing-matrix'

export const metadata: Metadata = { title: 'Routing Monitor' }

type RoutingSummaryStep = {
  id: string
  name: string
  sequence: number
  sourceName: string
  kind: 'stage' | 'ongoing' | 'completed'
}

/**
 * Section 23/24 — where every document sits and how long it has been there.
 * `mode` narrows the same table: the Section 7 submenu entries are views of
 * this page, not separate screens.
 */
export async function RoutingMonitor({
  mode = 'open',
  step,
  open,
  invoiced = false,
}: {
  mode?: 'open' | 'history'
  /** Narrows the open list to documents currently sitting at this step —
   *  set by clicking one of the summary cards. */
  step?: string
  /** Routing document opened immediately after Add Data succeeds. */
  open?: string
  /** Shows documents whose invoice event has been recorded. */
  invoiced?: boolean
}) {
  const user = await requirePermission('routing', 'view')
  const mayEdit = can(user.permissions, 'routing', 'edit')

  const supabase = await createClient()

  const [{ data: documents, error }, { data: lead }, { data: spks }, { data: templates }] =
    await Promise.all([
      supabase.from('spk_routing').select('*').order('created_at', { ascending: false }),
      supabase.from('v_routing_lead_time').select('*'),
      supabase
        .from('spks')
        .select(
          'id, spk_number, site_code, work_name, work_type, location_type, status, opname_marked_at, opname_value, pad_marked_at, pad_value, denda_value',
        )
        .order('spk_number'),
      supabase.from('routing_templates').select('id').eq('status', 'Active').order('code'),
    ])

  const spkById = Object.fromEntries((spks ?? []).map((s) => [s.id, s]))
  const opnameBySpk = Object.fromEntries((spks ?? []).map((s) => [s.id, s.opname_marked_at]))
  const opnameValueBySpk = Object.fromEntries((spks ?? []).map((s) => [s.id, s.opname_value]))
  const padBySpk = Object.fromEntries((spks ?? []).map((s) => [s.id, s.pad_marked_at]))
  const padValueBySpk = Object.fromEntries((spks ?? []).map((s) => [s.id, s.pad_value]))
  const dendaValueBySpk = Object.fromEntries((spks ?? []).map((s) => [s.id, s.denda_value]))

  // An SPK with PAD and no spk_routing row sits in document preparation.
  const routedSpkIds = new Set((documents ?? []).map((d) => d.spk_id))
  const virtualSpkIds = (spks ?? []).filter(
    (spk) =>
      !routedSpkIds.has(spk.id) &&
      // Existing PAD-only SPKs remain visible as document preparation. New
      // SPKs enter the monitor through Add Data or finalisasi automation.
      Boolean(spk.pad_marked_at) &&
      canStartRouting(spk),
  )
    .map((spk) => spk.id)

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

  const filtered = (documents ?? [])
    .filter((doc) => {
      if (mode === 'history') return doc.status === 'Completed' || doc.status === 'Rejected'
      if (doc.status === 'Rejected') return false
      if (invoiced) return doc.status === 'Completed'
      if (step && currentByDoc.get(doc.id)?.step_name !== step) return false
      return true
    })
    // Invoiced documents still belong here (Opname through Invoiced is one
    // continuous view now), but sink to the bottom — they're done, not what
    // needs attention.
    .sort((a, b) => (a.status === 'Completed' ? 1 : 0) - (b.status === 'Completed' ? 1 : 0))

  const overdueCount = filtered.filter((doc) => overdueByDoc.get(doc.id)).length
  const summaryDocIds = new Set(
    (documents ?? [])
      .filter((doc) => doc.status !== 'Rejected')
      .map((doc) => doc.id),
  )
  const currentBySummaryDoc = Object.fromEntries(
    Object.entries(currentByDocPlain).filter(([docId]) => summaryDocIds.has(docId)),
  )

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
      : 'Posisi setiap dokumen invoice dan tahap yang sedang berjalan.'

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
                .filter((s) => !routedSpkIds.has(s.id))
                .filter((s) => canStartRouting(s))
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
          currentByDoc={currentBySummaryDoc}
          activeStep={step}
          activeInvoiced={invoiced}
          completedInvoicedCount={(documents ?? []).filter((doc) => doc.status === 'Completed').length}
          totalDocumentCount={(documents ?? []).filter((doc) => doc.status !== 'Rejected').length}
        />
      )}

      <Card className="mb-5 overflow-hidden">
        <CardHeader>
          <div>
            <CardTitle>{filtered.length} dokumen</CardTitle>
            {(step || invoiced) && (
              <CardDescription>
                Difilter ke <strong className="text-slate-700">{invoiced ? 'Invoiced' : step}</strong> —{' '}
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
                : 'Buat dokumen invoice agar posisinya bisa dipantau.'
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
            opnameValueBySpk={opnameValueBySpk}
            padBySpk={padBySpk}
            padValueBySpk={padValueBySpk}
            dendaValueBySpk={dendaValueBySpk}
            virtualSpkIds={step ? [] : virtualSpkIds}
            stepFilter={step}
            initialOpenRowId={open}
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
  activeInvoiced,
  completedInvoicedCount,
  totalDocumentCount,
}: {
  templateId: string | null
  currentByDoc: Record<string, RoutingLeadTimeView>
  activeStep?: string
  activeInvoiced: boolean
  completedInvoicedCount: number
  totalDocumentCount: number
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

  // Invoice remains a single matrix column. Its open and completed states are
  // deliberately shown as two summary cards so the work still in progress is
  // visible at a glance.
  const invoiceTemplateStep = (steps ?? []).find((step) => step.name === 'Invoiced')
  const visibleSteps: RoutingSummaryStep[] = [
    ...(steps ?? [])
      .filter((step) => step.name !== 'Invoiced')
      .map((step) => ({ ...step, sourceName: step.name, kind: 'stage' as const })),
    {
      id: `${invoiceTemplateStep?.id ?? 'invoice'}-invoicing`,
      name: 'Invoicing',
      sequence: invoiceTemplateStep?.sequence ?? Number.MAX_SAFE_INTEGER - 1,
      sourceName: 'Invoiced',
      kind: 'ongoing',
    },
    {
      id: invoiceTemplateStep?.id ?? 'invoice-invoiced',
      name: 'Invoiced',
      sequence: invoiceTemplateStep?.sequence ?? Number.MAX_SAFE_INTEGER,
      sourceName: 'Invoiced',
      kind: 'completed',
    },
  ]
  if (visibleSteps.length === 0) return null

  const totalOpen = Object.keys(currentByDoc).length
  const maxCount = Math.max(
    1,
    completedInvoicedCount,
    ...visibleSteps.map((step) => countByStep.get(step.sourceName) ?? 0),
  )
  const accents = [
    'from-primary/80 to-primary',
    'from-info/80 to-info',
    'from-warning/80 to-warning',
    'from-brand-orange/75 to-brand-orange',
    'from-success/75 to-success',
    'from-brand-navy/75 to-brand-navy',
  ]

  return (
    <div className="mb-5 grid grid-cols-2 gap-3 sm:grid-cols-3 xl:grid-cols-4 2xl:grid-cols-8">
      {visibleSteps.map((step, index) => {
        const isInvoiced = step.kind === 'completed'
        const active = isInvoiced ? activeInvoiced : activeStep === step.sourceName
        const count = isInvoiced ? completedInvoicedCount : countByStep.get(step.sourceName) ?? 0
        const percentOfMax = Math.max(4, Math.round((count / maxCount) * 100))
        const denominator = isInvoiced ? totalDocumentCount : totalOpen
        const percentOfTotal = denominator > 0 ? Math.round((count / denominator) * 100) : 0
        const href = active
          ? '/routing'
          : isInvoiced
            ? '/routing?invoiced=1'
            : `/routing?step=${encodeURIComponent(step.sourceName)}`
        return (
          <Link
            key={step.id}
            href={href}
            className={cn(
              'group block overflow-hidden rounded-lg border bg-surface p-4 shadow-sm transition-all hover:-translate-y-0.5 hover:shadow-md',
              active
                ? 'border-primary bg-primary-soft ring-1 ring-primary/20'
                : 'border-slate-200 hover:border-primary/40',
            )}
          >
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <div className="truncate text-[11px] font-extrabold tracking-wider text-slate-500 uppercase">
                  {step.name}
                </div>
                <div className="mt-1 text-xs font-semibold text-muted-foreground">
                  {count > 0
                    ? `${percentOfTotal}% dari ${isInvoiced ? 'seluruh dokumen' : 'dokumen aktif'}`
                    : 'Tidak ada dokumen'}
                </div>
              </div>
              <div className="tnum shrink-0 text-2xl font-black text-slate-900">
                {count}
              </div>
            </div>
            <div className="mt-4 h-1.5 overflow-hidden rounded-full bg-slate-100">
              <div
                className={cn(
                  'h-full rounded-full bg-gradient-to-r transition-all',
                  count === 0 ? 'from-slate-200 to-slate-200' : accents[index % accents.length],
                )}
                style={{ width: `${percentOfMax}%` }}
              />
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
  invoice_number: string | null
  invoice_value: number | null
  invoice_date: string | null
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
  opnameValueBySpk,
  padBySpk,
  padValueBySpk,
  dendaValueBySpk,
  virtualSpkIds,
  stepFilter,
  initialOpenRowId,
}: {
  docs: RoutingDoc[]
  spkById: Record<string, { id: string; spk_number: string; site_code: string | null; work_name?: string }>
  templateId: string | null
  currentByDoc: Record<string, RoutingLeadTimeView>
  overdueByDoc: Record<string, boolean>
  mayEdit: boolean
  opnameBySpk: Record<string, string | null>
  opnameValueBySpk: Record<string, number | null>
  padBySpk: Record<string, string | null>
  padValueBySpk: Record<string, number | null>
  dendaValueBySpk: Record<string, number | null>
  /** SPKs eligible for routing (Finalisasi Desain opened) with no spk_routing
   *  row yet — shown as placeholder rows so they aren't invisible while
   *  waiting to be routed. */
  virtualSpkIds: string[]
  /** The `?step=` filter currently active — passed through so RoutingMatrix
   *  can close any open row popup when it changes. */
  stepFilter?: string
  initialOpenRowId?: string
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
          .select(
            'id, spk_routing_id, sequence, status, started_at, completed_at, pic_name, note, invoice_number, invoice_value, invoice_date',
          )
          .in('spk_routing_id', docIds)
      : Promise.resolve({ data: [] }),
  ])

  const historyByDoc: Record<string, Record<number, HistoryCell>> = {}
  for (const row of history ?? []) {
    ;(historyByDoc[row.spk_routing_id] ??= {})[row.sequence] = row
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

  const visibleSteps = steps ?? []

  return (
    <RoutingMatrix
      docs={docs}
      virtualSpkIds={virtualSpkIds}
      spkById={spkById}
      steps={visibleSteps}
      historyByDoc={historyByDoc}
      revisionsByStep={revisionsByStep}
      currentSequenceByDoc={currentSequenceByDoc}
      overdueByDoc={overdueByDoc}
      mayEdit={mayEdit}
      opnameBySpk={opnameBySpk}
      opnameValueBySpk={opnameValueBySpk}
      padBySpk={padBySpk}
      padValueBySpk={padValueBySpk}
      dendaValueBySpk={dendaValueBySpk}
      stepFilter={stepFilter}
      initialOpenRowId={initialOpenRowId}
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
  searchParams: Promise<{ step?: string; open?: string; invoiced?: string }>
}) {
  const { step, open, invoiced } = await searchParams
  return <RoutingMonitor mode="open" step={step} open={open} invoiced={invoiced === '1'} />
}
