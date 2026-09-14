import type { Metadata } from 'next'
import Link from 'next/link'
import { PageHeader, EmptyState } from '@/components/ui/page-header'
import { Card, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Alert } from '@/components/ui/alert'
import { requirePermission } from '@/lib/auth/session'
import { createClient } from '@/lib/supabase/server'
import { formatDateTime } from '@/lib/utils'

export const metadata: Metadata = { title: 'Recent Activity' }

const PAGE_SIZE = 60

const ACTION_TONE = {
  INSERT: 'success',
  UPDATE: 'info',
  DELETE: 'danger',
} as const

/** Table name → the screen where that record is managed. */
const TABLE_LABEL: Record<string, string> = {
  spks: 'SPK',
  spk_activities: 'Aktivitas',
  activity_progress: 'Progress aktivitas',
  daily_plans: 'Daily Plan',
  daily_progress: 'Daily Progress',
  designs: 'Desain',
  design_revisions: 'Tahap desain',
  spk_routing: 'Dokumen routing',
  routing_history: 'Tahap routing',
  contracts: 'Contract',
  opnames: 'Opname',
  pad: 'PAD',
  invoices: 'Invoice',
  payments: 'Payment',
  chart_of_accounts: 'Chart of Accounts',
  finance_transactions: 'Finance (RAB)',
  vendors: 'Vendor',
  vendor_teams: 'Team',
  vendor_members: 'Anggota team',
  users: 'User',
  roles: 'Role',
  role_permissions: 'Permission',
}

type AuditEntry = {
  id: number
  table_name: string
  record_id: string | null
  spk_id: string | null
  action: 'INSERT' | 'UPDATE' | 'DELETE'
  changed_by: string | null
  changed_at: string
  changed_fields: string[] | null
  before_data: Record<string, unknown> | null
  after_data: Record<string, unknown> | null
}

/** A row for the RAB month picker's "SPK terlibat" note — never actually an
 *  SPK-linked field the reader needs to see spelled out. */
const NOISE_FIELDS = new Set(['updated_at', 'updated_by', 'created_at'])

/** One human sentence per entry — what actually happened, in the terms the
 *  screen it happened on already uses, not a raw column diff. Falls back to
 *  a generic "X diubah" when the table isn't one of the common ones below. */
function describe(entry: AuditEntry): string | null {
  const fields = (entry.changed_fields ?? []).filter((f) => !NOISE_FIELDS.has(f))
  const after = entry.after_data ?? {}
  const before = entry.before_data ?? {}
  const tableLabel = TABLE_LABEL[entry.table_name] ?? entry.table_name

  if (entry.table_name === 'users' && fields.length === 0) return null // last_login_at only

  switch (entry.table_name) {
    case 'routing_history': {
      const step = (after.step_name as string | undefined) ?? 'tahap'
      if (fields.includes('status')) {
        const status = after.status as string
        if (status === 'Completed') return `${step} ditandai selesai`
        if (status === 'In Progress') return `${step} mulai dikerjakan`
        if (status === 'Returned') return `${step} dikembalikan untuk revisi`
        return `${step} → ${status}`
      }
      return entry.action === 'INSERT' ? `${step} ditambahkan ke routing` : null
    }
    case 'design_revisions': {
      const stage = (after.stage as string | undefined) ?? (before.stage as string | undefined) ?? 'tahap desain'
      if (entry.action === 'INSERT') return `desainnya masuk tahap "${stage}"`
      if (fields.includes('completed_at') && after.completed_at) return `tahap desain "${stage}" selesai`
      if (fields.includes('notes')) return `catatan tahap desain "${stage}" diperbarui`
      return `tahap desain "${stage}" diperbarui`
    }
    case 'designs':
      if (fields.includes('current_stage'))
        return `progresnya berubah dari "${before.current_stage ?? '—'}" ke "${after.current_stage}"`
      if (fields.includes('topo_data_received_at')) return 'tanggal data topografi masuk diisi'
      return null
    case 'spk_routing':
      if (fields.includes('status')) return `dokumen routing berubah dari ${before.status ?? '—'} ke ${after.status}`
      return null
    case 'spks':
      if (fields.includes('status')) return `statusnya berubah dari ${before.status ?? '—'} ke ${after.status}`
      if (fields.includes('terrain_survey_completed_at') && after.terrain_survey_completed_at && !before.terrain_survey_completed_at)
        return 'Survei Terestris ditandai selesai'
      if (fields.includes('joint_check_date')) return `tanggal Pengecekan Bersama diisi ${after.joint_check_date ?? '—'}`
      if (fields.includes('opname_marked_at') && after.opname_marked_at && !before.opname_marked_at)
        return 'opname ditandai selesai'
      if (fields.includes('pad_marked_at') && after.pad_marked_at && !before.pad_marked_at)
        return 'PAD ditandai'
      if (fields.includes('vendor_id')) return 'vendornya diubah'
      if (fields.includes('site_code')) return `kode lokasinya diubah ke ${after.site_code}`
      if (fields.includes('work_name')) return 'nama pekerjaannya diubah'
      if (entry.action === 'INSERT') return 'baru dibuat'
      if (fields.length === 0) return null
      return `datanya diperbarui (${fields.join(', ')})`
    case 'contracts':
    case 'invoices':
    case 'opnames':
    case 'pad':
      if (entry.action === 'INSERT') return `${tableLabel.toLowerCase()} baru dicatat`
      if (fields.includes('status')) return `${tableLabel.toLowerCase()} → ${after.status}`
      return `${tableLabel.toLowerCase()} diperbarui`
    default:
      if (fields.length === 0) return null
      return entry.action === 'INSERT'
        ? `${tableLabel} dibuat`
        : entry.action === 'DELETE'
          ? `${tableLabel} dihapus`
          : `${tableLabel} diperbarui`
  }
}

