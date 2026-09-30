'use client'

import { Bar, CartesianGrid, ComposedChart, Legend, Line, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts'
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
    <div className="h-80 pt-4" style={{ minWidth: Math.max(720, data.length * 76) }}>
      <ResponsiveContainer width="100%" height="100%">
        <ComposedChart data={data} margin={{ top: 4, right: 8, left: 0, bottom: 4 }} barGap={2}>
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
          <Bar dataKey="pendapatan" name="Pendapatan (Opname)" fill="var(--color-primary)" radius={[3, 3, 0, 0]} maxBarSize={24} />
          <Bar dataKey="pengeluaran" name="Pengeluaran" fill="var(--color-brand-orange)" radius={[3, 3, 0, 0]} maxBarSize={24} />
          <Line type="monotone" dataKey="nilaiSpk" name="Nilai SPK Terbit" stroke="var(--color-info)" strokeWidth={2.5} dot={{ r: 3, fill: 'var(--color-info)' }} activeDot={{ r: 5 }} />
        </ComposedChart>
      </ResponsiveContainer>
    </div>
  )
}
