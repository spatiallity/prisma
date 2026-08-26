import type { DesignStage } from '@/lib/supabase/types'

/**
 * Section 21 — the design workflow. Files are deliberately out of scope: this
 * module tracks where a design is, who holds it, and for how long. Nothing is
 * uploaded or stored.
 */
export const STAGE_TONE: Record<
  DesignStage,
  'neutral' | 'primary' | 'info' | 'warning' | 'success'
> = {
  'Desain Awal': 'neutral',
  Review: 'warning',
  Pemaparan: 'info',
  Revisi: 'warning',
  Finalisasi: 'primary',
  Approved: 'success',
}

/** Position in the chain, used for the progress rail on the detail page. */
export const STAGE_ORDER: Record<DesignStage, number> = {
  'Desain Awal': 1,
  Review: 2,
  Pemaparan: 3,
  Revisi: 4,
  Finalisasi: 5,
  Approved: 6,
}

/** `?stage=` shortcuts behind the Section 7 Design submenu. */
export const STAGE_FILTERS = [
  { key: 'all', label: 'Semua', stages: null },
  { key: 'awal', label: 'Desain Awal', stages: ['Desain Awal'] as DesignStage[] },
  { key: 'review', label: 'Review', stages: ['Review', 'Pemaparan'] as DesignStage[] },
  { key: 'revisi', label: 'Revisi', stages: ['Revisi'] as DesignStage[] },
  {
    key: 'final',
    label: 'Final',
    stages: ['Finalisasi', 'Approved'] as DesignStage[],
  },
]

export function stagesFromFilterKey(key: string | undefined): DesignStage[] | null {
  return STAGE_FILTERS.find((f) => f.key === key)?.stages ?? null
}

/** Whole days a design has sat where it is — the Section 9 bottleneck signal. */
export function daysInStage(since: string | null | undefined) {
  if (!since) return null
  const started = new Date(since)
  if (Number.isNaN(started.getTime())) return null
  return Math.max(0, Math.floor((Date.now() - started.getTime()) / 86_400_000))
}
