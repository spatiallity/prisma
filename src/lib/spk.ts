import type { SpkStatus } from '@/lib/supabase/types'

/** Section 7 menu wording for the SPK lifecycle. */
export const SPK_STATUS_TONE: Record<
  SpkStatus,
  'neutral' | 'primary' | 'success' | 'warning' | 'danger' | 'info'
> = {
  Draft: 'neutral',
  'On Going': 'primary',
  Selesai: 'success',
  Archived: 'neutral',
  Cancelled: 'danger',
}

/** `?status=` values used by the sidebar shortcuts (Section 7). */
export const STATUS_FILTERS = [
  { key: 'all', label: 'Semua', status: null },
  { key: 'draft', label: 'Draft', status: 'Draft' as SpkStatus },
  { key: 'ongoing', label: 'On Going', status: 'On Going' as SpkStatus },
  { key: 'selesai', label: 'Selesai', status: 'Selesai' as SpkStatus },
  { key: 'arsip', label: 'Arsip', status: 'Archived' as SpkStatus },
]

export function statusFromFilterKey(key: string | undefined): SpkStatus | null {
  return STATUS_FILTERS.find((f) => f.key === key)?.status ?? null
}

/** 12,06 Ha — Indonesian decimal comma, matching the requirement examples. */
export function formatArea(value: number | null | undefined) {
  if (value === null || value === undefined) return '—'
  return `${new Intl.NumberFormat('id-ID', { maximumFractionDigits: 2 }).format(value)} Ha`
}

export function formatPercent(value: number | null | undefined) {
  if (value === null || value === undefined) return '—'
  return `${new Intl.NumberFormat('id-ID', { maximumFractionDigits: 1 }).format(value)}%`
}

/**
 * Jenis pekerjaan -> activity_templates.code (Section 13/17). Picking one on
 * the SPK create form instantiates that template's activities immediately —
 * the only other entry point is the manual template picker in the Progress
 * tab (applyTemplate, progress-actions.ts), kept for SPK that predate this
 * dropdown or were left without a jenis pekerjaan.
 */
export const WORK_TYPE_TEMPLATE_CODE: Record<string, string> = {
  'Dengan Desain Siteplan': 'TPL-A',
  'Tanpa Desain Siteplan': 'TPL-B',
  'Stake Out': 'TPL-C',
}

export const WORK_TYPE_OPTIONS = Object.keys(WORK_TYPE_TEMPLATE_CODE)

/** Days between today and the SPK end date; negative once it is overdue. */
export function daysLeft(endDate: string | null) {
  if (!endDate) return null
  const end = new Date(`${endDate}T00:00:00`)
  if (Number.isNaN(end.getTime())) return null
  const today = new Date()
  today.setHours(0, 0, 0, 0)
  return Math.round((end.getTime() - today.getTime()) / 86_400_000)
}
