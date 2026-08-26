import type { Metadata } from 'next'
import Link from 'next/link'
import { ChevronLeft, ChevronRight } from 'lucide-react'
import { PageHeader } from '@/components/ui/page-header'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { requirePermission } from '@/lib/auth/session'
import { createClient } from '@/lib/supabase/server'
import { cn } from '@/lib/utils'
import { UPDATE_STATUS_TONE, monthGrid, monthLabel, parseMonth } from '@/lib/schedule'

export const metadata: Metadata = { title: 'Calendar' }

/** Section 18 — month view of Daily Plan, with the update state of each day. */
export default async function SchedulePage({
  searchParams,
}: {
  searchParams: Promise<{ month?: string }>
}) {
  await requirePermission('schedule', 'view')
  const { month } = await searchParams

  const anchor = parseMonth(month)
  const { days, first, last, previous, next } = monthGrid(anchor)

  const supabase = await createClient()
  const [{ data: plans }, { data: progress }, { data: spks }] = await Promise.all([
    supabase
      .from('daily_plans')
      .select('id, spk_id, plan_date, target_value, unit, team_id, status')
      .gte('plan_date', first)
      .lte('plan_date', last)
      .eq('status', 'Active'),
    supabase
      .from('daily_progress')
      .select('id, spk_id, progress_date, actual_value')
      .gte('progress_date', first)
      .lte('progress_date', last)
      .eq('status', 'Active'),
    supabase.from('spks').select('id, spk_number, site_code'),
  ])

  const spkLabel = new Map(
    (spks ?? []).map((s) => [s.id, s.site_code ?? s.spk_number]),
  )

  const plansByDate = new Map<string, typeof plans>()
  for (const plan of plans ?? []) {
    const list = plansByDate.get(plan.plan_date) ?? []
    list.push(plan)
    plansByDate.set(plan.plan_date, list)
  }

  const reportedDates = new Set((progress ?? []).map((p) => p.progress_date))
  const today = new Date().toISOString().slice(0, 10)

  return (
    <>
      <PageHeader
        title="Calendar"
        description="Rencana kerja per hari. Hari yang sudah ada Daily Progress ditandai hijau."
        actions={
          <div className="flex items-center gap-1 rounded-xl bg-slate-100 p-1">
            <Link
              href={`/schedule?month=${previous}`}
              className="rounded-lg p-1.5 text-slate-500 hover:bg-white hover:text-slate-900"
              aria-label="Bulan sebelumnya"
            >
              <ChevronLeft size={16} />
            </Link>
            <span className="px-3 text-sm font-extrabold text-slate-900">
              {monthLabel(anchor)}
            </span>
            <Link
              href={`/schedule?month=${next}`}
              className="rounded-lg p-1.5 text-slate-500 hover:bg-white hover:text-slate-900"
              aria-label="Bulan berikutnya"
            >
              <ChevronRight size={16} />
            </Link>
          </div>
        }
      />

      <Card>
        <CardHeader>
          <div>
            <CardTitle>{monthLabel(anchor)}</CardTitle>
            <CardDescription>
              {plans?.length ?? 0} rencana · {progress?.length ?? 0} laporan aktual
            </CardDescription>
          </div>
          <div className="flex items-center gap-3 text-xs">
            <span className="flex items-center gap-1.5">
              <span className="h-2 w-2 rounded-full bg-primary" /> ada plan
            </span>
            <span className="flex items-center gap-1.5">
              <span className="h-2 w-2 rounded-full bg-success" /> sudah update
            </span>
          </div>
        </CardHeader>
        <CardContent className="p-3">
          <div className="grid grid-cols-7 gap-1">
            {['Sen', 'Sel', 'Rab', 'Kam', 'Jum', 'Sab', 'Min'].map((day) => (
              <div
                key={day}
                className="px-2 py-1 text-center text-[11px] font-extrabold tracking-wider text-slate-500 uppercase"
              >
                {day}
              </div>
            ))}

            {days.map((day) => {
              const dayPlans = plansByDate.get(day.date) ?? []
              const reported = reportedDates.has(day.date)

              return (
                <div
                  key={day.date}
                  className={cn(
                    'min-h-24 rounded-lg border p-1.5',
                    day.inMonth
                      ? 'border-slate-200 bg-white'
                      : 'border-transparent bg-slate-50/60',
                    day.date === today && 'ring-2 ring-primary/40',
                  )}
                >
                  <div className="flex items-center justify-between">
                    <span
                      className={cn(
                        'tnum text-xs font-bold',
                        day.inMonth ? 'text-slate-700' : 'text-slate-300',
                      )}
                    >
                      {day.dayOfMonth}
                    </span>
                    {dayPlans.length > 0 && (
                      <span
                        className={cn(
                          'h-1.5 w-1.5 rounded-full',
                          reported ? 'bg-success' : 'bg-primary',
                        )}
                        aria-hidden
                      />
                    )}
                  </div>

                  <div className="mt-1 grid gap-1">
                    {dayPlans.slice(0, 3).map((plan) => (
                      <Link
                        key={plan.id}
                        href={`/spk/${plan.spk_id}`}
                        className="block truncate rounded bg-primary-soft px-1.5 py-0.5 text-[10px] font-bold text-primary hover:underline"
                      >
                        {spkLabel.get(plan.spk_id) ?? 'SPK'}
                        {plan.target_value !== null &&
                          ` · ${plan.target_value}${plan.unit ? ` ${plan.unit}` : ''}`}
                      </Link>
                    ))}
                    {dayPlans.length > 3 && (
                      <span className="px-1.5 text-[10px] font-bold text-slate-400">
                        +{dayPlans.length - 3} lagi
                      </span>
                    )}
                  </div>
                </div>
              )
            })}
          </div>
        </CardContent>
      </Card>

      <p className="mt-4 text-xs text-muted-foreground">
        Status harian per team ada di{' '}
        <Link href="/schedule/team" className="font-bold text-primary hover:underline">
          Team Schedule
        </Link>
        . Legenda status:{' '}
        {(['Updated Today', 'Belum Update', 'Terlambat Update'] as const).map((status) => (
          <Badge key={status} tone={UPDATE_STATUS_TONE[status]} className="ml-1">
            {status}
          </Badge>
        ))}
      </p>
    </>
  )
}
