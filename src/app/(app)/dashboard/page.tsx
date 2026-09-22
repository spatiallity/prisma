import type { Metadata } from 'next'
import Link from 'next/link'
import {
  FolderKanban,
  Workflow,
  CheckCircle2,
  Map as MapIcon,
  PencilRuler,
  Route,
  LockKeyhole,
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
import { daysLeft } from '@/lib/spk'
import { loadStageBySpk } from '@/lib/spk-stage'
import { SEVERITY_RANK, formatMetric } from '@/lib/dashboard'
import { filterLeafAccounts, formatMonthLabel } from '@/lib/financial'
import { PHASE_LABEL, PHASE_STAGES, stageDisplayLabel } from '@/lib/design'
import { classifySpkProgress, type SpkProgressBucket } from '@/lib/spk-progress'
import type { DesignStage, RoutingLeadTimeView } from '@/lib/supabase/types'
import { ContractAbsorptionChart, RabDonutChart, TopCategoriesChart, DesignStageChart } from './dashboard-charts'
import { EqualHeightRow } from './equal-height-row'

export const metadata: Metadata = { title: 'Dashboard' }

const TOP_SCR_CONTRACT_VALUE = 14_562_975_000

type DesignSummary = { phase: 'siteplan' | 'finalisasi'; current_stage: DesignStage; updated_at: string }

/**
 * Section 9's "reason" strings read fine in the full Bottleneck Monitoring
 * table (SPK, area, and ukuran are their own columns there), but this card
 * shows nothing but the sentence, so it needs to actually say what happened.
 * The three reasons that dominate the list (Opname/PAD/stuck design stage)
 * get a real rewrite using data already loaded for the rest of the page; the
 * remaining reasons fall back to a plain "SPK X — reason" line.
 */
function describeBottleneck(
  item: {
    reason: string
    spk_id: string | null
    spk_number: string | null
    site_code: string | null
    metric: number | null
  },
  designsBySpk: Map<string, DesignSummary[]>,
  opnameMarkedAtBySpk: Map<string, string | null>,
) {
  const code = item.site_code ?? item.spk_number ?? 'SPK'
  const designs = item.spk_id ? (designsBySpk.get(item.spk_id) ?? []) : []

  if (item.reason === 'Belum opname') {
    const siteplan = designs.find((d) => d.phase === 'siteplan')
    return siteplan
      ? `SPK ${code} belum diopname (Desain Siteplan selesai ${formatDate(siteplan.updated_at)})`
      : `SPK ${code} belum diopname — Desain Siteplan belum dibuka`
  }

  if (item.reason === 'Belum PAD') {
    const opnameDate = item.spk_id ? opnameMarkedAtBySpk.get(item.spk_id) : null
    return `SPK ${code} sudah Opname${opnameDate ? ` (${formatDate(opnameDate)})` : ''} tetapi belum PAD`
  }

  if (item.reason === 'Design tidak berubah status') {
    const stuck = designs.find((d) => d.current_stage !== 'Finish' && d.current_stage !== 'Review PIC Pertamina')
    const days = item.metric !== null ? Math.floor(item.metric) : null
    return stuck
      ? `SPK ${code} berada di tahap ${stageDisplayLabel(stuck.current_stage)} (mulai ${formatDate(stuck.updated_at)})${days !== null ? ` — ${days} hari` : ''}`
      : `SPK ${code} — ${item.reason}`
  }

  const metricText = formatMetric(item.reason, item.metric)
  return `SPK ${code} — ${item.reason}${metricText ? ` · ${metricText}` : ''}`
}

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
  const seeRabBudget = seeFinance && !['administration', 'tester'].includes(user.role.code)
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
    { data: invoicedInvoices },
    { data: routingDocuments },
  ] = await Promise.all([
    supabase.from('v_dashboard_kpi').select('*').maybeSingle(),
    supabase.from('v_bottleneck').select('*'),
    supabase
      .from('spks')
      .select('*')
      .eq('status', 'On Going')
      .order('start_date', { ascending: false }),
    seeRabBudget
      ? supabase.from('v_finance_akun_summary').select('*')
      : Promise.resolve({ data: [] }),
    supabase
      .from('spks')
      .select('id, status, contract_value, opname_marked_at, opname_value, pad_marked_at, pad_value'),
    seeRabBudget
      ? supabase
          .from('finance_transactions')
          .select('kode_akun, jumlah')
          .eq('status', 'Active')
          .eq('bulan', currentBulan)
      : Promise.resolve({ data: [] }),
    // On-going design stage breakdown, and the field/design funnel counts
    // below, both read off the same Active-design snapshot.
    supabase.from('designs').select('spk_id, phase, current_stage, approved_at, updated_at').eq('status', 'Active'),
    supabase.from('v_routing_lead_time').select('*'),
    supabase.from('routing_templates').select('id').eq('status', 'Active').order('code'),
    seeFinance
      ? supabase.from('invoices').select('invoice_value').eq('status', 'Approved')
      : Promise.resolve({ data: [] }),
    supabase.from('spk_routing').select('spk_id'),
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

  const opnameMarkedAtBySpk = new Map((spkFunnel ?? []).map((s) => [s.id, s.opname_marked_at]))

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
  // on every SPK, Opname/PAD value only where actually marked, and Invoiced
  // value only from approved invoice records. This keeps the dashboard in
  // sync with the Financial tab's completion state.
  const nilaiSpkTotal = (spkFunnel ?? []).reduce((sum, s) => sum + Number(s.contract_value ?? 0), 0)
  const opnameTotal = (spkFunnel ?? [])
    .filter((s) => s.opname_marked_at)
    .reduce((sum, s) => sum + Number(s.opname_value ?? 0), 0)
  const padTotal = (spkFunnel ?? [])
    .filter((s) => s.pad_marked_at)
    .reduce((sum, s) => sum + Number(s.pad_value ?? 0), 0)
  const invoiceTotal = (invoicedInvoices ?? []).reduce((sum, invoice) => sum + Number(invoice.invoice_value ?? 0), 0)
  const expenseTotal = rabTotals.realisasi
  const labaRugiNilaiSpk = nilaiSpkTotal - expenseTotal
  const labaRugiOpname = opnameTotal - expenseTotal

  // Dashboard and Progress SPK deliberately share one mutually exclusive
  // classifier. The older dashboard independently counted active design and
  // routing rows, letting one SPK inflate two tiles and making the screens
  // disagree.
  const designsBySpk = new Map<string, DesignSummary[]>()
  for (const design of activeDesigns ?? []) {
    const list = designsBySpk.get(design.spk_id) ?? []
    list.push({ phase: design.phase, current_stage: design.current_stage, updated_at: design.updated_at })
    designsBySpk.set(design.spk_id, list)
  }
  const routedSpkIds = new Set((routingDocuments ?? []).map((document) => document.spk_id))
  const progressCounts = (onGoing ?? []).reduce<Record<SpkProgressBucket, number>>(
    (counts, spk) => {
      const bucket = classifySpkProgress(spk, designsBySpk.get(spk.id) ?? [], routedSpkIds.has(spk.id))
      counts[bucket] += 1
      return counts
    },
    { terestris: 0, desain_awal: 0, finalisasi: 0, invoicing: 0, selesai: 0 },
  )
  const fieldOnGoingCount = progressCounts.terestris
  const designOnGoingCount = progressCounts.desain_awal + progressCounts.finalisasi

  // The stage a routing document is actually sitting in: the first one not
  // finished — same read as Routing Monitor's own summary cards.
  const currentByRoutingDoc = new Map<string, RoutingLeadTimeView>()
  for (const row of leadTime ?? []) {
    if (row.status === 'Completed') continue
    const held = currentByRoutingDoc.get(row.spk_routing_id)
    if (!held || row.sequence < held.sequence) currentByRoutingDoc.set(row.spk_routing_id, row)
  }
  const routingStepCounts = new Map<string, number>()
  for (const current of currentByRoutingDoc.values()) {
    routingStepCounts.set(current.step_name, (routingStepCounts.get(current.step_name) ?? 0) + 1)
  }
  const routingStageChartData = (templateSteps ?? [])
    .map((step) => ({
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
    // Opname dropped from this chart — it's Siteplan's own terminal stage,
    // same reasoning as Acc PIC Pertamina below (approved_at excludes it
    // above already; not worth charting as a near-permanent 0/1).
    siteplan: PHASE_STAGES.siteplan
      .filter((stage) => stage !== 'Opname')
      .map((stage) => ({
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

  // Six SPK counts: the active funnel values reconcile exactly with the
  // five Progress SPK columns; Desain combines its two adjacent columns.
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
    { label: 'Design', value: designOnGoingCount, href: '/design', icon: PencilRuler, accent: 'navy' },
    { label: 'Invoicing', value: progressCounts.invoicing, href: '/routing', icon: Route, accent: 'orange' },
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
        <div className="mb-5 grid gap-5">
          <Card className="overflow-hidden">
            <CardHeader>
              <CardTitle>Nilai SPK</CardTitle>
            </CardHeader>
            <CardContent className="p-0">
              {/* Total sits beside the six metrics rather than above them —
                  at full width a lone figure on its own row left most of the
                  card empty. */}
              <div className="grid xl:grid-cols-[minmax(0,0.85fr)_minmax(0,2.15fr)]">
                <div className="border-b border-slate-100 px-5 py-5 xl:flex xl:flex-col xl:justify-center xl:border-r xl:border-b-0">
                  <div className="text-[11px] font-extrabold tracking-wider text-slate-500 uppercase">Total Nilai SPK</div>
                  <div className="tnum mt-1 text-3xl font-black text-slate-900">
                    {formatRupiah(nilaiSpkTotal)}
                  </div>
                </div>

                <div className="grid sm:grid-cols-3">
                  {[
                    { label: 'SPK Sudah Opname/BAST', detail: null, value: opnameTotal, tone: 'bg-info', valueTone: 'text-info' },
                    { label: 'PAD', detail: null, value: padTotal, tone: 'bg-warning', valueTone: 'text-warning' },
                    { label: 'Invoiced', detail: null, value: invoiceTotal, tone: 'bg-success', valueTone: 'text-success' },
                    { label: 'Total Pengeluaran', detail: null, value: expenseTotal, tone: 'bg-danger', valueTone: 'text-danger' },
                    {
                      label: 'Laba Rugi Nilai SPK',
                      detail: 'Nilai SPK - Pengeluaran',
                      value: labaRugiNilaiSpk,
                      tone: labaRugiNilaiSpk < 0 ? 'bg-danger' : 'bg-success',
                      valueTone: labaRugiNilaiSpk < 0 ? 'text-danger' : 'text-success',
                    },
                    {
                      label: 'Laba Rugi Teropname',
                      detail: 'Teropname - Pengeluaran',
                      value: labaRugiOpname,
                      tone: labaRugiOpname < 0 ? 'bg-danger' : 'bg-success',
                      valueTone: labaRugiOpname < 0 ? 'text-danger' : 'text-success',
                    },
                  ].map((m, index) => (
                    <div
                      key={m.label}
                      className={cn(
                        'min-w-0 border-slate-100 px-4 py-3.5',
                        index > 0 && 'border-t',
                        index > 0 && index < 3 && 'sm:border-t-0',
                        index % 3 !== 0 && 'sm:border-l',
                      )}
                    >
                      <div className="flex items-center gap-2 text-[10px] font-extrabold tracking-wide text-slate-500 uppercase">
                        <span className={cn('h-1.5 w-1.5 shrink-0 rounded-full', m.tone)} />
                        {m.label}
                      </div>
                      {m.detail ? <div className="mt-0.5 truncate text-[10px] font-medium text-slate-400">{m.detail}</div> : null}
                      <div className={cn('tnum mt-2 text-sm font-black whitespace-nowrap', m.valueTone)}>
                        {formatRupiah(m.value)}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
              <div className="border-t border-slate-100 px-5 py-3">
                <Link href="/reports/financial" className="text-xs font-bold text-primary hover:underline">
                  Rincian per SPK
                </Link>
              </div>
            </CardContent>
          </Card>

          <div className="grid gap-5 xl:grid-cols-2">
            <Card className="flex h-full flex-col overflow-hidden">
              <CardHeader>
                <div>
                  <CardTitle>Ringkasan Kontrak</CardTitle>
                  <CardDescription>Serapan nilai kontrak Top SCR</CardDescription>
                </div>
              </CardHeader>
              <CardContent className="flex flex-1 flex-col justify-center p-5">
                <ContractAbsorptionChart capacity={TOP_SCR_CONTRACT_VALUE} issued={nilaiSpkTotal} />
              </CardContent>
            </Card>

            <Card className="flex h-full flex-col overflow-hidden">
              <CardHeader>
                <div>
                  <CardTitle>RAB — Anggaran vs Realisasi</CardTitle>
                  <CardDescription>{seeRabBudget ? `${rabLeaf.length} kode akun` : 'Akses anggaran dibatasi'}</CardDescription>
                </div>
              </CardHeader>
              {seeRabBudget ? (
                <CardContent className="grid flex-1 gap-5 p-5 sm:grid-cols-[0.9fr_1.1fr] sm:items-center">
                  <div className="flex justify-center border-b border-slate-100 pb-4 sm:border-r sm:border-b-0 sm:py-2 sm:pr-5 sm:pb-2">
                    <RabDonutChart anggaran={rabTotals.anggaran} realisasi={rabTotals.realisasi} />
                  </div>
                  <div className="grid gap-3">
                    <div className="flex items-baseline justify-between gap-3">
                      <span className="text-sm text-muted-foreground">Anggaran</span>
                      <span className="tnum font-bold whitespace-nowrap text-slate-900">
                        {formatRupiah(rabTotals.anggaran)}
                      </span>
                    </div>
                    <div className="flex items-baseline justify-between gap-3">
                      <span className="text-sm text-muted-foreground">Realisasi</span>
                      <span className="tnum font-bold whitespace-nowrap text-slate-900">
                        {formatRupiah(rabTotals.realisasi)}
                      </span>
                    </div>
                    <div className="flex items-baseline justify-between gap-3 border-t border-slate-100 pt-3">
                      <span className="text-sm text-muted-foreground">Terpakai</span>
                      <Badge tone={rabPercent !== null && rabPercent > 100 ? 'danger' : 'info'}>
                        {rabPercent === null ? '—' : `${rabPercent.toFixed(1)}%`}
                      </Badge>
                    </div>
                    <Link href="/financial/rab" className="w-fit text-xs font-bold text-primary hover:underline">
                      Rincian per kode akun
                    </Link>
                  </div>
                </CardContent>
              ) : (
                <CardContent className="flex min-h-48 flex-1 flex-col items-center justify-center gap-2 text-center">
                  <span className="grid h-10 w-10 place-items-center rounded-full bg-slate-100 text-slate-500">
                    <LockKeyhole size={18} aria-hidden />
                  </span>
                  <p className="text-sm font-bold text-slate-700">Data anggaran tidak tersedia untuk role ini.</p>
                </CardContent>
              )}
            </Card>
          </div>
        </div>
      ) : (
        <Card className="mb-5 overflow-hidden">
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
            <Card className="h-full transition-shadow hover:shadow-md">
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

      <EqualHeightRow
        left={
          <div className="grid content-start gap-5">
          <Card className="overflow-hidden">
            <CardHeader>
              <div>
                <CardTitle>SPK Sedang Berjalan</CardTitle>
                <CardDescription>Daftar pekerjaan aktif dan posisi tahap terakhirnya.</CardDescription>
              </div>
              <Link href="/spk" className="text-xs font-bold text-primary hover:underline">
                Semua SPK
              </Link>
            </CardHeader>

            {onGoing && onGoing.length > 0 ? (
              <div className="max-h-[420px] overflow-y-auto">
                <Table>
                  <thead>
                    <tr>
                      <Th className="sticky top-0 z-10">SPK</Th>
                      <Th className="sticky top-0 z-10">Pekerjaan</Th>
                      <Th className="sticky top-0 z-10">Periode</Th>
                      <Th className="sticky top-0 z-10">Tahapan</Th>
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
              </div>
            ) : (
              <EmptyState
                title="Belum ada SPK berjalan"
                description="SPK berstatus Sedang Berjalan akan muncul di sini."
              />
            )}
          </Card>

          <div className="grid gap-5 sm:grid-cols-2">
            <Card className="overflow-hidden">
              <CardHeader>
                <div>
                  <CardTitle>{PHASE_LABEL.siteplan}</CardTitle>
                  <CardDescription>Sebaran tahap yang sedang berjalan</CardDescription>
                </div>
              </CardHeader>
              <DesignStageChart data={designStageChartData.siteplan} linkBase="/design/siteplan" />
            </Card>
            <Card className="overflow-hidden">
              <CardHeader>
                <div>
                  <CardTitle>{PHASE_LABEL.finalisasi}</CardTitle>
                  <CardDescription>Sebaran tahap yang sedang berjalan</CardDescription>
                </div>
              </CardHeader>
              <DesignStageChart data={designStageChartData.finalisasi} linkBase="/design/finalisasi" />
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
          </div>
        }
        right={
          <Card className="flex h-full min-h-0 flex-col overflow-hidden">
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
              <ul className="min-h-0 flex-1 divide-y divide-slate-100 overflow-y-auto">
                {ranked.map((item, index) => (
                  <li
                    key={`${item.reason}-${item.spk_id ?? 'none'}-${index}`}
                    className="flex items-stretch gap-3 px-5 py-3"
                  >
                    <span
                      className={cn(
                        'w-1 shrink-0 rounded-full',
                        item.severity === 'critical'
                          ? 'bg-danger'
                          : item.severity === 'warning'
                            ? 'bg-warning'
                            : 'bg-info',
                      )}
                      aria-hidden
                    />
                    <p className="min-w-0 flex-1 text-sm font-semibold text-slate-900">
                      {describeBottleneck(item, designsBySpk, opnameMarkedAtBySpk)}
                    </p>
                  </li>
                ))}
              </ul>
              <div className="shrink-0 border-t border-slate-100 px-5 py-3">
                <Link
                  href="/dashboard/bottleneck"
                  className="text-xs font-bold text-primary hover:underline"
                >
                  Detail & ambang batas
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
        }
      />

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
