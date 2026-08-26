import type { RoutingStatus } from '@/lib/supabase/types'

/** Section 23 — status of a routed document and of each stage it passes. */
export const ROUTING_TONE: Record<
  RoutingStatus,
  'neutral' | 'primary' | 'success' | 'warning' | 'danger'
> = {
  Pending: 'neutral',
  'In Progress': 'primary',
  Completed: 'success',
  Returned: 'warning',
  Rejected: 'danger',
}

/** Stages a document can still move from — Completed is the end of the line. */
export const OPEN_STATUSES: RoutingStatus[] = ['Pending', 'In Progress', 'Returned']

/** 2,4 hari — one decimal is as precise as a lead time needs to read. */
export function formatDays(value: number | null | undefined) {
  if (value === null || value === undefined) return '—'
  return `${new Intl.NumberFormat('id-ID', { maximumFractionDigits: 1 }).format(value)} hari`
}

/**
 * Section 24 — a stage is late once it passes its SLA. Returned outranks late,
 * because a document sent back needs a decision before the clock even matters.
 */
export function stageTone(
  status: RoutingStatus,
  isOverdue: boolean,
): 'neutral' | 'primary' | 'success' | 'warning' | 'danger' {
  if (status === 'Returned' || status === 'Rejected') return ROUTING_TONE[status]
  if (isOverdue) return 'danger'
  return ROUTING_TONE[status]
}
