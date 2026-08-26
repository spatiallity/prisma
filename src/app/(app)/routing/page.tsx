import type { Metadata } from 'next'
import Link from 'next/link'
import { PageHeader, EmptyState } from '@/components/ui/page-header'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Table, Td, Th, Tr } from '@/components/ui/table'
import { Badge } from '@/components/ui/badge'
import { Alert } from '@/components/ui/alert'
import { requirePermission } from '@/lib/auth/session'
import { createClient } from '@/lib/supabase/server'
import { can } from '@/lib/auth/permissions'
import { cn } from '@/lib/utils'
import type { RoutingLeadTimeView } from '@/lib/supabase/types'
import { ROUTING_TONE, formatDays } from '@/lib/routing'
import { NewRoutingForm } from './forms'

export const metadata: Metadata = { title: 'Routing Monitor' }

/**
 * Section 23/24 — where every document sits and how long it has been there.
 * `mode` narrows the same table: the Section 7 submenu entries are views of
 * this page, not separate screens.
 */
export async function RoutingMonitor({
  mode = 'open',
}: {
  mode?: 'open' | 'pending' | 'history'
}) {
  const user = await requirePermission('routing', 'view')
  const mayEdit = can(user.permissions, 'routing', 'edit')

  const supabase = await createClient()

  const [{ data: documents, error }, { data: lead }, { data: stages }, { data: spks }, { data: templates }] =
    await Promise.all([
      supabase.from('spk_routing').select('*').order('created_at', { ascending: false }),
      supabase.from('v_routing_lead_time').select('*'),
      supabase.from('routing_history').select('id, pic_name'),
      supabase
        .from('spks')
        .select('id, spk_number, site_code, work_name, status')
        .order('spk_number'),
      supabase
        .from('routing_templates')
        .select('id, name, code')
        .eq('status', 'Active')
        .order('code'),
    ])

  const spkById = new Map((spks ?? []).map((s) => [s.id, s]))
  const picByStage = new Map((stages ?? []).map((s) => [s.id, s.pic_name]))

  // The stage a document is actually sitting in: the first one not finished.
  const currentByDoc = new Map<string, RoutingLeadTimeView>()
  const overdueByDoc = new Map<string, boolean>()
  for (const row of lead ?? []) {
    if (row.is_overdue && row.status !== 'Completed') overdueByDoc.set(row.spk_routing_id, true)
    if (row.status === 'Completed') continue
    const held = currentByDoc.get(row.spk_routing_id)
    if (!held || row.sequence < held.sequence) currentByDoc.set(row.spk_routing_id, row)
  }

  const filtered = (documents ?? []).filter((doc) => {
    if (mode === 'history') return doc.status === 'Completed' || doc.status === 'Rejected'
    if (mode === 'pending') {
      const current = currentByDoc.get(doc.id)
      return doc.status !== 'Completed' && doc.status !== 'Rejected' && !!current
    }
    return doc.status !== 'Completed' && doc.status !== 'Rejected'
  })

  const overdueCount = filtered.filter((doc) => overdueByDoc.get(doc.id)).length

  const title =
    mode === 'pending'
      ? 'Pending Approval'
      : mode === 'history'
        ? 'Routing History'
        : 'Routing Monitor'

  const description =
    mode === 'pending'
      ? 'Dokumen yang sedang menunggu tindakan pada satu tahap.'
      : mode === 'history'
        ? 'Dokumen yang sudah selesai atau ditolak, beserta lead time totalnya.'
        : 'Posisi setiap dokumen dan berapa lama tertahan di tahap sekarang (Section 24).'

  return (
    <>
      <PageHeader title={title} description={description} />

      {error && (
        <Alert tone="danger" className="mb-4" title="Gagal memuat data">
          {error.message}
        </Alert>
      )}

      <Card className="mb-5 overflow-hidden">
        <CardHeader>
          <div>
            <CardTitle>{filtered.length} dokumen</CardTitle>
            <CardDescription>
              Merah berarti tahap sekarang sudah melewati SLA-nya.
            </CardDescription>
          </div>
          {overdueCount > 0 && (
            <Badge tone="danger">{overdueCount} lewat SLA</Badge>
          )}
        </CardHeader>

        {filtered.length > 0 ? (
          <Table>
            <thead>
              <tr>
                <Th>SPK</Th>
                <Th>Dokumen</Th>
                <Th>{mode === 'history' ? 'Tahap terakhir' : 'Posisi sekarang'}</Th>
                <Th>PIC</Th>
                <Th className="text-right">Di tahap ini</Th>
                <Th className="text-right">SLA</Th>
                <Th>Status</Th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((doc) => {
                const spk = spkById.get(doc.spk_id)
                const current = currentByDoc.get(doc.id)
                const late = current?.is_overdue ?? false

                return (
                  <Tr key={doc.id}>
                    <Td>
                      <Link
                        href={`/routing/${doc.id}`}
                        className="font-bold text-primary hover:underline"
                      >
                        {spk?.site_code ?? spk?.spk_number ?? 'SPK'}
                      </Link>
                    </Td>
                    <Td>
                      <span className="font-bold text-slate-900">{doc.document_type}</span>
                      {doc.document_number && (
                        <div className="text-xs text-muted-foreground">
                          {doc.document_number}
                        </div>
                      )}
                    </Td>
                    <Td className="text-muted-foreground">
                      {current?.step_name ?? (doc.status === 'Completed' ? 'Selesai' : '—')}
                    </Td>
                    <Td className="text-muted-foreground">
                      {current
                        ? (picByStage.get(current.routing_history_id) ?? '—')
                        : '—'}
                    </Td>
                    <Td className={cn('tnum text-right', late && 'font-bold text-danger')}>
                      {formatDays(current?.elapsed_days ?? null)}
                    </Td>
                    <Td className="tnum text-right text-muted-foreground">
                      {formatDays(current?.sla_days ?? null)}
                    </Td>
                    <Td>
                      <Badge tone={late ? 'danger' : ROUTING_TONE[doc.status]}>
                        {late ? 'Lewat SLA' : doc.status}
                      </Badge>
                    </Td>
                  </Tr>
                )
              })}
            </tbody>
          </Table>
        ) : (
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
        )}
      </Card>

      {mode === 'history' && <StageAverages />}

      {mode === 'open' && mayEdit && (
        <Card>
          <CardHeader>
            <div>
              <CardTitle>Rutekan dokumen</CardTitle>
              <CardDescription>
                Seluruh tahap template dibuat sekaligus; hanya tahap pertama yang
                langsung berjalan.
              </CardDescription>
            </div>
          </CardHeader>
          <CardContent>
            <NewRoutingForm
              spks={(spks ?? [])
                .filter((s) => s.status === 'Draft' || s.status === 'On Going')
                .map((s) => ({ id: s.id, label: `${s.spk_number} — ${s.work_name}` }))}
              templates={(templates ?? []).map((t) => ({
                id: t.id,
                label: `${t.name} (${t.code})`,
              }))}
            />
          </CardContent>
        </Card>
      )}
    </>
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
        <div>
          <CardTitle>Rata-rata lead time per tahap</CardTitle>
          <CardDescription>
            Dihitung dari tahap yang sudah selesai — bahan untuk menyepakati SLA.
          </CardDescription>
        </div>
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

export default async function RoutingPage() {
  return <RoutingMonitor mode="open" />
}
