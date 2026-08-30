'use client'

import {
  Bar,
  BarChart,
  CartesianGrid,
  Legend,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts'
import { Card, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { formatRupiah } from '@/lib/utils'
import { formatMonthLabel } from '@/lib/financial'

const RUPIAH_AXIS = new Intl.NumberFormat('id-ID', {
  notation: 'compact',
  compactDisplay: 'short',
})

function CurrencyTooltip({
  active,
  payload,
  label,
}: {
  active?: boolean
  payload?: { name: string; value: number; color: string }[]
  label?: string
}) {
  if (!active || !payload?.length) return null
  return (
    <div className="rounded-lg border border-slate-200 bg-surface px-3 py-2 text-xs shadow-lg">
      <div className="mb-1 font-bold text-slate-900">{label}</div>
      {payload.map((entry) => (
        <div key={entry.name} className="flex items-center gap-2">
          <span
            className="h-2 w-2 rounded-full"
            style={{ backgroundColor: entry.color }}
            aria-hidden
          />
          <span className="text-muted-foreground">{entry.name}</span>
          <span className="tnum font-bold text-slate-900">{formatRupiah(entry.value)}</span>
        </div>
      ))}
    </div>
  )
}

export function MonthlySpendChart({
  data,
}: {
  data: { bulan: string; jumlah: number }[]
}) {
  const chartData = data.map((d) => ({ label: formatMonthLabel(d.bulan), jumlah: d.jumlah }))

  return (
    <Card className="mb-5 overflow-hidden">
      <CardHeader>
        <div>
          <CardTitle>Pengeluaran per bulan</CardTitle>
          <CardDescription>Realisasi seluruh kategori, dijumlah per bulan.</CardDescription>
        </div>
      </CardHeader>
      <div className="h-72 px-2 pt-4 pb-2 sm:px-5">
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={chartData} margin={{ top: 4, right: 8, left: 0, bottom: 4 }}>
            <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="var(--color-slate-100)" />
            <XAxis
              dataKey="label"
              tick={{ fontSize: 11 }}
              interval="preserveStartEnd"
              tickLine={false}
            />
            <YAxis
              tick={{ fontSize: 11 }}
              tickFormatter={(v) => RUPIAH_AXIS.format(v)}
              tickLine={false}
              axisLine={false}
              width={56}
            />
            <Tooltip content={<CurrencyTooltip />} cursor={{ fill: 'var(--color-slate-50)' }} />
            <Bar dataKey="jumlah" name="Realisasi" fill="var(--color-primary)" radius={[4, 4, 0, 0]} />
          </BarChart>
        </ResponsiveContainer>
      </div>
    </Card>
  )
}

export function AnggaranRealisasiChart({
  data,
}: {
  data: { kategori: string; anggaran: number; realisasi: number }[]
}) {
  return (
    <Card className="mb-5 overflow-hidden">
      <CardHeader>
        <div>
          <CardTitle>Anggaran vs Realisasi per kategori</CardTitle>
          <CardDescription>Akumulasi dari awal project, dikelompokkan per Roman.</CardDescription>
        </div>
      </CardHeader>
      <div className="h-72 px-2 pt-4 pb-2 sm:px-5">
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={data} margin={{ top: 4, right: 8, left: 0, bottom: 4 }}>
            <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="var(--color-slate-100)" />
            <XAxis dataKey="kategori" tick={{ fontSize: 11 }} tickLine={false} />
            <YAxis
              tick={{ fontSize: 11 }}
              tickFormatter={(v) => RUPIAH_AXIS.format(v)}
              tickLine={false}
              axisLine={false}
              width={56}
            />
            <Tooltip content={<CurrencyTooltip />} cursor={{ fill: 'var(--color-slate-50)' }} />
            <Legend wrapperStyle={{ fontSize: 12 }} />
            <Bar dataKey="anggaran" name="Anggaran" fill="var(--color-slate-300)" radius={[4, 4, 0, 0]} />
            <Bar dataKey="realisasi" name="Realisasi" fill="var(--color-primary)" radius={[4, 4, 0, 0]} />
          </BarChart>
        </ResponsiveContainer>
      </div>
    </Card>
  )
}
