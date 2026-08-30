import { Card, CardContent } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { cn, formatRupiah, formatRupiahCompact } from '@/lib/utils'

type Stat = {
  label: string
  value: number | null
  caption?: string
  danger?: boolean
}

/**
 * One elegant summary card instead of four cramped boxes — headline figures
 * use compact notation (Rp 11,56 M) so nine-figure Rupiah amounts never
 * overflow their column; the exact value sits underneath in tabular nums.
 */
export function RabSummary({
  periodLabel,
  progressLabel,
  percent,
  percentDanger,
  stats,
}: {
  periodLabel: string
  progressLabel: string
  percent: number | null
  percentDanger: boolean
  stats: [Stat, Stat, Stat, Stat]
}) {
  const barWidth = percent === null ? 0 : Math.min(Math.max(percent, 0), 100)

  return (
    <Card className="mb-5 overflow-hidden rounded-2xl">
      <CardContent className="p-5">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <span className="text-xs font-extrabold tracking-wider text-slate-500 uppercase">
            {periodLabel}
          </span>
          <div className="flex items-center gap-2">
            <span className="text-xs font-semibold text-muted-foreground">{progressLabel}</span>
            <Badge tone={percentDanger ? 'danger' : 'info'}>
              {percent === null ? '—' : `${percent.toFixed(1)}%`}
            </Badge>
          </div>
        </div>

        <div className="mt-3 h-2 w-full overflow-hidden rounded-full bg-slate-100">
          <div
            className={cn(
              'h-full rounded-full transition-all',
              percentDanger ? 'bg-danger' : 'bg-primary',
            )}
            style={{ width: `${barWidth}%` }}
          />
        </div>

        <div className="mt-5 grid grid-cols-2 gap-x-4 gap-y-5 border-t border-slate-100 pt-5 sm:grid-cols-4 sm:divide-x sm:divide-slate-100">
          {stats.map((stat) => (
            <div key={stat.label} className="min-w-0 sm:px-4 sm:first:pl-0">
              <div className="text-[11px] font-extrabold tracking-wider text-slate-500 uppercase">
                {stat.label}
              </div>
              <div
                className={cn(
                  'tnum mt-1 text-xl font-bold whitespace-nowrap',
                  stat.danger ? 'text-danger' : 'text-slate-900',
                )}
                title={stat.value === null ? undefined : formatRupiah(stat.value)}
              >
                {stat.value === null ? '—' : formatRupiahCompact(stat.value)}
              </div>
              <div className="tnum mt-0.5 truncate text-xs text-muted-foreground">
                {stat.caption ?? (stat.value === null ? '' : formatRupiah(stat.value))}
              </div>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  )
}