/**
 * Section 33 — the project's change feed, narrowed to what a person actually
 * did: trigger-driven cascades (changed_by null, e.g. a stage-refresh
 * touching a sibling row) never show up here even though they're real writes
 * — they're not a decision anyone made. The full trail, system rows
 * included, still lives at Audit Log.
 */
export default async function RecentActivityPage() {
  await requirePermission('audit_log', 'view')

  const supabase = await createClient()
  const { data: entries, error } = await supabase
    .from('audit_logs')
    .select('*')
    .not('changed_by', 'is', null)
    .order('changed_at', { ascending: false })
    .limit(PAGE_SIZE)

  const actorIds = [
    ...new Set((entries ?? []).map((e) => e.changed_by).filter(Boolean)),
  ] as string[]
  const spkIds = [
    ...new Set((entries ?? []).map((e) => e.spk_id).filter(Boolean)),
  ] as string[]

  const [{ data: actors }, { data: spks }] = await Promise.all([
    actorIds.length
      ? supabase.from('users').select('id, full_name').in('id', actorIds)
      : Promise.resolve({ data: [] }),
    spkIds.length
      ? supabase.from('spks').select('id, spk_number, site_code').in('id', spkIds)
      : Promise.resolve({ data: [] }),
  ])

  const actorName = new Map((actors ?? []).map((a) => [a.id, a.full_name]))
  const spkById = new Map((spks ?? []).map((s) => [s.id, s]))

  const rows = (entries ?? [])
    .map((row) => ({ entry: row as AuditEntry, description: describe(row as AuditEntry) }))
    .filter(
      (row): row is { entry: AuditEntry; description: string } => row.description !== null,
    )

  return (
    <>
      <PageHeader
        title="Recent Activity"
        description="Perubahan yang benar-benar dilakukan seseorang, terbaru dulu."
      />

      {error && (
        <Alert tone="danger" className="mb-4" title="Gagal memuat data">
          {error.message}
        </Alert>
      )}

      <Card className="overflow-hidden">
        <CardHeader>
          <div>
            <CardTitle>Perubahan terakhir</CardTitle>
            <CardDescription>Aksi sistem/trigger tidak ikut ditampilkan di sini.</CardDescription>
          </div>
          <Link
            href="/admin/audit-log"
            className="text-xs font-bold text-primary hover:underline"
          >
            Audit Log lengkap
          </Link>
        </CardHeader>

        {rows.length > 0 ? (
          <ul className="divide-y divide-slate-100">
            {rows.map(({ entry, description }) => {
              const spk = entry.spk_id ? spkById.get(entry.spk_id) : null
              return (
                <li key={entry.id} className="flex items-start gap-3 px-5 py-3.5">
                  <span className="grid h-8 w-8 shrink-0 place-items-center rounded-full bg-primary-soft text-xs font-extrabold text-primary">
                    {(spk?.site_code ?? spk?.spk_number ?? '#').slice(0, 1).toUpperCase()}
                  </span>
                  <div className="min-w-0 flex-1">
                    <p className="text-sm text-slate-700">
                      {spk && (
                        <>
                          SPK{' '}
                          <Link
                            href={`/spk/${spk.id}`}
                            className="font-bold text-primary hover:underline"
                          >
                            {spk.site_code ?? spk.spk_number}
                          </Link>{' '}
                        </>
                      )}
                      {spk ? description : description.charAt(0).toUpperCase() + description.slice(1)}
                    </p>
                    <div className="mt-1 flex items-center gap-2 text-xs text-muted-foreground">
                      <Badge tone={ACTION_TONE[entry.action]} className="py-0">
                        {entry.action}
                      </Badge>
                      <span>{actorName.get(entry.changed_by!) ?? 'Tidak dikenal'}</span>
                      <span className="tnum">· {formatDateTime(entry.changed_at)}</span>
                    </div>
                  </div>
                </li>
              )
            })}
          </ul>
        ) : (
          <EmptyState
            title="Belum ada perubahan tercatat"
            description="Entri muncul begitu ada yang mengubah data."
          />
        )}
      </Card>
    </>
  )
}
