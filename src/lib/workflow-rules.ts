import type { DesignRow } from '@/lib/supabase/types'

export type WorkRuleInput = {
  work_name?: string | null
  work_type?: string | null
  location_type?: string | null
}
export type FinalisasiInput = Pick<DesignRow, 'current_stage' | 'approved_at'> | null | undefined

function normalize(value: string | null | undefined) {
  return (value ?? '').toLowerCase()
}

export function isStakeOutWork(spk: WorkRuleInput) {
  const text = [spk.work_name, spk.work_type].map(normalize).join(' ')
  return text.includes('stake out') || text.includes('stakeout')
}

export function isFlowlineWork(spk: WorkRuleInput) {
  const text = [spk.work_name, spk.work_type, spk.location_type].map(normalize).join(' ')
  return text.includes('flowline') || text.includes('trunkline') || text.includes('clusterline')
}

export function requiresFinalisasiDesign(spk: WorkRuleInput) {
  return !isStakeOutWork(spk)
}

export function isFinalisasiDesignComplete(finalisasi: FinalisasiInput) {
  return Boolean(finalisasi?.approved_at || finalisasi?.current_stage === 'Acc PIC Pertamina')
}

export function canStartRouting(spk: WorkRuleInput & { pad_marked_at?: string | null }) {
  return Boolean(spk.pad_marked_at)
}
