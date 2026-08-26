import type { Metadata } from 'next'
import Link from 'next/link'
import { PageHeader, EmptyState } from '@/components/ui/page-header'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Table, Td, Th, Tr } from '@/components/ui/table'
import { requireUser } from '@/lib/auth/session'
import { createClient } from '@/lib/supabase/server'
import { can } from '@/lib/auth/permissions'
import { cn, formatDate, formatRupiah } from '@/lib/utils'
import { daysLeft, formatPercent } from '@/lib/spk'
import { UPDATE_STATUS_TONE } from '@/lib/schedule'
import { SEVERITY_RANK, formatMetric } from '@/lib/dashboard'
import { marginTone, formatPercentSigned } from '@/lib/financial'

export const metadata: Metadata = { title: 'Dashboard' }

/**
 * Section 8 — the dashboard answers four questions: how many SPK and at what
 * stage, what is being worked on today, what is stuck, and how the money
 * stands. Every figure is read from a view; none of it is entered.
 */
export default async function DashboardPage() {
  const user = await requireUser()
  const supabase = await createClient()

  const seeFinancial = can(user.permissions, 'margin', 'view')
  const seeSpending = can(user.permissions, 'spending', 'view')

  const [{ data: kpi }, { data: bottlenecks }, { data: today }, { data: progress }] =
    await Promise.all([
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
    ])

  const [{ data: margins }, { data: balance }] = await Promise.all([
    seeFinancial
      ? supabase.from('v_spk_margin').select('*')
      : Promise.resolve({ data: [] }),
    seeSpending
      ? supabase.from('v_cash_balance').select('*').maybeSingle()
      : Promise.resolve({ data: null }),
  ])

  const ranked = [...(bottlenecks ?? [])].sort(
    (a, b) => SEVERITY_RANK[a.severity] - SEVERITY_RANK[b.severity],
  )
  const critical = ranked.filter((b) => b.severity === 'critical').length

  const invoiced = (margins ?? []).filter((m) => Number(m.invoice_total) > 0)
  const totals = invoiced.reduce(
    (acc, m) => ({
      invoice: acc.invoice + Number(m.invoice_total),
      margin: acc.margin + Number(m.margin),
    }),
    { invoice: 0, margin: 0 },
  )
  const marginPercent = totals.invoice > 0 ? (totals.margin / totals.invoice) * 100 : null

  const updatedToday = (today ?? []).filter(
    (row) => row.update_status === 'Updated Today',
  ).length

  // Section 8.1 — the six headline counts, all derived.
  const tiles = [
    { label: 'Total SPK', value: kpi?.total_spk ?? 0, foot: `${kpi?.spk_selesai ?? 0} selesai`, href: '/spk' },
    { label: 'On Going', value: kpi?.spk_on_going ?? 0, foot: 'sedang berjalan', href: '/spk?status=ongoing' },
    { label: 'Masuk Routing', value: kpi?.spk_routing ?? 0, foot: 'punya dokumen dirutekan', href: '/routing' },
    { label: 'PAD', value: kpi?.spk_pad ?? 0, foot: 'sudah terbit PAD', href: '/financial/pad' },
    { label: 'Invoice', value: kpi?.spk_invoice ?? 0, foot: 'sudah ditagihkan', href: '/financial/invoice' },
    { label: 'Payment', value: kpi?.spk_payment ?? 0, foot: 'sudah dibayar', href: '/financial/payment' },
  ]

  return (
    <>
      <PageHeader
        title={`Selamat datang, ${user.fullName.split(' ')[0]}`}
        description={`Masuk sebagai ${user.role.name}. Semua angka di halaman ini dihitung dari database, tidak ada yang diketik.`}
      />

      <div className="mb-5 grid gap-4 sm:grid-cols-3 lg:grid-cols-6">
        {tiles.map((tile) => (
          <Link key={tile.label} href={tile.href}>
            <Card className="h-full transition-shadow hover:shadow-md">
              <CardContent className="p-4">
                <div className="truncate text-[11px] font-extrabold tracking-wider text-slate-500 uppercase">
                  {tile.label}
                </div>
                <div className="tnum mt-1 text-3xl font-black text-slate-900">
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
                <CardDescription>
                  Overall Progress = Σ (progress aktivitas × bobot), Section 15.
                </CardDescription>
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
                  <CardDescription>
                    Status dihitung dari ada tidaknya Daily Progress, bukan diisi.
                  </CardDescription>
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
          <Card className="overflow-hidden">
            <CardHeader>
              <div>
                <CardTitle>Bottleneck</CardTitle>
                <CardDescription>Terdeteksi otomatis, Section 9.</CardDescription>
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
                          {item.spk_number ?? 'Seluruh project'}
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
                description="Semua kondisi Section 9 dalam batas wajar."
              />
            )}
          </Card>

          {seeSpending && balance && (
            <Card>
              <CardHeader>
                <CardTitle>Kas kecil mess</CardTitle>
              </CardHeader>
              <CardContent>
                <div
                  className={cn(
                    'tnum text-2xl font-black',
                    Number(balance.balance) < 5_000_000 ? 'text-danger' : 'text-slate-900',
                  )}
                >
                  {formatRupiah(balance.balance)}
                </div>
                <div className="mt-1 text-xs text-muted-foreground">
                  Entri terakhir {formatDate(balance.last_entry_date)}
                </div>
                <Link
                  href="/financial/spending"
                  className="mt-3 inline-block text-xs font-bold text-primary hover:underline"
                >
                  Buka spending
                </Link>
              </CardContent>
            </Card>
          )}

          {seeFinancial && (
            <Card>
              <CardHeader>
                <div>
                  <CardTitle>Margin project</CardTitle>
                  <CardDescription>{invoiced.length} SPK sudah di-invoice</CardDescription>
                </div>
              </CardHeader>
              <CardContent className="grid gap-2">
                <div className="flex items-baseline justify-between gap-3">
                  <span className="text-sm text-muted-foreground">Invoice</span>
                  <span className="tnum font-bold text-slate-900">
                    {formatRupiah(totals.invoice)}
                  </span>
                </div>
                <div className="flex items-baseline justify-between gap-3">
                  <span className="text-sm text-muted-foreground">Margin</span>
                  <span
                    className={cn(
                      'tnum font-bold',
                      totals.margin < 0 ? 'text-danger' : 'text-success',
                    )}
                  >
                    {formatRupiah(totals.margin)}
                  </span>
                </div>
                <div className="flex items-baseline justify-between gap-3">
                  <span className="text-sm text-muted-foreground">Persentase</span>
                  <Badge tone={marginTone(marginPercent)}>
                    {formatPercentSigned(marginPercent)}
                  </Badge>
                </div>
                <Link
                  href="/financial/margin"
                  className="mt-1 text-xs font-bold text-primary hover:underline"
                >
                  Rincian per SPK
                </Link>
              </CardContent>
            </Card>
          )}
        </div>
      </div>
    </>
  )
}
