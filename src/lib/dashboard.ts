import type { DesignStage, NotificationSeverity } from '@/lib/supabase/types'

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

export type BottleneckDesignContext = {
  phase: 'siteplan' | 'finalisasi'
  current_stage: DesignStage
  updated_at: string
}

/**
 * Section 9's "reason" strings carry no per-item date — this resolves one
 * for the reasons that actually have a clear "since when", from data the
 * caller already loaded (active designs, Opname/PAD marks). Reasons with no
 * natural single date (schedule/vendor missing, payment owed) return null —
 * both the Dashboard's Bottleneck card and the Bottleneck Monitoring table
 * show "—" in that case.
 */
export function bottleneckSinceDate(
  item: { reason: string; spk_id: string | null },
  designsBySpk: Map<string, BottleneckDesignContext[]>,
  opnameMarkedAtBySpk: Map<string, string | null>,
  padMarkedAtBySpk: Map<string, string | null>,
): string | null {
  const designs = item.spk_id ? (designsBySpk.get(item.spk_id) ?? []) : []

  if (item.reason === 'Opname belum ditandai') {
    return designs.find((d) => d.phase === 'siteplan')?.updated_at ?? null
  }
  if (item.reason === 'PAD belum ditandai') {
    return item.spk_id ? (opnameMarkedAtBySpk.get(item.spk_id) ?? null) : null
  }
  if (item.reason === 'Invoice belum dibuat') {
    return item.spk_id ? (padMarkedAtBySpk.get(item.spk_id) ?? null) : null
  }
  if (item.reason === 'Design tidak berubah status') {
    return (
      designs.find((d) => d.current_stage !== 'Finish' && d.current_stage !== 'Review PIC Pertamina')
        ?.updated_at ?? null
    )
  }
  return null
}
