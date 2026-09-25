import type { Metadata } from 'next'
import { PageHeader, EmptyState } from '@/components/ui/page-header'
import { Card, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { requirePermission } from '@/lib/auth/session'
import { createClient } from '@/lib/supabase/server'
import { can } from '@/lib/auth/permissions'
import { filterLeafAccounts, formatMonthLabel } from '@/lib/financial'
import { AddTransactionButton, DownloadRabButton } from './finance-form'
import { MonthFilter } from './month-filter'
import { MonthlySpendChart } from './rab-charts'
import { AkunSummaryTable, type AkunSummaryRow } from './akun-summary-table'
import { RabSummary } from './rab-summary'
import { FinanceTransactionsTable } from '../finance-transactions-table'

export const metadata: Metadata = { title: 'Monitoring RAB' }

/**
 * RAB Anggaran vs Realisasi — replaces the Monitoring RAB sheet's per-month
 * SUMIF columns. Every number here is read from a view (v_finance_akun_summary
 * / v_finance_realisasi_bulanan, migration 20260830000100); nothing is typed
 * by hand except the transactions themselves.
 *
 * "Seluruh bulan" is the project-to-date comparison (anggaran total vs
 * akumulasi realisasi). Picking one bulan shows that month's realisasi per
 * akun against an indicative average monthly rate — the source Excel never
 * phased anggaran by month, so a true monthly budget doesn't exist to compare
 * against; the average is labelled as such rather than presented as official.
 */
export default async function MonitoringRabPage({
  searchParams,
}: {
  searchParams: Promise<{ bulan?: string }>
}) {
  const { bulan } = await searchParams
  const user = await requirePermission('rab_monitoring', 'view')
  const mayEdit = can(user.permissions, 'rab_monitoring', 'edit')

  const supabase = await createClient()
  const [{ data: akunSummary }, { data: coa }, { data: bulananTotal }, { data: recent }, { data: bulanRealisasi }] =
    await Promise.all([
      supabase.from('v_finance_akun_summary').select('*').order('kode_akun'),
      supabase.from('chart_of_accounts').select('kode_akun, uraian, kategori_roman_label'),
      // Summed in Postgres, not fetched raw — finance_transactions already
      // has 1000+ Active rows, past Supabase's default unbounded-select cap,
      // so pulling every row client-side to sum per bulan silently dropped
      // whichever rows fell outside that cap (see migration
      // 20260922000100_finance_realisasi_bulanan_total).
      supabase.from('v_finance_realisasi_bulanan_total').select('bulan, realisasi').order('bulan'),
      bulan
        ? supabase
            .from('finance_transactions')
            .select('id, kategori, kode_akun, tanggal, tanggal_perjab, bulan, jumlah, deskripsi, no_bukti, personil_nama, jenis_detail, pj_nama, perjab, created_at, updated_at, created_by')
            .eq('status', 'Active')
            .eq('bulan', `${bulan}-01`)
            .order('created_at', { ascending: false })
        : supabase
            .from('finance_transactions')
            .select('id, kategori, kode_akun, tanggal, tanggal_perjab, bulan, jumlah, deskripsi, no_bukti, personil_nama, jenis_detail, pj_nama, perjab, created_at, updated_at, created_by')
            .eq('status', 'Active')
            // Not every historical row has a tanggal (some Excel tabs only ever
            // tracked the month) — order by insert recency here so every
            // kategori stays represented in the slice; the table itself
            // defaults its own sort to tanggal for display.
            .order('created_at', { ascending: false })
            .limit(100),
      // Only needed when a single bulan is picked — powers the per-akun
      // table and chart below switching from accumulated to that month.
      bulan
        ? supabase
            .from('v_finance_realisasi_bulanan')
            .select('kode_akun, realisasi')
            .eq('bulan', `${bulan}-01`)
        : Promise.resolve({ data: null }),
    ])

  const bulanRealisasiByAkun = new Map(
    (bulanRealisasi ?? []).map((r) => [r.kode_akun, Number(r.realisasi)]),
  )

  const months = (bulananTotal ?? []).map((r) => r.bulan).sort()
  const monthOptions = months.map((m) => m.slice(0, 7))

  const monthlySpend = (bulananTotal ?? [])
    .map((r) => ({ bulan: r.bulan, jumlah: Number(r.realisasi) }))
    .sort((a, b) => a.bulan.localeCompare(b.bulan))

  // Bulan filtered: realisasi (and the selisih derived from it) becomes that
  // month's spend per akun instead of the always-accumulated view value.
  const leafSummary: AkunSummaryRow[] = filterLeafAccounts(akunSummary ?? []).map((row) => {
    if (!bulan) return row
    const realisasi = bulanRealisasiByAkun.get(row.kode_akun) ?? 0
    const anggaran = Number(row.anggaran_rp ?? 0)
    return { ...row, realisasi_total: realisasi, selisih: anggaran - realisasi }
  })
  const totals = leafSummary.reduce(
    (acc, a) => ({
      anggaran: acc.anggaran + Number(a.anggaran_rp ?? 0),
      realisasi: acc.realisasi + Number(a.realisasi_total),
    }),
    { anggaran: 0, realisasi: 0 },
  )
  const sisa = totals.anggaran - totals.realisasi
  const percent = totals.anggaran > 0 ? (totals.realisasi / totals.anggaran) * 100 : null
  const averagePerMonth = months.length > 0 ? totals.anggaran / months.length : null

  const bulanRealisasiTotal = bulan
    ? (recent ?? []).reduce((sum, r) => sum + Number(r.jumlah), 0)
    : null

  const groupMap = new Map<string, AkunSummaryRow[]>()
  for (const row of leafSummary) {
    const key = row.kategori_roman_label ?? 'Lainnya'
    groupMap.set(key, [...(groupMap.get(key) ?? []), row])
  }
  const groups = [...groupMap.entries()].map(([label, rows]) => ({ label, rows }))

  const akunOptions = filterLeafAccounts(coa ?? []).sort((a, b) =>
    a.kode_akun.localeCompare(b.kode_akun),
  )

  const creatorIds = [
    ...new Set((recent ?? []).map((r) => r.created_by).filter(Boolean)),
  ] as string[]
  const { data: creators } = creatorIds.length
    ? await supabase.from('users').select('id, full_name').in('id', creatorIds)
    : { data: [] }
  const actorName = Object.fromEntries((creators ?? []).map((a) => [a.id, a.full_name]))

  const pjOptions = [
    ...new Set((recent ?? []).map((r) => r.pj_nama).filter((n): n is string => !!n)),
  ].sort((a, b) => a.localeCompare(b))

  return (
    <>
      <PageHeader
        title="Monitoring RAB"
        description="Anggaran vs Realisasi per kode akun — UMK, SPPD, PPBJ Barang, PPBJ Jasa, Gaji PTT Project, MCU dalam satu tabel transaksi."
        actions={
          <div className="flex flex-wrap items-center gap-2">
            <DownloadRabButton />
            {mayEdit && <AddTransactionButton akunOptions={akunOptions} pjOptions={pjOptions} />}
          </div>
        }
      />

      <div className="mb-4 flex items-center gap-3">
        <span className="text-xs font-extrabold tracking-wider text-slate-500 uppercase">
          Tampilan
        </span>
        <MonthFilter months={monthOptions} />
      </div>

      {bulan ? (
        <RabSummary
          periodLabel={`Realisasi ${formatMonthLabel(`${bulan}-01`)}`}
          progressLabel="vs rata-rata bulanan (indikatif)"
          percent={
            averagePerMonth && averagePerMonth > 0
              ? ((bulanRealisasiTotal ?? 0) / averagePerMonth) * 100
              : null
          }
          percentDanger={
            !!averagePerMonth && (bulanRealisasiTotal ?? 0) > averagePerMonth
          }
          stats={[
            { label: 'Anggaran (project)', value: totals.anggaran },
            {
              label: `Realisasi ${formatMonthLabel(`${bulan}-01`)}`,
              value: bulanRealisasiTotal ?? 0,
            },
            {
              label: 'Anggaran rata-rata/bulan',
              value: averagePerMonth,
              caption: `Indikatif — ÷ ${months.length} bulan berjalan`,
            },
            {
              label: 'Selisih vs rata-rata',
              value: averagePerMonth === null ? null : averagePerMonth - (bulanRealisasiTotal ?? 0),
              danger: averagePerMonth !== null && averagePerMonth - (bulanRealisasiTotal ?? 0) < 0,
            },
          ]}
        />
      ) : (
        <RabSummary
          periodLabel="Akumulasi dari awal project"
          progressLabel="Realisasi terhadap anggaran"
          percent={percent}
          percentDanger={percent !== null && percent > 100}
          stats={[
            { label: 'Anggaran (project)', value: totals.anggaran },
            { label: 'Realisasi (akumulasi)', value: totals.realisasi },
            { label: 'Sisa', value: sisa, danger: sisa < 0 },
            {
              label: 'Rata-rata realisasi/bulan',
              value: months.length > 0 ? totals.realisasi / months.length : null,
              caption:
                months.length > 0 ? `Berdasarkan ${months.length} bulan berjalan` : undefined,
            },
          ]}
        />
      )}

      {monthlySpend.length > 0 && <MonthlySpendChart data={monthlySpend} />}

      <Card className="mb-5 overflow-hidden">
        <CardHeader>
          <div>
            <CardTitle>Anggaran vs Realisasi per kode akun</CardTitle>
            <CardDescription>
              {bulan
                ? `Realisasi ${formatMonthLabel(`${bulan}-01`)} per kode akun — klik satu baris untuk lihat detail transaksinya.`
                : 'Akumulasi dari awal project — klik satu baris untuk lihat detail transaksinya.'}
            </CardDescription>
          </div>
        </CardHeader>
        {leafSummary.length > 0 ? (
          <AkunSummaryTable groups={groups} bulan={bulan} coa={coa ?? []} mayEdit={mayEdit} />
        ) : (
          <EmptyState
            title="Belum ada Chart of Accounts"
            description="Import Monitoring RAB belum dijalankan."
          />
        )}
      </Card>

      <Card className="mb-5 overflow-hidden">
        <CardHeader>
          <div>
            <CardTitle>
              {bulan ? `Transaksi ${formatMonthLabel(`${bulan}-01`)}` : 'Transaksi terbaru'}
            </CardTitle>
            <CardDescription>
              {bulan
                ? `${(recent ?? []).length} transaksi pada bulan ini.`
                : '100 transaksi terakhir dari seluruh kategori. Cari atau urutkan kolom apa saja.'}
            </CardDescription>
          </div>
        </CardHeader>
        <FinanceTransactionsTable
          rows={recent ?? []}
          coa={coa ?? []}
          mayEdit={mayEdit}
          showKategori
          emptyTitle="Belum ada transaksi"
          searchPlaceholder="Cari kategori, deskripsi, personel, kode akun…"
          actorName={actorName}
          pjOptions={pjOptions}
        />
      </Card>
    </>
  )
}
