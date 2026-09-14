import type { NotificationSeverity } from '@/lib/supabase/types'

export const SEVERITY_TONE: Record<
  NotificationSeverity,
  'info' | 'warning' | 'danger'
> = {
  info: 'info',
  warning: 'warning',
  critical: 'danger',
}

/** Critical first — the list is read top-down and acted on in that order. */
export const SEVERITY_RANK: Record<NotificationSeverity, number> = {
  critical: 0,
  warning: 1,
  info: 2,
}

/** Section 9 groups bottlenecks by where in the project they occur. */
export const AREA_LABEL: Record<string, string> = {
  design: 'Design',
  routing: 'Routing',
  financial: 'Financial',
}

/**
 * The metric column carries whatever number triggered the condition — days,
 * rupiah, percent — so how it reads depends on the reason it came from.
 */
export function formatMetric(reason: string, metric: number | null) {
  if (metric === null) return null

  const number = new Intl.NumberFormat('id-ID', { maximumFractionDigits: 1 })

  if (/saldo|payment|dibayar|diterima/i.test(reason)) {
    return new Intl.NumberFormat('id-ID', {
      style: 'currency',
      currency: 'IDR',
      maximumFractionDigits: 0,
    }).format(metric)
  }
  return `${number.format(metric)} hari`
}
