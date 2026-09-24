import type { Metadata } from 'next'
import Link from 'next/link'
import { PageHeader, EmptyState } from '@/components/ui/page-header'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Alert } from '@/components/ui/alert'
import { requirePermission } from '@/lib/auth/session'
import { createClient } from '@/lib/supabase/server'
import { formatDate, formatDateTime, formatRupiah } from '@/lib/utils'

export const metadata: Metadata = { title: 'Recent Activity' }

const PAGE_SIZE = 120
const FEED_SIZE = 60

const ACTION_TONE = {
  INSERT: 'success',
  UPDATE: 'info',
  DELETE: 'danger',
} as const
const ACTION_LABEL = { INSERT: 'Dibuat', UPDATE: 'Diubah', DELETE: 'Dihapus' } as const

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

const NOISE_FIELDS = new Set(['updated_at', 'updated_by', 'created_at'])

const FIELD_LABEL: Record<string, string> = {
  spk_number: 'nomor SPK', site_code: 'kode lokasi', work_name: 'nama pekerjaan',
  contract_value: 'nilai SPK', start_date: 'tanggal mulai', end_date: 'tanggal selesai',
  vendor_id: 'vendor', status: 'status', started_at: 'tanggal mulai',
  completed_at: 'tanggal selesai', pic_id: 'PIC', pic_name: 'PIC',
  pic_pertamina: 'PIC Pertamina', notes: 'catatan', note: 'catatan',
  invoice_number: 'nomor invoice', invoice_value: 'nilai invoice',
  invoice_date: 'tanggal invoice',
}

function details(fields: string[]) {
  return fields.map((field) => FIELD_LABEL[field] ?? field.replaceAll('_', ' ')).join(', ')
}

function snapshot(entry: AuditEntry) {
  return (entry.after_data ?? entry.before_data ?? {}) as Record<string, unknown>
}

function identifier(value: unknown): string | null {
  return typeof value === 'string' && value.length > 0 ? value : null
}

/** One human sentence per entry — what actually happened, in the terms the
 *  screen it happened on already uses, not a raw column diff. Falls back to
 *  a generic "X diubah" when the table isn't one of the common ones below. */
