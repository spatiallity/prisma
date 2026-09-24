import type { Metadata } from 'next'
import Link from 'next/link'
import { notFound } from 'next/navigation'
import { ArrowLeft, Banknote, CalendarDays, Clock3, MapPin, Pencil, Route } from 'lucide-react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Alert } from '@/components/ui/alert'
import { Table, Td, Th, Tr } from '@/components/ui/table'
import { EmptyState } from '@/components/ui/page-header'
import { requirePermission } from '@/lib/auth/session'
import { createClient } from '@/lib/supabase/server'
import { can } from '@/lib/auth/permissions'
import { cn, formatDate, formatDateTime, formatRupiah } from '@/lib/utils'
import { SPK_STATUS_TONE, daysLeft, formatArea, isTerrestrialSurveyOnly, spkStatusLabel } from '@/lib/spk'
import { loadStageBySpk } from '@/lib/spk-stage'
import { SurveyTab } from './survey-tab'
import { DesignTab } from './design-tab'
import { RoutingTab } from './routing-tab'
import { FinancialTab } from './financial-tab'
import { SpkFilePanel } from './spk-file-panel'

export const metadata: Metadata = { title: 'Detail SPK' }

/** Section 12 — the tabs of Detail SPK. `ready` tracks what actually exists.
 *  Progress (the weighted activity/% tracker) is kept in the codebase but not
 *  surfaced — we don't use it now (see Survei Terestris/Pengecekan Bersama
 *  below for the field-survey stage that replaces it). */
