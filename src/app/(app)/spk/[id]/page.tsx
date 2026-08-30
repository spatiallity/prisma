import type { Metadata } from 'next'
import Link from 'next/link'
import { notFound } from 'next/navigation'
import { ArrowLeft, Pencil } from 'lucide-react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Alert } from '@/components/ui/alert'
import { Table, Td, Th, Tr } from '@/components/ui/table'
import { EmptyState } from '@/components/ui/page-header'
import { requirePermission } from '@/lib/auth/session'
import { createClient } from '@/lib/supabase/server'
import { can } from '@/lib/auth/permissions'
import { cn, formatDate, formatDateTime, formatRupiah } from '@/lib/utils'
import { SPK_STATUS_TONE, daysLeft, formatArea, formatPercent } from '@/lib/spk'
import { ProgressTab } from './progress-tab'
import { DesignTab } from './design-tab'
import { RoutingTab } from './routing-tab'
import { FinancialTab } from './financial-tab'

export const metadata: Metadata = { title: 'Detail SPK' }

/** Section 12 — the tabs of Detail SPK. `ready` tracks what actually exists. */
const TABS = [
  { key: 'overview', label: 'Overview', phase: 2, ready: true },
  { key: 'progress', label: 'Progress', phase: 3, ready: true },
  { key: 'map', label: 'Map', phase: 3, ready: false },
  { key: 'design', label: 'Design', phase: 5, ready: true },
  { key: 'routing', label: 'Routing', phase: 6, ready: true },
  { key: 'financial', label: 'Financial', phase: 7, ready: true },
]

function Fact({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div>
      <dt className="text-[11px] font-extrabold tracking-wider text-slate-500 uppercase">
        {label}
      </dt>
      <dd className="mt-0.5 text-sm font-semibold text-slate-900">{value}</dd>
    </div>
  )
}

