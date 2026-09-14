import type { DesignPhase, DesignStage } from '@/lib/supabase/types'

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
  Finalisasi: 'info',
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
  Finalisasi: 5,
  Finish: 6,
  Pembuatan: 7,
  'Review internal': 8,
  Sinkronisasi: 9,
  'Submit Peta': 10,
}

/**
 * migration 0020 — a design record belongs to exactly one of these phases
 * for its whole life; reaching the end of one auto-opens the other as a
 * fresh Draft rather than the same record sliding across the boundary.
 */
export const PHASE_LABEL: Record<DesignPhase, string> = {
  siteplan: 'Desain Siteplan',
  finalisasi: 'Finalisasi Desain',
}

export const PHASE_STAGES: Record<DesignPhase, DesignStage[]> = {
  siteplan: [
    'Pembuatan Desain Awal',
    'Review Desain Awal',
    'Revisi Desain Awal',
    'Pembuatan Peta Inventaris dan Stake Out',
    'Finalisasi',
    'Finish',
  ],
  finalisasi: ['Pembuatan', 'Review internal', 'Sinkronisasi', 'Submit Peta'],
}

/** The stage a freshly auto-opened (or manually opened) design of this phase
 *  starts at — matches the default the DB trigger falls back to. */
export const PHASE_FIRST_STAGE: Record<DesignPhase, DesignStage> = {
  siteplan: 'Pembuatan Desain Awal',
  finalisasi: 'Pembuatan',
}

/** The stage that means "this phase is done" — reaching it sets approved_at. */
export const PHASE_TERMINAL_STAGE: Record<DesignPhase, DesignStage> = {
  siteplan: 'Finish',
  finalisasi: 'Submit Peta',
}

/** A record with no revisions yet — auto-opened and waiting for someone to
 *  mark it started (see startDesign). */
export function isDraft(revisionCount: number) {
  return revisionCount === 0
}

/** Whole days a design has sat where it is — the Section 9 bottleneck signal. */
export function daysInStage(since: string | null | undefined) {
  if (!since) return null
  const started = new Date(since)
  if (Number.isNaN(started.getTime())) return null
  return Math.max(0, Math.floor((Date.now() - started.getTime()) / 86_400_000))
}
