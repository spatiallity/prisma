'use client'

import { useRouter, useSearchParams, usePathname } from 'next/navigation'
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts'
import { Card, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { formatRupiah } from '@/lib/utils'
import { formatMonthLabelShort } from '@/lib/financial'

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
  const router = useRouter()
  const pathname = usePathname()
  const searchParams = useSearchParams()
  const activeBulan = searchParams.get('bulan') ?? ''

  const chartData = data.map((d) => ({
    bulan: d.bulan,
    monthKey: d.bulan.slice(0, 7),
    label: formatMonthLabelShort(d.bulan),
    jumlah: d.jumlah,
  }))

  const goToMonth = (monthKey: string) => {
    const params = new URLSearchParams(searchParams.toString())
    if (monthKey === activeBulan) params.delete('bulan')
    else params.set('bulan', monthKey)
    const qs = params.toString()
    router.push(qs ? `${pathname}?${qs}` : pathname)
  }

  return (
    <Card className="mb-5 overflow-hidden">
      <CardHeader>
        <div>
          <CardTitle>Pengeluaran per bulan</CardTitle>
          <CardDescription>
            Realisasi seluruh kategori, dijumlah per bulan — klik satu batang untuk memfilter ke bulan itu.
          </CardDescription>
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
            <Bar
              dataKey="jumlah"
              name="Realisasi"
              radius={[4, 4, 0, 0]}
              cursor="pointer"
              onClick={(entry) => goToMonth((entry as unknown as { monthKey: string }).monthKey)}
            >
              {chartData.map((d) => (
                <Cell
                  key={d.monthKey}
                  fill={d.monthKey === activeBulan ? 'var(--color-primary-hover)' : 'var(--color-primary)'}
                />
              ))}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </div>
    </Card>
  )
}
