'use client'

import {
  Bar,
  BarChart,
  Cell,
  Legend,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts'
import { formatRupiah, formatRupiahCompact } from '@/lib/utils'

/** Nilai SPK → Opname → PAD → Invoice, as horizontal bars in that fixed
 *  order — never sorted by value, since the whole point is watching the
 *  drop-off from one milestone to the next. */
export function ValueFunnelChart({ data }: { data: { label: string; value: number }[] }) {
  const chartData = [...data].reverse()
  const max = Math.max(...data.map((d) => d.value), 1)

  return (
    <div className="h-56 px-2 pt-1 pb-1">
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={chartData} layout="vertical" margin={{ top: 0, right: 16, left: 0, bottom: 0 }}>
          <XAxis type="number" domain={[0, max]} tickFormatter={(v) => formatRupiahCompact(v)} tick={{ fontSize: 10 }} tickLine={false} axisLine={false} />
          <YAxis type="category" dataKey="label" width={72} tick={{ fontSize: 12, fontWeight: 700 }} tickLine={false} axisLine={false} />
          <Tooltip
            formatter={(value) => [formatRupiah(Number(value)), '']}
            contentStyle={{ fontSize: 12, borderRadius: 8 }}
            cursor={{ fill: 'var(--color-slate-50)' }}
          />
          <Bar dataKey="value" fill="var(--color-primary)" radius={[0, 6, 6, 0]} barSize={28} />
        </BarChart>
      </ResponsiveContainer>
    </div>
  )
}

/** Invoice value actually billed, per month — the one figure on this page
 *  that moves over time rather than sitting at a snapshot. */
export function MonthlyInvoiceChart({ data }: { data: { label: string; value: number }[] }) {
  if (data.every((d) => d.value === 0)) {
    return (
      <div className="flex h-56 items-center justify-center text-xs text-muted-foreground">
        Belum ada invoice tercatat
      </div>
    )
  }

  return (
    <div className="h-56 px-2 pt-2 pb-1">
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={data} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
          <XAxis dataKey="label" tick={{ fontSize: 11 }} tickLine={false} axisLine={false} />
          <YAxis tickFormatter={(v) => formatRupiahCompact(v)} tick={{ fontSize: 10 }} tickLine={false} axisLine={false} width={56} />
          <Tooltip
            formatter={(value) => [formatRupiah(Number(value)), 'Invoice']}
            contentStyle={{ fontSize: 12, borderRadius: 8 }}
            cursor={{ fill: 'var(--color-slate-50)' }}
          />
          <Bar dataKey="value" fill="var(--color-success)" radius={[4, 4, 0, 0]} barSize={28} />
        </BarChart>
      </ResponsiveContainer>
    </div>
  )
}

const STATUS_COLORS: Record<string, string> = {
  Draft: 'var(--color-slate-400)',
  'On Going': 'var(--color-primary)',
  Selesai: 'var(--color-success)',
  Archived: 'var(--color-slate-300)',
  Cancelled: 'var(--color-danger)',
}

function CountTooltip({
  active,
  payload,
}: {
  active?: boolean
  payload?: { name: string; value: number; payload: { fill: string; label?: string } }[]
}) {
  if (!active || !payload?.length) return null
  const p = payload[0]
  return (
    <div className="rounded-lg border border-slate-200 bg-surface px-3 py-2 text-xs shadow-lg">
      <div className="flex items-center gap-2">
        <span className="h-2 w-2 rounded-full" style={{ backgroundColor: p.payload.fill }} aria-hidden />
        <span className="text-muted-foreground">{p.payload.label ?? p.name}</span>
        <span className="tnum font-bold text-slate-900">{p.value}</span>
      </div>
    </div>
  )
}

/** Section 8 — status mix at a glance, next to the raw counts already on the tiles above. */
export function SpkStatusChart({ data }: { data: { status: string; label: string; count: number }[] }) {
  const nonZero = data.filter((d) => d.count > 0)
  if (nonZero.length === 0) return null

  return (
    <div className="h-56 px-2 pt-2 pb-1">
      <ResponsiveContainer width="100%" height="100%">
        <PieChart>
          <Pie
            data={nonZero}
            dataKey="count"
            nameKey="label"
            innerRadius="55%"
            outerRadius="85%"
            paddingAngle={2}
          >
            {nonZero.map((d) => (
              <Cell key={d.status} fill={STATUS_COLORS[d.status] ?? 'var(--color-slate-300)'} />
            ))}
          </Pie>
          <Tooltip content={<CountTooltip />} />
          <Legend
            layout="vertical"
            verticalAlign="middle"
            align="right"
            wrapperStyle={{ fontSize: 12 }}
          />
        </PieChart>
      </ResponsiveContainer>
    </div>
  )
}

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
 *  order itself is the point, showing where the pipeline backs up. */
export function DesignStageChart({ data }: { data: { label: string; count: number }[] }) {
  const chartData = [...data].reverse()
  const total = data.reduce((sum, d) => sum + d.count, 0)

  if (total === 0) {
    return (
      <div className="flex h-40 items-center justify-center text-xs text-muted-foreground">
        Tidak ada yang sedang berjalan
      </div>
    )
  }

  return (
    <div className="h-52 px-2 pt-1 pb-1">
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={chartData} layout="vertical" margin={{ top: 0, right: 24, left: 0, bottom: 0 }}>
          <XAxis type="number" allowDecimals={false} tick={{ fontSize: 10 }} tickLine={false} axisLine={false} />
          <YAxis
            type="category"
            dataKey="label"
            width={132}
            tick={{ fontSize: 11 }}
            tickLine={false}
            axisLine={false}
          />
          <Tooltip
            formatter={(value) => [value, 'SPK']}
            contentStyle={{ fontSize: 12, borderRadius: 8 }}
            cursor={{ fill: 'var(--color-slate-50)' }}
          />
          <Bar dataKey="count" fill={STAGE_BAR_COLOR} radius={[0, 4, 4, 0]} barSize={16} />
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
