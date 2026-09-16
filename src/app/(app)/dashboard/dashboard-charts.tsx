'use client'

import { useRouter } from 'next/navigation'
import {
  Bar,
  BarChart,
  Cell,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts'
import { formatRupiah, formatRupiahCompact } from '@/lib/utils'

const RAB_COLORS = { realisasi: 'var(--color-primary)', sisa: 'var(--color-slate-200)' }

/** Compact donut version of the Anggaran/Realisasi split for the dashboard card. */
export function RabDonutChart({ anggaran, realisasi }: { anggaran: number; realisasi: number }) {
  const sisa = Math.max(anggaran - realisasi, 0)
  const overBudget = realisasi > anggaran
  const data = overBudget
    ? [{ name: 'Realisasi', value: realisasi, fill: 'var(--color-danger)' }]
    : [
        { name: 'Realisasi', value: realisasi, fill: RAB_COLORS.realisasi },
        { name: 'Sisa', value: sisa, fill: RAB_COLORS.sisa },
      ]
  const percent = anggaran > 0 ? (realisasi / anggaran) * 100 : null

  return (
    <div className="relative h-40">
      <ResponsiveContainer width="100%" height="100%">
        <PieChart>
          <Pie data={data} dataKey="value" nameKey="name" innerRadius="65%" outerRadius="100%" startAngle={90} endAngle={-270}>
            {data.map((d) => (
              <Cell key={d.name} fill={d.fill} />
            ))}
          </Pie>
          <Tooltip
            formatter={(value, name) => [formatRupiah(Number(value)), String(name)]}
            contentStyle={{ fontSize: 12, borderRadius: 8 }}
          />
        </PieChart>
      </ResponsiveContainer>
      <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center">
        <span className="tnum text-xl font-black text-slate-900">
          {percent === null ? '—' : `${percent.toFixed(0)}%`}
        </span>
        <span className="text-[10px] font-bold text-muted-foreground uppercase">terpakai</span>
      </div>
    </div>
  )
}

const STAGE_BAR_COLOR = 'var(--color-info)'

/** How many on-going designs sit at each stage of one phase, as horizontal
 *  bars in the phase's own fixed stage order (not sorted by count) — the
 *  order itself is the point, showing where the pipeline backs up. Height
 *  and the Y-axis width both scale with the data: a fixed size clipped or
 *  overlapped the longer stage names ("Pembuatan Peta Inventaris dan Stake
 *  Out", "Manager Engineering & Project"). */
export function DesignStageChart({
  data,
  linkBase,
}: {
  data: { label: string; count: number }[]
  /** When set, each bar becomes a link to `${linkBase}?stage=<label>` (the
   *  Desain Siteplan/Finalisasi Desain list's own stage filter) — "Draft"
   *  goes to `?stage=Draft` too, which those pages read as "not started
   *  yet" rather than a real DesignStage. */
  linkBase?: string
}) {
  const router = useRouter()
  const chartData = [...data].reverse()
  const total = data.reduce((sum, d) => sum + d.count, 0)

  if (total === 0) {
    return (
      <div className="flex h-40 items-center justify-center text-xs text-muted-foreground">
        Tidak ada yang sedang berjalan
      </div>
    )
  }

  const longestLabel = Math.max(...chartData.map((d) => d.label.length))
  const axisWidth = Math.min(Math.max(longestLabel * 6, 90), 220)
  const height = Math.max(chartData.length * 34, 160)

  return (
    <div style={{ height }} className="px-2 pt-1 pb-1">
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={chartData} layout="vertical" margin={{ top: 0, right: 24, left: 0, bottom: 0 }}>
          <XAxis type="number" allowDecimals={false} tick={{ fontSize: 10 }} tickLine={false} axisLine={false} />
          <YAxis
            type="category"
            dataKey="label"
            width={axisWidth}
            interval={0}
            tick={{ fontSize: 10 }}
            tickLine={false}
            axisLine={false}
          />
          <Tooltip
            formatter={(value) => [value, 'SPK']}
            contentStyle={{ fontSize: 12, borderRadius: 8 }}
            cursor={{ fill: 'var(--color-slate-50)' }}
          />
          <Bar dataKey="count" fill={STAGE_BAR_COLOR} radius={[0, 4, 4, 0]} barSize={16}>
            {linkBase &&
              chartData.map((d) => (
                <Cell
                  key={d.label}
                  cursor="pointer"
                  onClick={() =>
                    router.push(`${linkBase}?stage=${encodeURIComponent(d.label)}`)
                  }
                />
              ))}
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    </div>
  )
}

/** Top 5 spending accounts this month, as horizontal bars — longest label wins the most width. */
export function TopCategoriesChart({ data }: { data: { label: string; jumlah: number }[] }) {
  const chartData = [...data].reverse().map((d) => ({
    ...d,
    label: d.label.length > 26 ? `${d.label.slice(0, 26)}…` : d.label,
  }))

  return (
    <div className="h-52 px-2 pt-1 pb-1">
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={chartData} layout="vertical" margin={{ top: 0, right: 12, left: 0, bottom: 0 }}>
          <XAxis type="number" tickFormatter={(v) => formatRupiahCompact(v)} tick={{ fontSize: 10 }} tickLine={false} axisLine={false} />
          <YAxis
            type="category"
            dataKey="label"
            width={132}
            tick={{ fontSize: 11 }}
            tickLine={false}
            axisLine={false}
          />
          <Tooltip
            formatter={(value) => [formatRupiah(Number(value)), 'Realisasi']}
            contentStyle={{ fontSize: 12, borderRadius: 8 }}
            cursor={{ fill: 'var(--color-slate-50)' }}
          />
          <Bar dataKey="jumlah" fill="var(--color-primary)" radius={[0, 4, 4, 0]} barSize={16} />
        </BarChart>
      </ResponsiveContainer>
    </div>
  )
}