const TABS = [
  { key: 'overview', label: 'Ringkasan', phase: 2, ready: true },
  { key: 'survey', label: 'Survei Lapangan', phase: 3, ready: true },
  { key: 'design', label: 'Desain', phase: 5, ready: true },
  { key: 'routing', label: 'Dokumen Invoice', phase: 6, ready: true },
  { key: 'financial', label: 'Keuangan', phase: 7, ready: true },
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

const AUDIT_TABLE_LABEL: Record<string, string> = {
  spks: 'Data SPK',
  spk_activities: 'Aktivitas',
  activity_progress: 'Progress aktivitas',
  designs: 'Desain',
  design_revisions: 'Tahap desain',
  spk_routing: 'Dokumen invoice',
  routing_history: 'Tahap dokumen invoice',
  invoices: 'Invoice',
  payments: 'Payment',
  opnames: 'Opname',
  pad: 'PAD',
}

const AUDIT_ACTION_LABEL: Record<string, string> = {
  INSERT: 'Dibuat',
  UPDATE: 'Diperbarui',
  DELETE: 'Dihapus',
}

function SummaryCard({
  label,
  value,
  helper,
  icon,
  tone,
}: {
  label: string
  value: React.ReactNode
  helper?: React.ReactNode
  icon: React.ReactNode
  tone: string
}) {
  return (
    <Card className="overflow-hidden">
      <CardContent className="p-4">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <div className="text-[11px] font-extrabold tracking-wider text-slate-500 uppercase">
              {label}
            </div>
            <div className="mt-1 truncate text-lg font-black text-slate-900">{value}</div>
            {helper && <div className="mt-1 text-xs font-semibold text-muted-foreground">{helper}</div>}
          </div>
          <div className={cn('grid h-9 w-9 shrink-0 place-items-center rounded-lg', tone)}>
            {icon}
          </div>
        </div>
      </CardContent>
    </Card>
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
  const mayEdit = can(user.permissions, 'spk', 'edit')

  const supabase = await createClient()

  // RLS (spk_visible) already hides SPK a vendor is not assigned to, so a miss
  // here is either "does not exist" or "not yours" — both are a 404.
  const { data: spk } = await supabase.from('spks').select('*').eq('id', id).maybeSingle()
  if (!spk) notFound()
  const visibleTabs = isTerrestrialSurveyOnly(spk.work_type)
    ? TABS.filter((item) => item.key !== 'design')
    : TABS
  const activeTab = visibleTabs.find((item) => item.key === tab)?.key ?? 'overview'

  const [{ data: audit }, { data: documents }] = await Promise.all([
    supabase
      .from('audit_logs')
      .select('id, action, table_name, changed_at, changed_by, changed_fields')
      .eq('spk_id', id)
      .order('changed_at', { ascending: false })
      .limit(8),
    supabase.from('files').select('id, filename, size_bytes, uploaded_at').eq('spk_id', id).eq('module', 'other').eq('status', 'Active').order('uploaded_at', { ascending: false }).limit(1).maybeSingle(),
  ])

  const actorIds = [
    ...new Set((audit ?? []).map((entry) => entry.changed_by).filter(Boolean)),
  ] as string[]

  const { data: actors } = actorIds.length
    ? await supabase.from('users').select('id, full_name').in('id', actorIds)
    : { data: [] }

  const actorName = new Map((actors ?? []).map((a) => [a.id, a.full_name]))

  const stageBySpk = await loadStageBySpk(supabase, [spk])
  const stage = stageBySpk[spk.id]
  const hasRoutingStarted = stage?.label.startsWith('Routing') || stage?.label === 'Invoice terbit'

  const remaining = daysLeft(spk.end_date)
  const scheduleLabel =
    remaining === null
      ? '—'
      : remaining < 0
        ? `Lewat ${Math.abs(remaining)} hari`
        : `${remaining} hari lagi`
  const scheduleTone = remaining !== null && remaining < 0 ? 'text-danger' : 'text-slate-900'

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
      <Card className="mb-5 overflow-hidden">
        <CardContent className="p-5">
          <div className="flex flex-wrap items-start justify-between gap-5">
            <div className="min-w-0">
              <div className="flex flex-wrap items-center gap-2">
                <h1 className="text-xl font-extrabold tracking-tight text-slate-900">
                  {spk.site_code ?? spk.spk_number}
                </h1>
                <Badge tone="info">{spk.spk_number}</Badge>
                <Badge tone={SPK_STATUS_TONE[spk.status]}>{spkStatusLabel(spk.status)}</Badge>
              </div>
              <p className="mt-1 text-sm font-medium text-muted-foreground">
                {spk.work_name}
              </p>
              <div className="mt-3 flex flex-wrap items-center gap-2 text-xs font-semibold text-slate-600">
                <span className="inline-flex items-center gap-1 rounded-full bg-slate-100 px-2.5 py-1">
                  <MapPin size={13} aria-hidden />
                  {spk.location ?? spk.kabupaten ?? 'Lokasi belum diisi'}
                </span>
                <span className="tnum inline-flex items-center gap-1 rounded-full bg-slate-100 px-2.5 py-1">
                  <CalendarDays size={13} aria-hidden />
                  {formatDate(spk.start_date)} – {formatDate(spk.end_date)}
                </span>
              </div>
            </div>

            <div className="flex flex-wrap items-center gap-3">
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
        </CardContent>
      </Card>

      <div className="mb-5 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <SummaryCard
          label="Nilai Kontrak"
          value={formatRupiah(spk.contract_value)}
          helper="Nilai awal SPK"
          icon={<Banknote size={17} aria-hidden />}
          tone="bg-primary-soft text-primary"
        />
        <SummaryCard
          label="Luas Area"
          value={formatArea(spk.area_ha)}
          helper={spk.location_type ?? 'Jenis lokasi belum diisi'}
          icon={<MapPin size={17} aria-hidden />}
          tone="bg-info/10 text-info"
        />
        <SummaryCard
          label="Jadwal"
          value={<span className={scheduleTone}>{scheduleLabel}</span>}
          helper={`${formatDate(spk.start_date)} - ${formatDate(spk.end_date)}`}
          icon={<Clock3 size={17} aria-hidden />}
          tone="bg-warning/15 text-warning"
        />
        <SummaryCard
          label="Tahap Saat Ini"
          value={stage?.label ?? 'Belum mulai'}
          helper={stage?.date ? formatDate(stage.date) : spkStatusLabel(spk.status)}
          icon={<Route size={17} aria-hidden />}
          tone="bg-primary-soft text-primary"
        />
      </div>

      {/* Tabs */}
      <div className="mb-5 flex flex-wrap gap-1 rounded-lg border border-slate-200 bg-surface p-1 shadow-sm">
        {visibleTabs.map((t) => {
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

      {activeTab === 'survey' && <SurveyTab spkId={spk.id} mayEdit={mayEdit} />}

      {activeTab === 'design' && (
        <DesignTab
          spkId={spk.id}
          mayEdit={mayEdit}
          allowBlankDates={user.role.code === 'super_admin'}
        />
      )}

      {activeTab === 'routing' && (
        <RoutingTab
          spkId={spk.id}
          mayEdit={mayEdit}
          allowBlankDates={user.role.code === 'super_admin'}
        />
      )}

      {activeTab === 'financial' && <FinancialTab spkId={spk.id} mayEdit={mayEdit} />}

      {activeTab === 'overview' && (
      <>
      <div className="mb-5">
        <SpkFilePanel spkId={spk.id} mayEdit={mayEdit} file={documents} />
      </div>
      <div className="grid gap-5 lg:grid-cols-3">
        <Card className="overflow-hidden lg:col-span-2">
          <CardHeader>
            <div>
              <CardTitle>Informasi Pekerjaan</CardTitle>
              <CardDescription>Data utama yang dipakai di proses survei, desain, invoice, dan keuangan.</CardDescription>
            </div>
          </CardHeader>
          <CardContent>
            <dl className="grid gap-4 sm:grid-cols-3">
              <Fact label="Jenis pekerjaan" value={spk.work_type ?? '—'} />
              <Fact label="Jenis Lokasi" value={spk.location_type ?? '—'} />
              <Fact label="Lokasi" value={spk.location ?? '—'} />
              <Fact label="Kabupaten/Kota" value={spk.kabupaten ?? '—'} />
              <Fact label="Provinsi" value={spk.provinsi ?? '—'} />
              <Fact label="Luas area" value={formatArea(spk.area_ha)} />
              <Fact label="Nilai kontrak" value={formatRupiah(spk.contract_value)} />
              <Fact label="Tanggal mulai" value={formatDate(spk.start_date)} />
              <Fact label="Tanggal selesai" value={formatDate(spk.end_date)} />
              <Fact
                label={hasRoutingStarted ? 'Posisi dokumen' : 'Sisa waktu'}
                value={
                  hasRoutingStarted ? (
                    (stage?.label ?? 'Selesai')
                  ) : remaining === null ? (
                    '—'
                  ) : remaining < 0 ? (
                    <span className="text-danger">Lewat {Math.abs(remaining)} hari</span>
                  ) : (
                    `${remaining} hari`
                  )
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
          <Card className="overflow-hidden">
            <CardHeader>
              <div>
                <CardTitle>Aktivitas Terakhir</CardTitle>
                <CardDescription>Perubahan terbaru untuk SPK ini.</CardDescription>
              </div>
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
                          <span className="font-bold text-slate-900">
                            {AUDIT_TABLE_LABEL[entry.table_name] ?? entry.table_name}
                          </span>{' '}
                          <span className="text-muted-foreground">
                            {AUDIT_ACTION_LABEL[entry.action] ?? entry.action}
                          </span>
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
      </>
      )}
    </>
  )
}
