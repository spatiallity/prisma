import type { MeasurementType, StageStatus } from '@/lib/supabase/types'

/** Section 14 — jenis pengukuran progress. */
export const MEASUREMENT_LABEL: Record<MeasurementType, string> = {
  percentage: 'Persentase',
  area: 'Luas',
  quantity: 'Jumlah',
  stage: 'Tahapan',
}

export const MEASUREMENT_HINT: Record<MeasurementType, string> = {
  percentage: 'Progress diisi langsung dalam persen, 0–100.',
  area: 'Progress = luas aktual / luas target, dibatasi 100%.',
  quantity: 'Progress = jumlah aktual / jumlah target, dibatasi 100%.',
  stage: 'Tanpa persentase bebas — Selesai berarti bobot penuh (Section 14.4).',
}

export const STAGE_TONE: Record<StageStatus, 'neutral' | 'warning' | 'success'> = {
  'Belum Mulai': 'neutral',
  'Dalam Pengerjaan': 'warning',
  Selesai: 'success',
}

/** Formats the "actual vs target" column for each measurement type. */
export function formatMeasure(
  measurement: MeasurementType,
  currentValue: number,
  targetValue: number | null,
  currentStage: StageStatus,
  unit: string | null,
) {
  if (measurement === 'stage') return currentStage
  if (measurement === 'percentage') return `${currentValue}%`

  const number = new Intl.NumberFormat('id-ID', { maximumFractionDigits: 2 })
  const suffix = unit ? ` ${unit}` : ''
  const target = targetValue === null ? '—' : number.format(targetValue)
  return `${number.format(currentValue)} / ${target}${suffix}`
}
