import { isTerrestrialSurveyOnly } from '@/lib/spk'

export type SpkProgressBucket = 'terestris' | 'desain_awal' | 'finalisasi' | 'invoicing' | 'selesai'

export type ProgressSpk = {
  id: string
  status: string
  work_type: string | null
  terrain_survey_completed_at: string | null
  joint_check_date: string | null
  joint_check_completed_at?: string | null
  opname_marked_at: string | null
  pad_marked_at: string | null
}

export type ProgressDesign = {
  phase: 'siteplan' | 'finalisasi'
  current_stage: string
}

/**
 * One SPK belongs to exactly one pipeline bucket. Both Dashboard and Progress
 * SPK use this function so their totals always reconcile. Survey-only SPKs
 * stay in the field bucket until the survey, joint check, Opname and PAD are
 * complete; they never enter the design buckets.
 */
export function classifySpkProgress(
  spk: ProgressSpk,
  designs: ProgressDesign[],
  hasRoutingDocument: boolean,
): SpkProgressBucket {
  if (spk.status === 'Selesai') return 'selesai'

  if (isTerrestrialSurveyOnly(spk.work_type)) {
    const fieldComplete = Boolean(
      spk.terrain_survey_completed_at
      && (spk.joint_check_completed_at ?? spk.joint_check_date)
      && spk.opname_marked_at
      && spk.pad_marked_at,
    )
    return fieldComplete && hasRoutingDocument ? 'invoicing' : 'terestris'
  }

  if (hasRoutingDocument) return 'invoicing'
  if (designs.some((design) => design.phase === 'finalisasi' && design.current_stage !== 'Acc PIC Pertamina')) {
    return 'finalisasi'
  }
  if (designs.some((design) => design.phase === 'siteplan' && design.current_stage !== 'Opname')) {
    return 'desain_awal'
  }
  return 'terestris'
}

export function terrestrialSurveyOnlyStage(spk: ProgressSpk) {
  if (!spk.terrain_survey_completed_at) {
    return { stage: 'Survei Terestris', startedAt: null }
  }
  const jointCheckCompletedAt = spk.joint_check_completed_at ?? spk.joint_check_date
  if (!jointCheckCompletedAt) {
    return { stage: 'Pengecekan Bersama', startedAt: spk.terrain_survey_completed_at }
  }
  if (!spk.opname_marked_at) {
    return { stage: 'Opname', startedAt: spk.joint_check_date ?? jointCheckCompletedAt }
  }
  if (!spk.pad_marked_at) {
    return { stage: 'PAD', startedAt: spk.opname_marked_at }
  }
  return { stage: 'Proses Invoice', startedAt: spk.pad_marked_at }
}
