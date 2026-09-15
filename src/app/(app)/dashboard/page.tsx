import type { Metadata } from 'next'
import Link from 'next/link'
import {
  FolderKanban,
  Workflow,
  CheckCircle2,
  Map as MapIcon,
  PencilRuler,
  Route,
  type LucideIcon,
} from 'lucide-react'
import { PageHeader, EmptyState } from '@/components/ui/page-header'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Table, Td, Th, Tr } from '@/components/ui/table'
import { SpkCell } from '@/components/ui/spk-cell'
import { requireUser } from '@/lib/auth/session'
import { createClient } from '@/lib/supabase/server'
import { can } from '@/lib/auth/permissions'
import { cn, formatDate, formatDateTime, formatRupiah } from '@/lib/utils'
import { daysLeft, spkStatusLabel } from '@/lib/spk'
import { loadStageBySpk } from '@/lib/spk-stage'
import { SEVERITY_RANK, formatMetric } from '@/lib/dashboard'
import { filterLeafAccounts, formatMonthLabel } from '@/lib/financial'
import { PHASE_LABEL, PHASE_STAGES, stageDisplayLabel } from '@/lib/design'
import type { SpkStatus, DesignStage, RoutingLeadTimeView } from '@/lib/supabase/types'
import { RabDonutChart, SpkStatusChart, TopCategoriesChart, DesignStageChart } from './dashboard-charts'

export const metadata: Metadata = { title: 'Dashboard' }

