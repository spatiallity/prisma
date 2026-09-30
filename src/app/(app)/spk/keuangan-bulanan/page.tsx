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
  const year = years.includes(requestedYear) ? requestedYear : years[0]
  const byMonth = new Map((data ?? []).map((row) => [row.bulan.slice(0, 7), row]))

  const months: MonthlyFinancePoint[] = Array.from({ length: 12 }, (_, index) => {
    const key = `${year}-${String(index + 1).padStart(2, '0')}`
    const row = byMonth.get(key)
    return {
      month: key,
      label: formatMonthLabel(`${key}-01`),
      shortLabel: formatMonthLabelShort(`${key}-01`).replace(/\s+\d{4}$/, ''),
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

  return (
    <>
      <PageHeader
        title="Pendapatan & Pengeluaran Bulanan"
        description="Opname, SPK terbit, dan seluruh pengeluaran berdasarkan bulan pencatatannya."
        actions={
          <form action="/spk/keuangan-bulanan" className="flex items-center gap-2">
            <label htmlFor="tahun" className="text-sm font-semibold text-slate-600">Tahun</label>
            <Select id="tahun" name="tahun" defaultValue={year} className="w-28" aria-label="Pilih tahun">
              {years.map((option) => <option key={option} value={option}>{option}</option>)}
            </Select>
            <button type="submit" className="h-10 rounded-md bg-primary px-4 text-sm font-bold text-white hover:bg-primary-hover">
              Tampilkan
            </button>
          </form>
        }
      />

      <div className="mb-5 grid gap-4 md:grid-cols-3">
        {[
          { label: 'Pendapatan (Teropname)', value: totals.pendapatan, count: `${totals.jumlahOpname} SPK opname`, border: 'border-l-success' },
          { label: 'Nilai SPK Terbit', value: totals.nilaiSpk, count: `${totals.jumlahSpk} SPK`, border: 'border-l-info' },
          { label: 'Total Pengeluaran', value: totals.pengeluaran, count: 'Seluruh kategori expense', border: 'border-l-brand-orange' },
        ].map((item) => (
          <Card key={item.label} className={`border-l-4 ${item.border}`}>
            <CardContent className="min-w-0">
              <div className="text-xs font-bold text-slate-500">{item.label}</div>
              <div className="tnum mt-2 break-words text-2xl font-extrabold text-slate-900">{formatRupiah(item.value)}</div>
              <div className="mt-1 text-xs font-medium text-slate-500">{item.count}</div>
            </CardContent>
          </Card>
        ))}
      </div>

      <Card className="mb-5 overflow-hidden">
        <CardHeader>
          <div>
            <CardTitle>Perbandingan Bulanan {year}</CardTitle>
            <CardDescription>Nilai rupiah per bulan untuk tiga kelompok data.</CardDescription>
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
          <table className="w-full min-w-[750px] text-sm">
            <thead className="sticky top-0 z-10 bg-slate-50 text-xs font-bold text-slate-600 uppercase">
              <tr className="border-b border-slate-200">
                <th scope="col" className="px-5 py-3 text-left">Bulan</th>
                <th scope="col" className="px-5 py-3 text-right">Pendapatan (Opname)</th>
                <th scope="col" className="px-5 py-3 text-right">Nilai SPK Terbit</th>
                <th scope="col" className="px-5 py-3 text-right">Pengeluaran</th>
              </tr>
            </thead>
            <tbody>
              {months.map((month) => (
                <tr key={month.month} className="border-b border-slate-100 last:border-0 hover:bg-slate-50">
                  <th scope="row" className="px-5 py-3 text-left font-semibold text-slate-900">{month.label}</th>
                  <td className="tnum px-5 py-3 text-right">{formatRupiah(month.pendapatan)}</td>
                  <td className="tnum px-5 py-3 text-right">{formatRupiah(month.nilaiSpk)}</td>
                  <td className="tnum px-5 py-3 text-right">{formatRupiah(month.pengeluaran)}</td>
                </tr>
              ))}
            </tbody>
            <tfoot className="border-t-2 border-slate-200 bg-slate-50 font-bold text-slate-900">
              <tr>
                <th scope="row" className="px-5 py-3 text-left">Total {year}</th>
                <td className="tnum px-5 py-3 text-right">{formatRupiah(totals.pendapatan)}</td>
                <td className="tnum px-5 py-3 text-right">{formatRupiah(totals.nilaiSpk)}</td>
                <td className="tnum px-5 py-3 text-right">{formatRupiah(totals.pengeluaran)}</td>
              </tr>
            </tfoot>
          </table>
        </div>
      </Card>
    </>
  )
}
