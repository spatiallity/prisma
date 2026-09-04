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
  'Pembuatan Desain Awal': 'neutral',
  'Review Desain Awal': 'warning',
  'Revisi Desain Awal': 'warning',
  'Pembuatan Peta Inventaris dan Stake Out': 'info',
  Finish: 'success',
  Pembuatan: 'neutral',
  'Review internal': 'warning',
  Sinkronisasi: 'info',
  'Submit Peta': 'success',
}

/** Position in the chain, used for the progress rail on the detail page. */
export const STAGE_ORDER: Record<DesignStage, number> = {
  'Pembuatan Desain Awal': 1,
  'Review Desain Awal': 2,
  'Revisi Desain Awal': 3,
  'Pembuatan Peta Inventaris dan Stake Out': 4,
  Finish: 5,
  Pembuatan: 6,
  'Review internal': 7,
  Sinkronisasi: 8,
  'Submit Peta': 9,
}

/** `?stage=` shortcuts behind the Section 7 Design submenu — the two phases
 *  the design team owns. */
export const STAGE_FILTERS = [
  { key: 'all', label: 'Semua', stages: null },
  {
    key: 'siteplan',
    label: 'Desain Siteplan',
    stages: [
      'Pembuatan Desain Awal',
      'Review Desain Awal',
      'Revisi Desain Awal',
      'Pembuatan Peta Inventaris dan Stake Out',
      'Finish',
    ] as DesignStage[],
  },
  {
    key: 'finalisasi',
    label: 'Finalisasi Desain',
    stages: ['Pembuatan', 'Review internal', 'Sinkronisasi', 'Submit Peta'] as DesignStage[],
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
