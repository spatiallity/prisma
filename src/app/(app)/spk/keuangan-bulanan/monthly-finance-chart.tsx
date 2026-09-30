'use client'

import { Bar, BarChart, CartesianGrid, Legend, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts'
import { formatRupiah, formatRupiahCompact } from '@/lib/utils'

export type MonthlyFinancePoint = {
  month: string
  label: string
  shortLabel: string
  pendapatan: number
  nilaiSpk: number
  pengeluaran: number
  jumlahSpk: number
  jumlahOpname: number
}

export function MonthlyFinanceChart({ data }: { data: MonthlyFinancePoint[] }) {
  return (
    <div className="h-80 min-w-[720px] pt-4">
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={data} margin={{ top: 4, right: 8, left: 0, bottom: 4 }} barGap={2}>
          <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="var(--color-slate-100)" />
          <XAxis dataKey="shortLabel" tick={{ fontSize: 11, fill: 'var(--color-slate-500)' }} tickLine={false} axisLine={false} />
          <YAxis tick={{ fontSize: 11, fill: 'var(--color-slate-500)' }} tickFormatter={formatRupiahCompact} tickLine={false} axisLine={false} width={74} />
          <Tooltip
            labelFormatter={(_label, payload) => payload?.[0]?.payload?.label ?? ''}
            formatter={(value, name) => [formatRupiah(Number(value)), String(name)]}
            contentStyle={{ borderRadius: 8, borderColor: 'var(--color-slate-200)', fontSize: 12 }}
            cursor={{ fill: 'var(--color-slate-50)' }}
          />
          <Legend wrapperStyle={{ fontSize: 12 }} />
          <Bar dataKey="pendapatan" name="Pendapatan (Opname)" fill="var(--color-success)" radius={[3, 3, 0, 0]} maxBarSize={24} />
          <Bar dataKey="nilaiSpk" name="Nilai SPK Terbit" fill="var(--color-info)" radius={[3, 3, 0, 0]} maxBarSize={24} />
          <Bar dataKey="pengeluaran" name="Pengeluaran" fill="var(--color-brand-orange)" radius={[3, 3, 0, 0]} maxBarSize={24} />
        </BarChart>
      </ResponsiveContainer>
    </div>
  )
}
