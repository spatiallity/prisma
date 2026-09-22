'use client'

import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts'

export type SpkIntakeMonth = { label: string; total: number }

export function SpkIntakeChart({ data }: { data: SpkIntakeMonth[] }) {
  return (
    <div className="h-64 pt-3">
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={data} margin={{ top: 4, right: 8, left: -22, bottom: 4 }}>
          <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="var(--color-slate-100)" />
          <XAxis dataKey="label" tick={{ fontSize: 11, fill: 'var(--color-slate-500)' }} tickLine={false} axisLine={false} />
          <YAxis allowDecimals={false} tick={{ fontSize: 11, fill: 'var(--color-slate-500)' }} tickLine={false} axisLine={false} />
          <Tooltip
            cursor={{ fill: 'var(--color-slate-50)' }}
            contentStyle={{ borderRadius: 8, borderColor: 'var(--color-slate-200)', fontSize: 12 }}
            formatter={(value) => [`${Number(value)} SPK`, 'SPK masuk']}
          />
          <Bar dataKey="total" name="SPK masuk" fill="var(--color-primary)" radius={[4, 4, 0, 0]} maxBarSize={44} />
        </BarChart>
      </ResponsiveContainer>
    </div>
  )
}
