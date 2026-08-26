import type { DailyUpdateStatus } from '@/lib/supabase/types'

export const UPDATE_STATUS_TONE: Record<
  DailyUpdateStatus,
  'neutral' | 'success' | 'warning' | 'danger' | 'info'
> = {
  'Updated Today': 'success',
  'Belum Update': 'warning',
  'Terlambat Update': 'danger',
  Completed: 'info',
}

/** `YYYY-MM` → first day of that month; anything unparseable falls back to now. */
export function parseMonth(value: string | undefined): Date {
  if (value && /^\d{4}-\d{2}$/.test(value)) {
    const [year, month] = value.split('-').map(Number)
    return new Date(year!, month! - 1, 1)
  }
  const now = new Date()
  return new Date(now.getFullYear(), now.getMonth(), 1)
}

function iso(date: Date) {
  const year = date.getFullYear()
  const month = String(date.getMonth() + 1).padStart(2, '0')
  const day = String(date.getDate()).padStart(2, '0')
  return `${year}-${month}-${day}`
}

function monthKey(date: Date) {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`
}

export function monthLabel(anchor: Date) {
  return new Intl.DateTimeFormat('id-ID', {
    month: 'long',
    year: 'numeric',
  }).format(anchor)
}

export type CalendarDay = { date: string; dayOfMonth: number; inMonth: boolean }

/**
 * Six-week grid starting on Monday, so the calendar keeps a stable height as
 * the month changes. `first`/`last` bound the query that fills it.
 */
export function monthGrid(anchor: Date) {
  const year = anchor.getFullYear()
  const month = anchor.getMonth()

  const firstOfMonth = new Date(year, month, 1)
  // getDay() is Sunday-first; shift so Monday is column 0.
  const leading = (firstOfMonth.getDay() + 6) % 7

  const start = new Date(year, month, 1 - leading)
  const days: CalendarDay[] = []
  for (let i = 0; i < 42; i++) {
    const day = new Date(start.getFullYear(), start.getMonth(), start.getDate() + i)
    days.push({
      date: iso(day),
      dayOfMonth: day.getDate(),
      inMonth: day.getMonth() === month,
    })
  }

  return {
    days,
    first: days[0]!.date,
    last: days[days.length - 1]!.date,
    previous: monthKey(new Date(year, month - 1, 1)),
    next: monthKey(new Date(year, month + 1, 1)),
  }
}

/** 93,3% — achievement of a day's plan (Section 18). */
export function formatAchievement(value: number | null | undefined) {
  if (value === null || value === undefined) return '—'
  return `${new Intl.NumberFormat('id-ID', { maximumFractionDigits: 1 }).format(value)}%`
}

export function achievementTone(
  value: number | null,
): 'neutral' | 'success' | 'warning' | 'danger' {
  if (value === null) return 'neutral'
  if (value >= 100) return 'success'
  if (value >= 80) return 'warning'
  return 'danger'
}