/**
 * Section 8 — rebuilt around one question first: what is the SPK book
 * actually worth, how much of that has turned into Opname/PAD/Invoice, and
 * where that leaves the project against what's been spent. Everything else
 * (field/design/routing pipeline, bottleneck) supports that headline. Every
 * figure is read live off spks/designs/spk_routing/routing_history/finance;
 * none of it is entered here.
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
    { data: onGoing },
    { data: akunSummary },
    { data: spkFunnel },
    { data: monthTx },
    { data: activeDesigns },
    { data: leadTime },
    { data: templates },
    { data: invoicedSteps },
  ] = await Promise.all([
    supabase.from('v_dashboard_kpi').select('*').maybeSingle(),
    supabase.from('v_bottleneck').select('*'),
    supabase
      .from('spks')
      .select('*')
      .eq('status', 'On Going')
      .order('start_date', { ascending: false })
      .limit(6),
    seeFinance
      ? supabase.from('v_finance_akun_summary').select('*')
      : Promise.resolve({ data: [] }),
    supabase
      .from('spks')
      .select('id, status, contract_value, opname_marked_at, opname_value, pad_marked_at, pad_value'),
    seeFinance
      ? supabase
          .from('finance_transactions')
          .select('kode_akun, jumlah')
          .eq('status', 'Active')
          .eq('bulan', currentBulan)
      : Promise.resolve({ data: [] }),
    // On-going design stage breakdown, and the field/design funnel counts
    // below, both read off the same Active-design snapshot.
    supabase.from('designs').select('spk_id, phase, current_stage, approved_at').eq('status', 'Active'),
    supabase.from('v_routing_lead_time').select('*'),
    supabase.from('routing_templates').select('id').eq('status', 'Active').order('code'),
    seeFinance
      ? supabase.from('routing_history').select('invoice_value').eq('step_name', 'Invoiced')
      : Promise.resolve({ data: [] }),
  ])

  const stageBySpk = await loadStageBySpk(supabase, onGoing ?? [])
  const defaultTemplateId = templates?.[0]?.id ?? null
  const { data: templateSteps } = defaultTemplateId
    ? await supabase
        .from('routing_template_steps')
        .select('name, sequence')
        .eq('template_id', defaultTemplateId)
        .order('sequence')
    : { data: [] }

  const statusCounts = new Map<string, number>()
  for (const row of spkFunnel ?? []) {
    statusCounts.set(row.status, (statusCounts.get(row.status) ?? 0) + 1)
  }
  const spkStatusOrder: SpkStatus[] = ['Draft', 'On Going', 'Selesai', 'Archived', 'Cancelled']
  const spkStatusChartData = spkStatusOrder.map(
    (status) => ({ status, label: spkStatusLabel(status), count: statusCounts.get(status) ?? 0 }),
  )

  // Section 8.1 — total realized spend across every RAB account, all-time
  // (not just this month) — computed here, ahead of the money headline
  // below, since Laba Rugi needs it.
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

  // Section 8.2 — the headline: money, by milestone reached. Contract value
  // on every SPK, Opname/PAD value only where actually marked, Invoice value
  // read straight off the routing document's own Invoiced step (same source
  // Financial Report uses) rather than the deprecated standalone invoices
  // table. Laba Rugi is what Opname says the work is worth minus what's
  // actually been spent getting there.
  const nilaiSpkTotal = (spkFunnel ?? []).reduce((sum, s) => sum + Number(s.contract_value ?? 0), 0)
  const opnameTotal = (spkFunnel ?? [])
    .filter((s) => s.opname_marked_at)
    .reduce((sum, s) => sum + Number(s.opname_value ?? 0), 0)
  const padTotal = (spkFunnel ?? [])
    .filter((s) => s.pad_marked_at)
    .reduce((sum, s) => sum + Number(s.pad_value ?? 0), 0)
  const invoiceTotal = (invoicedSteps ?? []).reduce((sum, h) => sum + Number(h.invoice_value ?? 0), 0)
  const expenseTotal = rabTotals.realisasi
  const labaRugi = nilaiSpkTotal - expenseTotal

  // Section 8.3 — one funnel stage per SPK: still out in the field (no
  // Desain Siteplan opened yet), in Design (an Active design not yet
  // approved), or in Routing/Invoicing (a document not yet Completed).
  // Deliberately not mutually exclusive across the three the way status
  // counts are — an SPK reads as "in design" the whole time its design sits
  // open regardless of where routing is, which is exactly what "sedang
  // masuk desain" is asking.
  const siteplanOpenedSpkIds = new Set(
    (activeDesigns ?? []).filter((d) => d.phase === 'siteplan').map((d) => d.spk_id),
  )
  const fieldOnGoingCount = (spkFunnel ?? []).filter(
    (s) => s.status === 'On Going' && !siteplanOpenedSpkIds.has(s.id),
  ).length
  const designOnGoingSpkIds = new Set(
    (activeDesigns ?? []).filter((d) => d.approved_at === null).map((d) => d.spk_id),
  )
  const designOnGoingCount = designOnGoingSpkIds.size

  // The stage a routing document is actually sitting in: the first one not
  // finished — same read as Routing Monitor's own summary cards.
  const currentByRoutingDoc = new Map<string, RoutingLeadTimeView>()
  for (const row of leadTime ?? []) {
    if (row.status === 'Completed') continue
    const held = currentByRoutingDoc.get(row.spk_routing_id)
    if (!held || row.sequence < held.sequence) currentByRoutingDoc.set(row.spk_routing_id, row)
  }
  const routingOnGoingCount = currentByRoutingDoc.size

  const routingStepCounts = new Map<string, number>()
  for (const current of currentByRoutingDoc.values()) {
    routingStepCounts.set(current.step_name, (routingStepCounts.get(current.step_name) ?? 0) + 1)
  }
  const routingStageChartData = (templateSteps ?? []).map((step) => ({
    label: step.name,
    count: routingStepCounts.get(step.name) ?? 0,
  }))

  // Section 8.4 — how many on-going designs sit at each stage, siteplan and
  // finalisasi charted side by side (finalisasi only exists once siteplan is
  // Finish, so its counts are naturally the smaller, later half).
  const stageCounts = new Map<string, number>()
  for (const d of activeDesigns ?? []) {
    if (d.approved_at !== null) continue
    stageCounts.set(d.current_stage, (stageCounts.get(d.current_stage) ?? 0) + 1)
  }
  const designStageChartData: Record<'siteplan' | 'finalisasi', { stage: DesignStage; label: string; count: number }[]> = {
    // Opname stays in the list — reaching it doesn't set approved_at on its
    // own, so it can genuinely sit open awaiting Tanggal selesai.
    siteplan: PHASE_STAGES.siteplan.map((stage) => ({
      stage,
      label: stageDisplayLabel(stage),
      count: stageCounts.get(stage) ?? 0,
    })),
    // Acc PIC Pertamina always sets approved_at the moment it's reached, so
    // it never shows up here — dropped rather than charted as a dead 0.
    finalisasi: PHASE_STAGES.finalisasi
      .filter((stage) => stage !== 'Acc PIC Pertamina')
      .map((stage) => ({ stage, label: stage, count: stageCounts.get(stage) ?? 0 })),
  }

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

  // Section 8.5 — six SPK counts: overall book, then the three funnel
  // stages (field/design/routing), not mutually exclusive with each other.
  const tiles: {
    label: string
    value: number
    href: string
    icon: LucideIcon
    accent: 'primary' | 'info' | 'navy' | 'gold' | 'orange'
  }[] = [
    { label: 'Total SPK', value: kpi?.total_spk ?? 0, href: '/spk', icon: FolderKanban, accent: 'primary' },
    { label: 'On Going', value: kpi?.spk_on_going ?? 0, href: '/spk?status=ongoing', icon: Workflow, accent: 'gold' },
    { label: 'Survei Terestris', value: fieldOnGoingCount, href: '/spk?status=ongoing', icon: MapIcon, accent: 'info' },
    { label: 'Design Siteplan', value: designOnGoingCount, href: '/design', icon: PencilRuler, accent: 'navy' },
    { label: 'Invoicing', value: routingOnGoingCount, href: '/routing', icon: Route, accent: 'orange' },
    { label: 'Invoiced', value: kpi?.spk_selesai ?? 0, href: '/spk?status=selesai', icon: CheckCircle2, accent: 'primary' },
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

      {seeFinance ? (
        <div className="mb-5 grid gap-5 lg:grid-cols-2">
          <Card className="overflow-hidden rounded-2xl">
            <CardHeader>
              <div>
                <CardTitle>Nilai SPK</CardTitle>
              </div>
            </CardHeader>
            <CardContent className="grid content-start gap-4">
              <div>
                <div className="text-xs font-extrabold tracking-wider text-slate-500 uppercase">Total Nilai SPK</div>
                <div className="tnum mt-1 text-4xl font-black text-slate-900">
                  {formatRupiah(nilaiSpkTotal)}
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4 sm:grid-cols-3">
                {[
                  { label: 'Opname', value: opnameTotal, tone: 'text-info' },
                  { label: 'PAD', value: padTotal, tone: 'text-warning' },
                  { label: 'Invoice', value: invoiceTotal, tone: 'text-success' },
                  { label: 'Total Expense', value: expenseTotal, tone: 'text-danger' },
                  {
                    label: 'Posisi Laba Rugi',
                    value: labaRugi,
                    tone: labaRugi < 0 ? 'text-danger' : 'text-success',
                  },
                ].map((m) => (
                  <div key={m.label}>
                    <div className="text-[11px] font-bold text-muted-foreground uppercase">{m.label}</div>
                    <div className={cn('tnum mt-0.5 text-base font-black', m.tone)}>
                      {formatRupiah(m.value)}
                    </div>
                  </div>
                ))}
              </div>
              <Link href="/reports/financial" className="text-xs font-bold text-primary hover:underline">
                Rincian per SPK
              </Link>
            </CardContent>
          </Card>

          <Card className="overflow-hidden rounded-2xl">
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
                  <span className="tnum truncate font-bold whitespace-nowrap text-slate-900">
                    {formatRupiah(rabTotals.anggaran)}
                  </span>
                </div>
                <div className="flex items-baseline justify-between gap-3">
                  <span className="text-sm text-muted-foreground">Realisasi</span>
                  <span className="tnum truncate font-bold whitespace-nowrap text-slate-900">
                    {formatRupiah(rabTotals.realisasi)}
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
      ) : (
        <Card className="mb-5 overflow-hidden rounded-2xl">
          <CardContent className="p-5">
            <div className="text-xs font-extrabold tracking-wider text-slate-500 uppercase">Total SPK</div>
            <div className="tnum mt-1 text-4xl font-black text-slate-900">{kpi?.total_spk ?? 0}</div>
            <div className="mt-1 text-xs font-semibold text-muted-foreground">
              {kpi?.spk_on_going ?? 0} sedang berjalan · {kpi?.spk_selesai ?? 0} selesai
            </div>
          </CardContent>
        </Card>
      )}

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
              </CardContent>
            </Card>
          </Link>
        ))}
      </div>

      <div className="grid gap-5 lg:grid-cols-3">
        <div className="grid content-start gap-5 lg:col-span-2">
          <div className="grid gap-5 sm:grid-cols-2">
            <Card className="overflow-hidden">
              <CardHeader>
                <div>
                  <CardTitle>{PHASE_LABEL.siteplan}</CardTitle>
                  <CardDescription>Sebaran tahap yang sedang berjalan</CardDescription>
                </div>
              </CardHeader>
              <DesignStageChart data={designStageChartData.siteplan} />
            </Card>
            <Card className="overflow-hidden">
              <CardHeader>
                <div>
                  <CardTitle>{PHASE_LABEL.finalisasi}</CardTitle>
                  <CardDescription>Sebaran tahap yang sedang berjalan</CardDescription>
                </div>
              </CardHeader>
              <DesignStageChart data={designStageChartData.finalisasi} />
            </Card>
          </div>

          <Card className="overflow-hidden">
            <CardHeader>
              <div>
                <CardTitle>Posisi Routing</CardTitle>
                <CardDescription>Dokumen belum Completed, per tahap</CardDescription>
              </div>
            </CardHeader>
            <DesignStageChart data={routingStageChartData} />
          </Card>

          <Card className="overflow-hidden">
            <CardHeader>
              <div>
                <CardTitle>SPK Sedang Berjalan</CardTitle>
              </div>
              <Link href="/spk" className="text-xs font-bold text-primary hover:underline">
                Semua SPK
              </Link>
            </CardHeader>

            {onGoing && onGoing.length > 0 ? (
              <Table>
                <thead>
                  <tr>
                    <Th>SPK</Th>
                    <Th>Pekerjaan</Th>
                    <Th>Periode</Th>
                    <Th>Tahapan</Th>
                  </tr>
                </thead>
                <tbody>
                  {onGoing.map((row) => {
                    const remaining = daysLeft(row.end_date)
                    const overdue = remaining !== null && remaining < 0
                    const stage = stageBySpk[row.id]
                    return (
                      <Tr key={row.id}>
                        <Td>
                          <SpkCell id={row.id} spkNumber={row.spk_number} siteCode={row.site_code} />
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
                        <Td className="text-muted-foreground">
                          {stage ? (
                            <>
                              <span className="font-bold text-slate-900">{stage.label}</span>
                              {stage.date && (
                                <div className="tnum text-xs">{formatDateTime(stage.date)}</div>
                              )}
                            </>
                          ) : (
                            '—'
                          )}
                        </Td>
                      </Tr>
                    )
                  })}
                </tbody>
              </Table>
            ) : (
              <EmptyState
                title="Belum ada SPK berjalan"
                description="SPK berstatus Sedang Berjalan akan muncul di sini."
              />
            )}
          </Card>
        </div>

        <div className="grid content-start gap-5">
          {(kpi?.total_spk ?? 0) > 0 && (
            <Card className="overflow-hidden">
              <CardHeader>
                <div>
                  <CardTitle>Sebaran status SPK</CardTitle>
                  <CardDescription>{kpi?.total_spk ?? 0} SPK aktif di luar yang dibatalkan</CardDescription>
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

      {seeFinance && topCategories.length > 0 && (
        <div className="mt-5">
          <Card className="overflow-hidden rounded-2xl">
            <CardHeader>
              <div>
                <CardTitle>Pengeluaran {formatMonthLabel(currentBulan)}</CardTitle>
                <CardDescription>
                  Total{' '}
                  <span className="tnum font-bold text-slate-900">
                    {formatRupiah(monthTotal)}
                  </span>{' '}
                  · top {topCategories.length} kategori
                </CardDescription>
              </div>
            </CardHeader>
            <TopCategoriesChart data={topCategories} />
          </Card>
        </div>
      )}
    </>
  )
}
