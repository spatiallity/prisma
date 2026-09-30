import type { Metadata } from 'next'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Select } from '@/components/ui/field'
import { PageHeader } from '@/components/ui/page-header'
import { requirePermission } from '@/lib/auth/session'
import { formatMonthLabel, formatMonthLabelShort } from '@/lib/financial'
import { createClient } from '@/lib/supabase/server'
import { formatRupiah } from '@/lib/utils'
import { MonthlyFinanceChart, type MonthlyFinancePoint } from './monthly-finance-chart'

export const metadata: Metadata = { title: 'Pendapatan & Pengeluaran Bulanan' }

export default async function MonthlyFinancePage({
  searchParams,
}: {
  searchParams: Promise<{ tahun?: string }>
}) {
  await requirePermission('spk', 'view')
  await requirePermission('spending', 'view')

  const supabase = await createClient()
  const { data, error } = await supabase
    .from('v_spk_monthly_finance')
    .select('bulan, pendapatan, nilai_spk, pengeluaran, jumlah_spk, jumlah_opname')
    .order('bulan')
  if (error) throw new Error(`Ringkasan bulanan tidak dapat dimuat: ${error.message}`)

  const currentYear = new Date().getFullYear()
  const years = [...new Set([currentYear, ...(data ?? []).map((row) => Number(row.bulan.slice(0, 4)))])]
    .filter(Number.isFinite)
    .sort((a, b) => b - a)
  const requestedYear = Number((await searchParams).tahun)
  const year = years.includes(requestedYear) ? requestedYear : null
  const byMonth = new Map((data ?? []).map((row) => [row.bulan.slice(0, 7), row]))

  const sortedMonths = [...byMonth.keys()].sort()
  const monthKeys = year || !sortedMonths.length
    ? Array.from({ length: 12 }, (_, index) => `${String(year ?? currentYear).padStart(4, '0')}-${String(index + 1).padStart(2, '0')}`)
    : sortedMonths
  const unusualMonths = sortedMonths.filter((month) => {
    const monthYear = Number(month.slice(0, 4))
    return monthYear < 2000 && (!year || year === monthYear)
  })
  const months: MonthlyFinancePoint[] = monthKeys.map((key) => {
    const row = byMonth.get(key)
    return {
      month: key,
      label: formatMonthLabel(`${key}-01`),
      shortLabel: year
        ? formatMonthLabelShort(`${key}-01`).replace(/\s+\d{4}$/, '')
        : formatMonthLabelShort(`${key}-01`).replace(/\s+\d{2}(\d{2})$/, " '$1"),
      pendapatan: Number(row?.pendapatan ?? 0),
      nilaiSpk: Number(row?.nilai_spk ?? 0),
      pengeluaran: Number(row?.pengeluaran ?? 0),
      jumlahSpk: Number(row?.jumlah_spk ?? 0),
      jumlahOpname: Number(row?.jumlah_opname ?? 0),
    }
  })

  const totals = months.reduce(
    (sum, month) => ({
      pendapatan: sum.pendapatan + month.pendapatan,
      nilaiSpk: sum.nilaiSpk + month.nilaiSpk,
      pengeluaran: sum.pengeluaran + month.pengeluaran,
      jumlahSpk: sum.jumlahSpk + month.jumlahSpk,
      jumlahOpname: sum.jumlahOpname + month.jumlahOpname,
    }),
    { pendapatan: 0, nilaiSpk: 0, pengeluaran: 0, jumlahSpk: 0, jumlahOpname: 0 },
  )
  const difference = totals.pendapatan - totals.pengeluaran

  return (
    <>
      <PageHeader
        title="Pendapatan & Pengeluaran Bulanan"
        description="Opname, SPK terbit, dan seluruh pengeluaran berdasarkan bulan pencatatannya."
        actions={
          <form action="/spk/keuangan-bulanan" className="flex items-center gap-2">
            <label htmlFor="tahun" className="text-sm font-semibold text-slate-600">Tahun</label>
            <Select id="tahun" name="tahun" defaultValue={year ?? ''} className="w-36" aria-label="Pilih tahun">
              <option value="">Semua tahun</option>
              {years.map((option) => <option key={option} value={option}>{option}</option>)}
            </Select>
            <button type="submit" className="h-10 rounded-md bg-primary px-4 text-sm font-bold text-white hover:bg-primary-hover">
              Tampilkan
            </button>
          </form>
        }
      />

      {unusualMonths.length > 0 && (
        <div role="alert" className="mb-5 rounded-md border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">
          Ada {unusualMonths.length} bulan data sebelum tahun 2000. Periksa tanggal transaksinya; nilainya tetap dihitung dalam ringkasan.
        </div>
      )}

      <div className="mb-5 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {[
          { label: 'Pendapatan (Teropname)', value: totals.pendapatan, count: `${totals.jumlahOpname} SPK opname`, border: 'border-l-primary', color: 'text-slate-900' },
          { label: 'Nilai SPK Terbit', value: totals.nilaiSpk, count: `${totals.jumlahSpk} SPK`, border: 'border-l-info', color: 'text-slate-900' },
          { label: 'Total Pengeluaran', value: totals.pengeluaran, count: 'Seluruh kategori expense', border: 'border-l-brand-orange', color: 'text-slate-900' },
          { label: 'Selisih Opname - Pengeluaran', value: difference, count: 'Pendapatan teropname dikurangi pengeluaran', border: difference < 0 ? 'border-l-danger' : 'border-l-primary', color: difference < 0 ? 'text-danger' : 'text-success' },
        ].map((item) => (
          <Card key={item.label} className={`border-l-4 ${item.border}`}>
            <CardContent className="min-w-0">
              <div className="text-xs font-bold text-slate-500">{item.label}</div>
              <div className={`tnum mt-2 break-words text-xl font-extrabold 2xl:text-2xl ${item.color}`}>{formatRupiah(item.value)}</div>
              <div className="mt-1 text-xs font-medium text-slate-500">{item.count}</div>
            </CardContent>
          </Card>
        ))}
      </div>

      <Card className="mb-5 overflow-hidden">
        <CardHeader>
          <div>
            <CardTitle>Perbandingan Bulanan {year ?? 'Semua Tahun'}</CardTitle>
            <CardDescription>Nilai rupiah per bulan untuk tiga kelompok data{year ? '.' : ' yang tercatat.'}</CardDescription>
          </div>
        </CardHeader>
        <CardContent className="overflow-x-auto px-2 pb-3 sm:px-5">
          <MonthlyFinanceChart data={months} />
        </CardContent>
      </Card>

      <Card className="overflow-hidden">
        <CardHeader>
          <div>
            <CardTitle>Rincian per Bulan</CardTitle>
            <CardDescription>SPK Draft dan dibatalkan tidak masuk nilai SPK terbit.</CardDescription>
          </div>
        </CardHeader>
        <div className="overflow-x-auto">
          <table className="w-full min-w-[950px] text-sm">
            <thead className="sticky top-0 z-10 bg-slate-50 text-xs font-bold text-slate-600 uppercase">
              <tr className="border-b border-slate-200">
                <th scope="col" className="px-5 py-3 text-left">Bulan</th>
                <th scope="col" className="px-5 py-3 text-right">Pendapatan (Opname)</th>
                <th scope="col" className="px-5 py-3 text-right">Nilai SPK Terbit</th>
                <th scope="col" className="px-5 py-3 text-right">Pengeluaran</th>
                <th scope="col" className="px-5 py-3 text-right">Selisih Opname - Pengeluaran</th>
              </tr>
            </thead>
            <tbody>
              {months.map((month) => (
                <tr key={month.month} className="border-b border-slate-100 last:border-0 hover:bg-slate-50">
                  <th scope="row" className="px-5 py-3 text-left font-semibold text-slate-900">{month.label}</th>
                  <td className="tnum px-5 py-3 text-right">{formatRupiah(month.pendapatan)}</td>
                  <td className="tnum px-5 py-3 text-right">{formatRupiah(month.nilaiSpk)}</td>
                  <td className="tnum px-5 py-3 text-right">{formatRupiah(month.pengeluaran)}</td>
                  <td className={`tnum px-5 py-3 text-right font-semibold ${month.pendapatan - month.pengeluaran < 0 ? 'text-danger' : 'text-success'}`}>{formatRupiah(month.pendapatan - month.pengeluaran)}</td>
                </tr>
              ))}
            </tbody>
            <tfoot className="border-t-2 border-slate-200 bg-slate-50 font-bold text-slate-900">
              <tr>
                <th scope="row" className="px-5 py-3 text-left">Total {year ?? 'Seluruh Tahun'}</th>
                <td className="tnum px-5 py-3 text-right">{formatRupiah(totals.pendapatan)}</td>
                <td className="tnum px-5 py-3 text-right">{formatRupiah(totals.nilaiSpk)}</td>
                <td className="tnum px-5 py-3 text-right">{formatRupiah(totals.pengeluaran)}</td>
                <td className={`tnum px-5 py-3 text-right ${difference < 0 ? 'text-danger' : 'text-success'}`}>{formatRupiah(difference)}</td>
              </tr>
            </tfoot>
          </table>
        </div>
      </Card>
    </>
  )
}