export default async function SpkDetailPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>
  searchParams: Promise<{ tab?: string; created?: string }>
}) {
  const user = await requirePermission('spk', 'view')
  const { id } = await params
  const { tab, created } = await searchParams
  const activeTab = TABS.find((t) => t.key === tab)?.key ?? 'overview'
  const mayEdit = can(user.permissions, 'spk', 'edit')

  const supabase = await createClient()

  // RLS (spk_visible) already hides SPK a vendor is not assigned to, so a miss
  // here is either "does not exist" or "not yours" — both are a 404.
  const { data: spk } = await supabase.from('spks').select('*').eq('id', id).maybeSingle()
  if (!spk) notFound()

  const [{ data: progress }, { data: vendor }, { data: manager }, { data: assignments }, { data: audit }] =
    await Promise.all([
      supabase
        .from('v_spk_progress')
        .select('*')
        .eq('spk_id', id)
        .maybeSingle(),
      spk.vendor_id
        ? supabase.from('vendors').select('id, name, code, contact_person, phone').eq('id', spk.vendor_id).maybeSingle()
        : Promise.resolve({ data: null }),
      spk.project_manager_id
        ? supabase.from('users').select('id, full_name, email').eq('id', spk.project_manager_id).maybeSingle()
        : Promise.resolve({ data: null }),
      supabase.from('spk_assignments').select('*').eq('spk_id', id).order('created_at'),
      supabase
        .from('audit_logs')
        .select('id, action, table_name, changed_at, changed_by, changed_fields')
        .eq('spk_id', id)
        .order('changed_at', { ascending: false })
        .limit(8),
    ])

  const teamIds = (assignments ?? []).map((a) => a.team_id).filter(Boolean) as string[]
  const vendorIds = [...new Set((assignments ?? []).map((a) => a.vendor_id))]
  const actorIds = [
    ...new Set((audit ?? []).map((entry) => entry.changed_by).filter(Boolean)),
  ] as string[]

  const [{ data: teams }, { data: assignmentVendors }, { data: actors }] = await Promise.all([
    teamIds.length
      ? supabase.from('vendor_teams').select('id, name').in('id', teamIds)
      : Promise.resolve({ data: [] }),
    vendorIds.length
      ? supabase.from('vendors').select('id, name').in('id', vendorIds)
      : Promise.resolve({ data: [] }),
    actorIds.length
      ? supabase.from('users').select('id, full_name').in('id', actorIds)
      : Promise.resolve({ data: [] }),
  ])

  const teamName = new Map((teams ?? []).map((t) => [t.id, t.name]))
  const assignmentVendorName = new Map((assignmentVendors ?? []).map((v) => [v.id, v.name]))
  const actorName = new Map((actors ?? []).map((a) => [a.id, a.full_name]))

  const remaining = daysLeft(spk.end_date)
  const overall = progress?.overall_progress ?? 0

  return (
    <>
      <Link
        href="/spk"
        className="mb-4 inline-flex items-center gap-1.5 text-sm font-semibold text-muted-foreground hover:text-primary"
      >
        <ArrowLeft size={16} aria-hidden />
        Kembali ke daftar SPK
      </Link>

      {created && (
        <Alert tone="success" className="mb-4">
          SPK berhasil dibuat.
        </Alert>
      )}

      {/* Header — Section 12 */}
      <Card className="mb-5">
        <CardContent className="p-5">
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div className="min-w-0">
              <div className="flex flex-wrap items-center gap-2">
                <h1 className="text-xl font-extrabold tracking-tight text-slate-900">
                  {spk.spk_number}
                </h1>
                {spk.site_code && <Badge tone="info">{spk.site_code}</Badge>}
                <Badge tone={SPK_STATUS_TONE[spk.status]}>{spk.status}</Badge>
              </div>
              <p className="mt-1 text-sm font-medium text-muted-foreground">
                {spk.work_name}
              </p>
              <div className="mt-2 flex flex-wrap items-center gap-x-4 gap-y-1 text-xs font-semibold text-slate-600">
                <span>{formatArea(spk.area_ha)}</span>
                <span>{formatRupiah(spk.contract_value)}</span>
                <span>{vendor?.name ?? 'Vendor belum ditentukan'}</span>
                <span className="tnum">
                  {formatDate(spk.start_date)} – {formatDate(spk.end_date)}
                </span>
              </div>
            </div>

            <div className="flex items-center gap-4">
              <div className="text-right">
                <div className="text-[11px] font-extrabold tracking-wider text-slate-500 uppercase">
                  Progress
                </div>
                <div className="tnum text-3xl font-black text-primary">
                  {formatPercent(overall)}
                </div>
              </div>
              {mayEdit && (
                <Link
                  href={`/spk/${spk.id}/edit`}
                  className="inline-flex h-9 items-center gap-2 rounded-lg border border-slate-300 bg-white px-3 text-sm font-semibold text-slate-700 hover:bg-slate-50"
                >
                  <Pencil size={15} aria-hidden />
                  Edit
                </Link>
              )}
            </div>
          </div>

          <div className="mt-4 h-2 w-full overflow-hidden rounded-full bg-slate-100">
            <div
              className="h-full rounded-full bg-primary transition-all"
              style={{ width: `${Math.min(Math.max(overall, 0), 100)}%` }}
            />
          </div>
        </CardContent>
      </Card>

      {/* Tabs */}
      <div className="mb-5 flex flex-wrap gap-1 rounded-xl bg-slate-100 p-1">
        {TABS.map((t) => {
          const built = t.ready
          const active = t.key === activeTab
          const className = cn(
            'rounded-lg px-3.5 py-1.5 text-xs font-extrabold transition-shadow',
            active
              ? 'bg-primary text-white shadow-md shadow-primary/20'
              : built
                ? 'text-slate-500 hover:text-slate-800'
                : 'cursor-not-allowed text-slate-300',
          )

          return built ? (
            <Link key={t.key} href={`/spk/${spk.id}?tab=${t.key}`} className={className}>
              {t.label}
            </Link>
          ) : (
            <span key={t.key} className={className} title={`Tab ${t.label} belum tersedia`}>
              {t.label}
            </span>
          )
        })}
      </div>

      {activeTab === 'progress' && (
        <ProgressTab
          spkId={spk.id}
          activityTemplateId={spk.activity_template_id}
          mayEdit={can(user.permissions, 'progress', 'edit')}
        />
      )}

      {activeTab === 'design' && <DesignTab spkId={spk.id} />}

      {activeTab === 'routing' && <RoutingTab spkId={spk.id} />}

      {activeTab === 'financial' && <FinancialTab spkId={spk.id} />}

      {activeTab === 'overview' && (
      <div className="grid gap-5 lg:grid-cols-3">
        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle>Basic information</CardTitle>
          </CardHeader>
          <CardContent>
            <dl className="grid gap-4 sm:grid-cols-3">
              <Fact label="Jenis pekerjaan" value={spk.work_type ?? '—'} />
              <Fact label="Lokasi" value={spk.location ?? '—'} />
              <Fact label="Kabupaten/Kota" value={spk.kabupaten ?? '—'} />
              <Fact label="Provinsi" value={spk.provinsi ?? '—'} />
              <Fact label="Luas area" value={formatArea(spk.area_ha)} />
              <Fact label="Nilai kontrak" value={formatRupiah(spk.contract_value)} />
              <Fact label="Tanggal mulai" value={formatDate(spk.start_date)} />
              <Fact label="Tanggal selesai" value={formatDate(spk.end_date)} />
              <Fact
                label="Sisa waktu"
                value={
                  remaining === null ? (
                    '—'
                  ) : remaining < 0 ? (
                    <span className="text-danger">Lewat {Math.abs(remaining)} hari</span>
                  ) : (
                    `${remaining} hari`
                  )
                }
              />
              <Fact
                label="Project Manager"
                value={manager?.full_name ?? 'Belum ditentukan'}
              />
              <Fact
                label="Vendor Jasa Survey"
                value={vendor ? `${vendor.name} (${vendor.code})` : 'Belum ditentukan'}
              />
              <Fact
                label="Aktivitas"
                value={
                  progress
                    ? `${progress.activity_completed}/${progress.activity_count} selesai`
                    : 'Belum ada aktivitas'
                }
              />
            </dl>

            {spk.notes && (
              <div className="mt-5 rounded-lg border border-slate-200 bg-surface-muted p-3">
                <div className="text-[11px] font-extrabold tracking-wider text-slate-500 uppercase">
                  Keterangan
                </div>
                <p className="mt-1 text-sm whitespace-pre-line text-slate-700">
                  {spk.notes}
                </p>
              </div>
            )}
          </CardContent>
        </Card>

        <div className="grid content-start gap-5">
          <Card>
            <CardHeader>
              <CardTitle>Assignment</CardTitle>
              {can(user.permissions, 'vendor', 'edit') && (
                <Link
                  href="/vendor/assignment"
                  className="text-xs font-bold text-primary hover:underline"
                >
                  Kelola
                </Link>
              )}
            </CardHeader>
            <CardContent className="p-0">
              {assignments && assignments.length > 0 ? (
                <ul className="divide-y divide-slate-100">
                  {assignments.map((assignment) => (
                    <li key={assignment.id} className="px-5 py-3">
                      <div className="flex items-center justify-between gap-2">
                        <span className="text-sm font-bold text-slate-900">
                          {assignmentVendorName.get(assignment.vendor_id) ?? '—'}
                        </span>
                        <Badge
                          tone={assignment.status === 'Active' ? 'success' : 'neutral'}
                        >
                          {assignment.status}
                        </Badge>
                      </div>
                      <div className="text-xs text-muted-foreground">
                        {assignment.team_id
                          ? (teamName.get(assignment.team_id) ?? 'Team')
                          : 'Seluruh vendor'}
                        {assignment.assigned_from && (
                          <>
                            {' · '}
                            {formatDate(assignment.assigned_from)} –{' '}
                            {formatDate(assignment.assigned_to)}
                          </>
                        )}
                      </div>
                    </li>
                  ))}
                </ul>
              ) : (
                <EmptyState
                  title="Belum ada assignment"
                  description="Tugaskan vendor atau team agar mereka bisa mengisi Daily Progress."
                />
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Latest activity</CardTitle>
            </CardHeader>
            <CardContent className="p-0">
              {audit && audit.length > 0 ? (
                <Table>
                  <thead>
                    <tr>
                      <Th>Waktu</Th>
                      <Th>User</Th>
                      <Th>Aksi</Th>
                    </tr>
                  </thead>
                  <tbody>
                    {audit.map((entry) => (
                      <Tr key={entry.id}>
                        <Td className="tnum whitespace-nowrap text-xs text-muted-foreground">
                          {formatDateTime(entry.changed_at)}
                        </Td>
                        <Td className="text-xs">
                          {entry.changed_by
                            ? (actorName.get(entry.changed_by) ?? 'Tidak dikenal')
                            : 'Sistem'}
                        </Td>
                        <Td className="text-xs">
                          <span className="code">{entry.table_name}</span>{' '}
                          <span className="text-muted-foreground">{entry.action}</span>
                        </Td>
                      </Tr>
                    ))}
                  </tbody>
                </Table>
              ) : (
                <EmptyState title="Belum ada perubahan tercatat" />
              )}
            </CardContent>
          </Card>
        </div>
      </div>
      )}
    </>
  )
}