function describe(entry: AuditEntry): string | null {
  const fields = (entry.changed_fields ?? []).filter((f) => !NOISE_FIELDS.has(f))
  const after = entry.after_data ?? {}
  const before = entry.before_data ?? {}
  const tableLabel = TABLE_LABEL[entry.table_name] ?? entry.table_name

  if (entry.table_name === 'users' && entry.action === 'UPDATE' && fields.every((field) => field === 'last_login_at')) return null
  if (entry.action === 'DELETE') {
    if (entry.table_name === 'design_revisions') return `Tahap desain "${before.stage ?? 'tidak diketahui'}" dihapus.`
    if (entry.table_name === 'routing_history') return `Tahap routing "${before.step_name ?? 'tidak diketahui'}" dihapus.`
    return `${tableLabel} dihapus.`
  }

  switch (entry.table_name) {
    case 'routing_history': {
      const step = (after.step_name as string | undefined) ?? 'tahap routing'
      if (fields.includes('status')) {
        const status = after.status as string
        if (status === 'Completed') return `Tahap routing "${step}" selesai.`
        if (status === 'In Progress') return `Tahap routing "${step}" mulai dikerjakan.`
        if (status === 'Returned') return `Tahap routing "${step}" dikembalikan untuk revisi.`
        return `Status tahap routing "${step}" berubah menjadi ${status}.`
      }
      if (entry.action === 'INSERT') return `Tahap routing "${step}" ditambahkan.`
      if (fields.length === 0) return null
      return `Tahap routing "${step}" diperbarui: ${details(fields)}.`
    }
    case 'design_revisions': {
      const stage = (after.stage as string | undefined) ?? (before.stage as string | undefined) ?? 'tahap desain'
      if (entry.action === 'INSERT') return `Tahap desain "${stage}" dimulai.`
      if (fields.includes('completed_at') && after.completed_at) return `Tahap desain "${stage}" selesai pada ${formatDate(String(after.completed_at))}.`
      if (fields.includes('completed_at') && !after.completed_at) return `Tahap desain "${stage}" dibuka kembali.`
      if (fields.length === 0) return null
      return `Tahap desain "${stage}" diperbarui: ${details(fields)}.`
    }
    case 'designs':
      if (fields.includes('current_stage'))
        return `Tahap desain berubah dari "${before.current_stage ?? 'belum dimulai'}" menjadi "${after.current_stage}".`
      if (fields.includes('topo_data_received_at')) return `Tanggal data topografi masuk ${after.topo_data_received_at ? `diisi ${formatDate(String(after.topo_data_received_at))}` : 'dihapus'}.`
      if (entry.action === 'INSERT') return `Desain ${after.phase === 'finalisasi' ? 'finalisasi' : 'siteplan'} dibuat.`
      return fields.length ? `Desain diperbarui: ${details(fields)}.` : null
    case 'spk_routing':
      if (fields.includes('status')) return `Status dokumen routing berubah dari ${before.status ?? 'belum dimulai'} menjadi ${after.status}.`
      if (entry.action === 'INSERT') return 'Dokumen routing dibuat.'
      return fields.length ? `Dokumen routing diperbarui: ${details(fields)}.` : null
    case 'spks':
      if (fields.includes('status')) return `Status SPK berubah dari ${before.status ?? 'belum ditentukan'} menjadi ${after.status}.`
      if (fields.includes('terrain_survey_completed_at') && after.terrain_survey_completed_at && !before.terrain_survey_completed_at)
        return 'Survei Terestris ditandai selesai.'
      if (fields.includes('joint_check_completed_at') && after.joint_check_completed_at && !before.joint_check_completed_at)
        return after.joint_check_date ? `Pengecekan Bersama selesai pada ${formatDate(String(after.joint_check_date))}.` : 'Pengecekan Bersama ditandai selesai.'
      if (fields.includes('joint_check_completed_at') && !after.joint_check_completed_at)
        return 'Pengecekan Bersama dikembalikan ke sedang berjalan.'
      if (fields.includes('joint_check_date')) return `Tanggal Pengecekan Bersama ${after.joint_check_date ? `diubah ke ${formatDate(String(after.joint_check_date))}` : 'dihapus'}.`
      if (fields.includes('opname_marked_at') && after.opname_marked_at && !before.opname_marked_at)
        return 'Opname ditandai selesai.'
      if (fields.includes('pad_marked_at') && after.pad_marked_at && !before.pad_marked_at)
        return 'PAD ditandai selesai.'
      if (entry.action === 'INSERT') return 'SPK baru dibuat.'
      if (fields.length === 0) return null
      return `Data SPK diperbarui: ${details(fields)}.`
    case 'contracts':
    case 'invoices':
    case 'opnames':
    case 'pad':
      if (entry.action === 'INSERT') return `${tableLabel} baru dicatat${typeof after.value === 'number' ? ` senilai ${formatRupiah(after.value)}` : ''}.`
      if (fields.includes('status')) return `Status ${tableLabel} berubah menjadi ${after.status}.`
      return `${tableLabel} diperbarui${fields.length ? `: ${details(fields)}` : ''}.`
    default:
      if (entry.action === 'INSERT') return `${tableLabel} dibuat.`
      if (fields.length === 0) return null
      return `${tableLabel} diperbarui: ${details(fields)}.`
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
  const designIds = [...new Set((entries ?? [])
    .filter((e) => e.table_name === 'design_revisions')
    .map((e) => identifier(snapshot(e as AuditEntry).design_id))
    .filter((id): id is string => id !== null))]
  const routingIds = [...new Set((entries ?? [])
    .filter((e) => e.table_name === 'routing_history')
    .map((e) => identifier(snapshot(e as AuditEntry).spk_routing_id))
    .filter((id): id is string => id !== null))]
  const activityIds = [...new Set((entries ?? [])
    .filter((e) => e.table_name === 'activity_progress')
    .map((e) => identifier(snapshot(e as AuditEntry).spk_activity_id))
    .filter((id): id is string => id !== null))]
  const [{ data: designs }, { data: routings }, { data: activities }] = await Promise.all([
    designIds.length ? supabase.from('designs').select('id, spk_id').in('id', designIds) : Promise.resolve({ data: [] }),
    routingIds.length ? supabase.from('spk_routing').select('id, spk_id').in('id', routingIds) : Promise.resolve({ data: [] }),
    activityIds.length ? supabase.from('spk_activities').select('id, spk_id').in('id', activityIds) : Promise.resolve({ data: [] }),
  ])
  const designSpk = new Map((designs ?? []).map((row) => [row.id, row.spk_id]))
  const routingSpk = new Map((routings ?? []).map((row) => [row.id, row.spk_id]))
  const activitySpk = new Map((activities ?? []).map((row) => [row.id, row.spk_id]))
  const missingParentIds = [
    ...designIds.filter((id) => !designSpk.has(id)),
    ...routingIds.filter((id) => !routingSpk.has(id)),
    ...activityIds.filter((id) => !activitySpk.has(id)),
  ]
  const { data: parentAudit } = missingParentIds.length
    ? await supabase.from('audit_logs')
      .select('table_name, record_id, before_data, after_data')
      .in('record_id', missingParentIds)
      .in('table_name', ['designs', 'spk_routing', 'spk_activities'])
      .order('changed_at', { ascending: false })
      .limit(300)
    : { data: [] }
  for (const row of parentAudit ?? []) {
    if (!row.record_id) continue
    const data = (row.after_data ?? row.before_data ?? {}) as Record<string, unknown>
    const spkId = identifier(data.spk_id)
    if (!spkId) continue
    if (row.table_name === 'designs' && !designSpk.has(row.record_id)) designSpk.set(row.record_id, spkId)
    if (row.table_name === 'spk_routing' && !routingSpk.has(row.record_id)) routingSpk.set(row.record_id, spkId)
    if (row.table_name === 'spk_activities' && !activitySpk.has(row.record_id)) activitySpk.set(row.record_id, spkId)
  }
  const resolvedSpkId = (entry: AuditEntry) => {
    if (entry.spk_id) return entry.spk_id
    const data = snapshot(entry)
    if (entry.table_name === 'spks') return entry.record_id
    if (entry.table_name === 'design_revisions') return designSpk.get(String(data.design_id)) ?? null
    if (entry.table_name === 'routing_history') return routingSpk.get(String(data.spk_routing_id)) ?? null
    if (entry.table_name === 'activity_progress') return activitySpk.get(String(data.spk_activity_id)) ?? null
    return identifier(data.spk_id)
  }
  const spkIds = [
    ...new Set((entries ?? []).map((e) => resolvedSpkId(e as AuditEntry)).filter((id): id is string => id !== null)),
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
  const missingSpkIds = spkIds.filter((id) => !spkById.has(id))
  const { data: deletedSpkAudit } = missingSpkIds.length
    ? await supabase.from('audit_logs')
      .select('record_id, before_data, after_data')
      .eq('table_name', 'spks')
      .in('record_id', missingSpkIds)
      .order('changed_at', { ascending: false })
      .limit(100)
    : { data: [] }
  const deletedSpkName = new Map<string, { code: string; number: string | null }>()
  for (const row of deletedSpkAudit ?? []) {
    if (!row.record_id || deletedSpkName.has(row.record_id)) continue
    const data = (row.before_data ?? row.after_data ?? {}) as Record<string, unknown>
    const number = identifier(data.spk_number)
    const code = identifier(data.site_code) ?? number
    if (code) deletedSpkName.set(row.record_id, { code, number })
  }

  const rows = (entries ?? [])
    .map((row) => ({
      entry: row as AuditEntry,
      description: describe(row as AuditEntry),
      spkId: resolvedSpkId(row as AuditEntry),
    }))
    .filter(
      (row): row is { entry: AuditEntry; description: string; spkId: string | null } =>
        row.description !== null &&
        !(row.entry.action === 'DELETE' && row.entry.table_name !== 'spks' &&
          row.spkId !== null && deletedSpkName.has(row.spkId)),
    )
    .slice(0, FEED_SIZE)
  const actionCounts = rows.reduce(
    (acc, { entry }) => {
      acc[entry.action] += 1
      return acc
    },
    { INSERT: 0, UPDATE: 0, DELETE: 0 },
  )
  const touchedSpkCount = new Set(rows.map(({ spkId }) => spkId).filter(Boolean)).size

  return (
    <>
      <PageHeader
        title="Recent Activity"
        description="Perubahan terbaru dari pengguna."
      />

      {error && (
        <Alert tone="danger" className="mb-4" title="Gagal memuat data">
          {error.message}
        </Alert>
      )}

      <div className="mb-5 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {[
          { label: 'Aktivitas terakhir', value: rows.length, tone: 'text-slate-900', helper: `dari ${PAGE_SIZE} audit terakhir` },
          { label: 'SPK terkait', value: touchedSpkCount, tone: 'text-primary', helper: 'unik di feed ini' },
          { label: 'Update', value: actionCounts.UPDATE, tone: 'text-info', helper: 'perubahan data' },
          { label: 'Data baru', value: actionCounts.INSERT, tone: 'text-success', helper: 'record dibuat' },
        ].map((item) => (
          <Card key={item.label} className="overflow-hidden">
            <CardContent className="p-4">
              <div className="text-[11px] font-extrabold tracking-wider text-slate-500 uppercase">
                {item.label}
              </div>
              <div className={`tnum mt-1 text-3xl font-black ${item.tone}`}>{item.value}</div>
              <div className="mt-1 text-xs font-semibold text-muted-foreground">{item.helper}</div>
            </CardContent>
          </Card>
        ))}
      </div>

      <Card className="overflow-hidden">
        <CardHeader>
          <div>
            <CardTitle>Perubahan terakhir</CardTitle>
            <CardDescription>Perubahan otomatis dan penghapusan data turunan SPK diringkas. Detail lengkap ada di Audit Log.</CardDescription>
          </div>
          <Link
            href="/admin/audit-log"
            className="text-xs font-bold text-primary hover:underline"
          >
            Audit Log lengkap
          </Link>
        </CardHeader>

        {rows.length > 0 ? (
          <ul className="grid gap-3 bg-slate-50 px-5 py-4">
            {rows.map(({ entry, description, spkId }) => {
              const spk = spkId ? spkById.get(spkId) : null
              const deletedSpk = spkId ? deletedSpkName.get(spkId) : null
              const oldSpk = entry.table_name === 'spks' ? snapshot(entry) : null
              const spkName = spk?.site_code ?? spk?.spk_number ?? deletedSpk?.code
                ?? (oldSpk ? identifier(oldSpk.site_code) ?? identifier(oldSpk.spk_number) : null)
              const spkNumber = spk?.spk_number ?? deletedSpk?.number
              return (
                <li
                  key={entry.id}
                  className="flex items-start gap-3 rounded-lg border border-slate-200 bg-surface px-4 py-3 shadow-sm"
                >
                  <span className="grid h-9 w-9 shrink-0 place-items-center rounded-lg bg-primary-soft text-xs font-extrabold text-primary">
                    {(spkName ?? '#').slice(0, 1).toUpperCase()}
                  </span>
                  <div className="min-w-0 flex-1">
                    {spkName && (
                      <div className="mb-1 flex flex-wrap items-center gap-x-2 text-sm font-bold">
                        {spk ? (
                          <Link href={`/spk/${spk.id}`} className="text-primary hover:underline">
                            {spkName}
                          </Link>
                        ) : (
                          <span className="text-primary">{spkName}</span>
                        )}
                        {spkNumber && spkNumber !== spkName && (
                          <span className="font-medium text-muted-foreground">{spkNumber}</span>
                        )}
                      </div>
                    )}
                    <p className="text-sm font-medium text-slate-800">{description}</p>
                    <div className="mt-2 flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
                      <Badge tone={ACTION_TONE[entry.action]} className="py-0">
                        {ACTION_LABEL[entry.action]}
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
