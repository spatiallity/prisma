'use client'

import Link from 'next/link'
import {
  Cell,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
} from 'recharts'
import { cn, formatRupiah, formatRupiahCompact } from '@/lib/utils'

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
    <div className="relative h-36 w-36 shrink-0">
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

const STAGE_BAR_TONES = [
  'bg-primary',
  'bg-info',
  'bg-warning',
  'bg-brand-orange',
  'bg-success',
  'bg-brand-navy',
]

/** How many on-going designs sit at each stage of one phase, as horizontal
 *  bars in the phase's own fixed stage order (not sorted by count). This is
 *  rendered as a compact list instead of an axis chart so long operational
 *  labels stay readable and the card does not feel empty. */
export function DesignStageChart({
  data,
  linkBase,
}: {
  data: { label: string; count: number; hrefStage?: string }[]
  /** When set, each bar becomes a link to `${linkBase}?stage=<label>` (the
   *  Desain Siteplan/Finalisasi Desain list's own stage filter) — "Draft"
   *  goes to `?stage=Draft` too, which those pages read as "not started
   *  yet" rather than a real DesignStage. */
  linkBase?: string
}) {
  const total = data.reduce((sum, d) => sum + d.count, 0)
  const maxCount = Math.max(1, ...data.map((d) => d.count))

  if (total === 0) {
    return (
      <div className="grid min-h-40 place-items-center px-5 py-8">
        <div className="rounded-lg border border-dashed border-slate-200 bg-slate-50 px-4 py-3 text-center">
          <div className="text-sm font-bold text-slate-900">Tidak ada yang sedang berjalan</div>
          <div className="mt-1 text-xs font-semibold text-muted-foreground">
            Semua tahap di grup ini sedang kosong.
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="grid gap-3 px-5 py-4">
      {data.map((item, index) => {
        const width = Math.max(5, Math.round((item.count / maxCount) * 100))
        const row = (
          <div
            className={cn(
              'grid gap-2 rounded-md px-2 py-2 transition-colors',
              linkBase ? 'hover:bg-slate-50' : '',
            )}
          >
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0 text-sm font-bold leading-snug text-slate-800">
                {item.label}
              </div>
              <div className="tnum shrink-0 rounded-full bg-slate-100 px-2 py-0.5 text-xs font-black text-slate-700">
                {item.count}
              </div>
            </div>
            <div className="h-2 overflow-hidden rounded-full bg-slate-100">
              <div
                className={cn(
                  'h-full rounded-full transition-all',
                  item.count === 0 ? 'bg-slate-200' : STAGE_BAR_TONES[index % STAGE_BAR_TONES.length],
                )}
                style={{ width: `${width}%` }}
              />
            </div>
          </div>
        )

        return linkBase ? (
          <Link key={item.label} href={`${linkBase}?stage=${encodeURIComponent(item.hrefStage ?? item.label)}`}>
            {row}
          </Link>
        ) : (
          <div key={item.label}>{row}</div>
        )
      })}
    </div>
  )
}

/** Shows how much of the overall Top SCR contract has been issued as SPK. */
export function ContractAbsorptionChart({ capacity, issued }: { capacity: number; issued: number }) {
  const issuedPercent = capacity > 0 ? Math.min((issued / capacity) * 100, 100) : 0
  const remainingPercent = Math.max(100 - issuedPercent, 0)
  const remaining = Math.max(capacity - issued, 0)
  const overCapacity = issued > capacity

  return (
    <div className="flex h-full flex-col justify-between gap-4">
      <div className="grid gap-2.5">
      <div className="flex items-center justify-between gap-3 text-xs font-bold text-slate-600">
        <span>SPK terbit</span>
        <span>{overCapacity ? 'Melebihi kontrak' : 'Sisa kontrak'}</span>
      </div>
      <div className="flex h-14 overflow-hidden rounded-md border border-slate-200 bg-slate-100 text-center text-sm font-bold text-white">
        <div
          className="flex min-w-0 items-center justify-center bg-primary px-2 whitespace-nowrap"
          style={{ width: `${issuedPercent}%` }}
        >
          {formatRupiahCompact(issued)} ({issuedPercent.toFixed(0)}%)
        </div>
        {remainingPercent > 0 ? (
          <div
            className="flex min-w-0 items-center justify-center bg-slate-200 px-2 text-slate-700 whitespace-nowrap"
            style={{ width: `${remainingPercent}%` }}
          >
            {formatRupiahCompact(remaining)} ({remainingPercent.toFixed(0)}%)
          </div>
        ) : null}
      </div>
      <div className="tnum text-center text-sm font-black text-slate-900">{formatRupiah(capacity)}</div>
      </div>
      <div className="grid grid-cols-3 divide-x divide-slate-100 border-t border-slate-100 pt-3">
        {[
          { label: 'SPK terbit', value: formatRupiahCompact(issued), tone: 'text-primary' },
          { label: 'Sisa kontrak', value: formatRupiahCompact(remaining), tone: 'text-slate-700' },
          { label: 'Serapan', value: `${issuedPercent.toFixed(1)}%`, tone: 'text-primary' },
        ].map((item, index) => (
          <div key={item.label} className={cn('min-w-0 px-3 first:pl-0 last:pr-0', index === 1 && 'text-center', index === 2 && 'text-right')}>
            <div className="text-[10px] font-extrabold tracking-wide text-slate-500 uppercase">{item.label}</div>
            <div className={cn('tnum mt-1 text-sm font-black whitespace-nowrap', item.tone)}>{item.value}</div>
          </div>
        ))}
      </div>
    </div>
  )
}

/** Top 5 spending accounts this month, as horizontal bars — longest label wins the most width. */
export function TopCategoriesChart({ data }: { data: { label: string; jumlah: number }[] }) {
  const maxValue = Math.max(1, ...data.map((d) => d.jumlah))

  return (
    <div className="grid gap-3 px-5 py-4">
      {data.map((item, index) => {
        const width = Math.max(6, Math.round((item.jumlah / maxValue) * 100))
        return (
          <div key={item.label} className="grid gap-2 rounded-md px-2 py-2">
            <div className="flex items-start justify-between gap-4">
              <div className="min-w-0 text-sm font-bold leading-snug text-slate-800">
                {item.label}
              </div>
              <div className="tnum shrink-0 text-xs font-black text-slate-900">
                {formatRupiahCompact(item.jumlah)}
              </div>
            </div>
            <div className="h-2.5 overflow-hidden rounded-full bg-slate-100">
              <div
                className={cn(
                  'h-full rounded-full',
                  STAGE_BAR_TONES[(index + 1) % STAGE_BAR_TONES.length],
                )}
                style={{ width: `${width}%` }}
                title={formatRupiah(item.jumlah)}
              />
            </div>
          </div>
        )
      })}
    </div>
  )
}
