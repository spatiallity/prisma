'use client'

import { Bar, CartesianGrid, ComposedChart, Legend, Line, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts'
import { formatRupiah, formatRupiahCompact } from '@/lib/utils'

export type SpkIntakeMonth = { label: string; total: number; contractValue: number }

export function SpkIntakeChart({ data }: { data: SpkIntakeMonth[] }) {
  return (
    <div className="h-64 pt-3">
      <ResponsiveContainer width="100%" height="100%">
        <ComposedChart data={data} margin={{ top: 4, right: 8, left: -22, bottom: 4 }}>
          <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="var(--color-slate-100)" />
          <XAxis dataKey="label" tick={{ fontSize: 11, fill: 'var(--color-slate-500)' }} tickLine={false} axisLine={false} />
          <YAxis yAxisId="count" allowDecimals={false} tick={{ fontSize: 11, fill: 'var(--color-slate-500)' }} tickLine={false} axisLine={false} />
          <YAxis yAxisId="value" orientation="right" tick={{ fontSize: 11, fill: 'var(--color-slate-500)' }} tickFormatter={formatRupiahCompact} tickLine={false} axisLine={false} width={58} />
          <Tooltip
            cursor={{ fill: 'var(--color-slate-50)' }}
            contentStyle={{ borderRadius: 8, borderColor: 'var(--color-slate-200)', fontSize: 12 }}
            formatter={(value, name) => name === 'Nilai SPK' ? [formatRupiah(Number(value)), 'Nilai SPK'] : [`${Number(value)} SPK`, 'Jumlah SPK']}
          />
          <Legend wrapperStyle={{ fontSize: 12 }} />
          <Bar yAxisId="count" dataKey="total" name="Jumlah SPK" fill="var(--color-primary)" radius={[4, 4, 0, 0]} maxBarSize={44} />
          <Line yAxisId="value" type="monotone" dataKey="contractValue" name="Nilai SPK" stroke="var(--color-brand-orange)" strokeWidth={2.5} dot={{ r: 3, fill: 'var(--color-brand-orange)' }} activeDot={{ r: 5 }} />
        </ComposedChart>
      </ResponsiveContainer>
    </div>
  )
}
