import type { Metadata } from 'next'
import Link from 'next/link'
import {
  FolderKanban,
  Workflow,
  FileStack,
  FileCheck2,
  Receipt,
  Wallet,
  type LucideIcon,
} from 'lucide-react'
import { PageHeader, EmptyState } from '@/components/ui/page-header'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Table, Td, Th, Tr } from '@/components/ui/table'
import { requireUser } from '@/lib/auth/session'
import { createClient } from '@/lib/supabase/server'
import { can } from '@/lib/auth/permissions'
import { cn, formatDate, formatRupiah, formatRupiahCompact } from '@/lib/utils'
import { daysLeft, formatPercent } from '@/lib/spk'
import { UPDATE_STATUS_TONE } from '@/lib/schedule'
import { SEVERITY_RANK, formatMetric } from '@/lib/dashboard'
import { filterLeafAccounts, formatMonthLabel } from '@/lib/financial'
import { RabDonutChart, SpkStatusChart, TopCategoriesChart } from './dashboard-charts'

export const metadata: Metadata = { title: 'Dashboard' }

/**
 * Section 8 — the dashboard answers four questions: how many SPK and at what
 * stage, what is being worked on today, what is stuck, and how the money
 * stands. Every figure is read from a view; none of it is entered.
 */
export default async function DashboardPage() {
  const user = await requireUser()
  const supabase = await createClient()

  const seeFinance = can(user.permissions, 'spending', 'view')
  const now = new Date()
  const currentBulan = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-01`

  const [
    { data: kpi },
    { data: bottlenecks },
    { data: today },
    { data: progress },
    { data: akunSummary },
    { data: spkStatuses },
    { data: monthTx },
  ] = await Promise.all([
    supabase.from('v_dashboard_kpi').select('*').maybeSingle(),
    supabase.from('v_bottleneck').select('*'),
    can(user.permissions, 'schedule', 'view')
      ? supabase.from('v_today_schedule').select('*')
      : Promise.resolve({ data: [] }),
    supabase
      .from('v_spk_progress')
      .select('*')
      .eq('status', 'On Going')
      .order('overall_progress', { ascending: false })
      .limit(6),
    seeFinance
      ? supabase.from('v_finance_akun_summary').select('*')
      : Promise.resolve({ data: [] }),
    supabase.from('spks').select('status'),
    seeFinance
      ? supabase
          .from('finance_transactions')
          .select('kode_akun, jumlah')
          .eq('status', 'Active')
          .eq('bulan', currentBulan)
      : Promise.resolve({ data: [] }),
  ])

  const statusCounts = new Map<string, number>()
  for (const row of spkStatuses ?? []) {
    statusCounts.set(row.status, (statusCounts.get(row.status) ?? 0) + 1)
  }
  const spkStatusChartData = ['Draft', 'On Going', 'Selesai', 'Archived', 'Cancelled'].map(
    (status) => ({ status, count: statusCounts.get(status) ?? 0 }),
  )

  const rabLeaf = filterLeafAccounts(akunSummary ?? [])
  const rabTotals = rabLeaf.reduce(
    (acc, a) => ({
      anggaran: acc.anggaran + Number(a.anggaran_rp ?? 0),
      realisasi: acc.realisasi + Number(a.realisasi_total),
    }),
    { anggaran: 0, realisasi: 0 },
  )
  const rabPercent =
    rabTotals.anggaran > 0 ? (rabTotals.realisasi / rabTotals.anggaran) * 100 : null

  // This month's spend, broken down by account — same kode_akun → uraian
  // lookup the RAB summary above already has, just resummed per bulan.
  const uraianByAkun = new Map((akunSummary ?? []).map((a) => [a.kode_akun, a.uraian]))
  const spendByAkun = new Map<string, number>()
  for (const row of monthTx ?? []) {
    spendByAkun.set(row.kode_akun, (spendByAkun.get(row.kode_akun) ?? 0) + Number(row.jumlah))
  }
  const monthTotal = [...spendByAkun.values()].reduce((sum, v) => sum + v, 0)
  const topCategories = [...spendByAkun.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, 5)
    .map(([kodeAkun, jumlah]) => ({
      label: uraianByAkun.get(kodeAkun) ?? kodeAkun,
      jumlah,
    }))

  const ranked = [...(bottlenecks ?? [])].sort(
    (a, b) => SEVERITY_RANK[a.severity] - SEVERITY_RANK[b.severity],
  )
  const critical = ranked.filter((b) => b.severity === 'critical').length

  const updatedToday = (today ?? []).filter(
    (row) => row.update_status === 'Updated Today',
  ).length

  // Section 8.1 — the six headline counts, all derived. Icon-badge accent
  // rotates through the brand palette so the tile row reads with some
  // rhythm instead of six identical teal squares.
  const tiles: {
    label: string
    value: number
    foot: string
    href: string
    icon: LucideIcon
    accent: 'primary' | 'info' | 'navy' | 'gold' | 'orange'
  }[] = [
    { label: 'Total SPK', value: kpi?.total_spk ?? 0, foot: `${kpi?.spk_selesai ?? 0} selesai`, href: '/spk', icon: FolderKanban, accent: 'primary' },
    { label: 'On Going', value: kpi?.spk_on_going ?? 0, foot: 'sedang berjalan', href: '/spk?status=ongoing', icon: Workflow, accent: 'info' },
    { label: 'Masuk Routing', value: kpi?.spk_routing ?? 0, foot: 'punya dokumen dirutekan', href: '/routing', icon: FileStack, accent: 'navy' },
    { label: 'PAD', value: kpi?.spk_pad ?? 0, foot: 'sudah terbit PAD', href: '/financial/pad', icon: FileCheck2, accent: 'gold' },
    { label: 'Invoice', value: kpi?.spk_invoice ?? 0, foot: 'sudah ditagihkan', href: '/financial/invoice', icon: Receipt, accent: 'orange' },
    { label: 'Payment', value: kpi?.spk_payment ?? 0, foot: 'sudah dibayar', href: '/financial/payment', icon: Wallet, accent: 'primary' },
  ]

  const ACCENT_CLASS: Record<(typeof tiles)[number]['accent'], string> = {
    primary: 'bg-primary-soft text-primary',
    info: 'bg-info/10 text-info',
    navy: 'bg-brand-navy/15 text-brand-navy',
    gold: 'bg-warning/15 text-warning',
    orange: 'bg-brand-orange/10 text-brand-orange',
  }

  return (
    <>
      <PageHeader title={`Selamat datang, ${user.fullName.split(' ')[0]}`} />

      <div className="mb-5 grid gap-4 sm:grid-cols-3 lg:grid-cols-6">
        {tiles.map((tile) => (
          <Link key={tile.label} href={tile.href}>
            <Card className="h-full rounded-2xl transition-shadow hover:shadow-md">
              <CardContent className="p-4">
                <div className="flex items-start justify-between gap-2">
                  <div className="truncate text-[11px] font-extrabold tracking-wider text-slate-500 uppercase">
                    {tile.label}
                  </div>
                  <div
                    className={cn(
                      'flex h-8 w-8 shrink-0 items-center justify-center rounded-lg',
                      ACCENT_CLASS[tile.accent],
                    )}
                  >
                    <tile.icon size={15} aria-hidden />
                  </div>
                </div>
                <div className="tnum mt-2 text-3xl font-black text-slate-900">
                  {tile.value}
                </div>
                <div className="mt-1 text-xs font-semibold text-muted-foreground">
                  {tile.foot}
                </div>
              </CardContent>
            </Card>
          </Link>
        ))}
      </div>

      <div className="grid gap-5 lg:grid-cols-3">
        <div className="grid content-start gap-5 lg:col-span-2">
          <Card className="overflow-hidden">
            <CardHeader>
              <div>
                <CardTitle>Progress SPK On Going</CardTitle>
                <CardDescription>Overall Progress = Σ (progress aktivitas × bobot)</CardDescription>
              </div>
              <Link href="/spk" className="text-xs font-bold text-primary hover:underline">
                Semua SPK
              </Link>
            </CardHeader>

            {progress && progress.length > 0 ? (
              <Table>
                <thead>
                  <tr>
                    <Th>SPK</Th>
                    <Th>Pekerjaan</Th>
                    <Th>Periode</Th>
                    <Th className="text-right">Aktivitas</Th>
                    <Th className="text-right">Progress</Th>
                  </tr>
                </thead>
                <tbody>
                  {progress.map((row) => {
                    const remaining = daysLeft(row.end_date)
                    const overdue = remaining !== null && remaining < 0
                    const value = Math.min(
                      Math.max(Number(row.overall_progress), 0),
                      100,
                    )
                    return (
                      <Tr key={row.spk_id}>
                        <Td>
                          <Link
                            href={`/spk/${row.spk_id}`}
                            className="font-bold text-primary hover:underline"
                          >
                            {row.site_code ?? row.spk_number}
                          </Link>
                        </Td>
                        <Td className="max-w-xs">
                          <span className="line-clamp-1 font-bold text-slate-900">
                            {row.work_name}
                          </span>
                        </Td>
                        <Td className="tnum whitespace-nowrap text-muted-foreground">
                          {formatDate(row.start_date)} – {formatDate(row.end_date)}
                          {overdue && (
                            <div className="text-xs font-bold text-danger">
                              Lewat {Math.abs(remaining)} hari
                            </div>
                          )}
                        </Td>
                        <Td className="tnum text-right text-muted-foreground">
                          {row.activity_completed}/{row.activity_count}
                        </Td>
                        <Td className="text-right">
                          <div className="flex items-center justify-end gap-2">
                            <div className="h-1.5 w-16 overflow-hidden rounded-full bg-slate-100">
                              <div
                                className="h-full rounded-full bg-primary"
                                style={{ width: `${value}%` }}
                              />
                            </div>
                            <span className="tnum w-14 text-right font-bold">
                              {formatPercent(row.overall_progress)}
                            </span>
                          </div>
                        </Td>
                      </Tr>
                    )
                  })}
                </tbody>
              </Table>
            ) : (
              <EmptyState
                title="Belum ada SPK berjalan"
                description="SPK berstatus On Going akan muncul di sini."
              />
            )}
          </Card>

          {(today ?? []).length > 0 && (
            <Card className="overflow-hidden">
              <CardHeader>
                <div>
                  <CardTitle>Hari ini</CardTitle>
                </div>
                <Badge tone={updatedToday === (today ?? []).length ? 'success' : 'warning'}>
                  {updatedToday}/{(today ?? []).length} sudah update
                </Badge>
              </CardHeader>
              <Table>
                <thead>
                  <tr>
                    <Th>Vendor</Th>
                    <Th>Team</Th>
                    <Th>SPK</Th>
                    <Th>Aktivitas</Th>
                    <Th className="text-right">Target</Th>
                    <Th>Status</Th>
                  </tr>
                </thead>
                <tbody>
                  {(today ?? []).slice(0, 8).map((row) => (
                    <Tr key={row.daily_plan_id}>
                      <Td className="font-bold text-slate-900">{row.vendor_name ?? '—'}</Td>
                      <Td className="text-muted-foreground">{row.team_name ?? '—'}</Td>
                      <Td>
                        <Link
                          href={`/spk/${row.spk_id}`}
                          className="font-bold text-primary hover:underline"
                        >
                          {row.site_code ?? row.spk_number}
                        </Link>
                      </Td>
                      <Td className="text-muted-foreground">{row.activity_name ?? '—'}</Td>
                      <Td className="tnum text-right">
                        {row.target_value !== null
                          ? `${row.target_value}${row.unit ? ` ${row.unit}` : ''}`
                          : '—'}
                      </Td>
                      <Td>
                        <Badge tone={UPDATE_STATUS_TONE[row.update_status]}>
                          {row.update_status}
                        </Badge>
                      </Td>
                    </Tr>
                  ))}
                </tbody>
              </Table>
            </Card>
          )}
        </div>

        <div className="grid content-start gap-5">
          {(kpi?.total_spk ?? 0) > 0 && (
            <Card className="overflow-hidden">
              <CardHeader>
                <div>
                  <CardTitle>Sebaran status SPK</CardTitle>
                  <CardDescription>{kpi?.total_spk ?? 0} SPK aktif (di luar Cancelled)</CardDescription>
                </div>
              </CardHeader>
              <SpkStatusChart data={spkStatusChartData} />
            </Card>
          )}

          <Card className="overflow-hidden">
            <CardHeader>
              <div>
                <CardTitle>Bottleneck</CardTitle>
              </div>
              <Badge tone={critical > 0 ? 'danger' : ranked.length > 0 ? 'warning' : 'success'}>
                {ranked.length}
              </Badge>
            </CardHeader>

            {ranked.length > 0 ? (
              <>
                <ul>
                  {ranked.slice(0, 6).map((item, index) => (
                    <li
                      key={`${item.reason}-${item.spk_id ?? 'none'}-${index}`}
                      className="flex items-stretch gap-3 border-b border-slate-100 px-5 py-3 last:border-0"
                    >
                      <span
                        className={cn(
                          'w-1 shrink-0 rounded-full',
                          item.severity === 'critical' ? 'bg-danger' : 'bg-warning',
                        )}
                        aria-hidden
                      />
                      <div className="min-w-0 flex-1">
                        <p className="text-sm font-bold text-slate-900">{item.reason}</p>
                        <p className="text-xs text-muted-foreground">
                          {item.site_code ?? item.spk_number ?? 'Seluruh project'}
                          {formatMetric(item.reason, item.metric) &&
                            ` · ${formatMetric(item.reason, item.metric)}`}
                        </p>
                      </div>
                    </li>
                  ))}
                </ul>
                <div className="border-t border-slate-100 px-5 py-3">
                  <Link
                    href="/dashboard/bottleneck"
                    className="text-xs font-bold text-primary hover:underline"
                  >
                    Lihat semua {ranked.length} bottleneck
                  </Link>
                </div>
              </>
            ) : (
              <EmptyState
                title="Tidak ada bottleneck"
                description="Semua kondisi dalam batas wajar."
              />
            )}
          </Card>
        </div>
      </div>

      {seeFinance && (
        <div className="mt-5 grid gap-5 lg:grid-cols-2">
          {topCategories.length > 0 && (
            <Card className="overflow-hidden rounded-2xl">
              <CardHeader>
                <div>
                  <CardTitle>Pengeluaran {formatMonthLabel(currentBulan)}</CardTitle>
                  <CardDescription>
                    Total{' '}
                    <span
                      className="tnum font-bold text-slate-900"
                      title={formatRupiah(monthTotal)}
                    >
                      {formatRupiahCompact(monthTotal)}
                    </span>{' '}
                    · top {topCategories.length} kategori
                  </CardDescription>
                </div>
              </CardHeader>
              <TopCategoriesChart data={topCategories} />
            </Card>
          )}

          <Card
            className={cn(
              'overflow-hidden rounded-2xl',
              topCategories.length === 0 && 'lg:col-span-2',
            )}
          >
            <CardHeader>
              <div>
                <CardTitle>RAB — Anggaran vs Realisasi</CardTitle>
                <CardDescription>{rabLeaf.length} kode akun</CardDescription>
              </div>
            </CardHeader>
            <CardContent className="grid gap-3 sm:grid-cols-2 sm:items-center">
              <RabDonutChart anggaran={rabTotals.anggaran} realisasi={rabTotals.realisasi} />
              <div className="grid gap-2">
                <div className="flex items-baseline justify-between gap-3">
                  <span className="text-sm text-muted-foreground">Anggaran</span>
                  <span
                    className="tnum truncate font-bold whitespace-nowrap text-slate-900"
                    title={formatRupiah(rabTotals.anggaran)}
                  >
                    {formatRupiahCompact(rabTotals.anggaran)}
                  </span>
                </div>
                <div className="flex items-baseline justify-between gap-3">
                  <span className="text-sm text-muted-foreground">Realisasi</span>
                  <span
                    className="tnum truncate font-bold whitespace-nowrap text-slate-900"
                    title={formatRupiah(rabTotals.realisasi)}
                  >
                    {formatRupiahCompact(rabTotals.realisasi)}
                  </span>
                </div>
                <div className="flex items-baseline justify-between gap-3">
                  <span className="text-sm text-muted-foreground">Terpakai</span>
                  <Badge tone={rabPercent !== null && rabPercent > 100 ? 'danger' : 'info'}>
                    {rabPercent === null ? '—' : `${rabPercent.toFixed(1)}%`}
                  </Badge>
                </div>
                <Link
                  href="/financial/rab"
                  className="mt-1 text-xs font-bold text-primary hover:underline"
                >
                  Rincian per kode akun
                </Link>
              </div>
            </CardContent>
          </Card>
        </div>
      )}
    </>
  )
}
