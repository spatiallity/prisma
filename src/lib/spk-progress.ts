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
  approved_at?: string | null
  started?: boolean
}

/**
 * A Finalisasi draft is created early for some older SPKs, but it must never
 * overtake an unfinished Siteplan in the project-wide stage read. Keep the
 * phase choice here so the SPK table, Dashboard and Progress board agree.
 */
export function resolveDesignWorkflow<T extends ProgressDesign>(designs: T[]) {
  const siteplan = designs.find((design) => design.phase === 'siteplan')
  const finalisasi = designs.find((design) => design.phase === 'finalisasi')
  const siteplanComplete = Boolean(siteplan?.approved_at)
  const finalisasiComplete = Boolean(
    finalisasi?.approved_at || finalisasi?.current_stage === 'Acc PIC Pertamina',
  )

  return {
    siteplan,
    finalisasi,
    siteplanComplete,
    finalisasiComplete,
    // Finalisasi becomes the current design only after Siteplan was approved.
    current: siteplanComplete ? (finalisasi ?? siteplan) : (siteplan ?? finalisasi),
  }
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

  const designWorkflow = resolveDesignWorkflow(designs)
  if (designWorkflow.finalisasiComplete) return 'invoicing'
  // A Finalisasi record with an actual revision is active, even when an old
  // Siteplan row lacks approved_at or an invoice route was opened early.
  if (designWorkflow.finalisasi?.started) return 'finalisasi'
  // Siteplan's "Finish" is displayed as Menunggu Opname. It has left Desain
  // Awal, but is not invoicing yet; keep it with Finalisasi while it waits.
  if (designWorkflow.siteplan?.current_stage === 'Finish') return 'finalisasi'
  if (hasRoutingDocument) return 'invoicing'
  if (designWorkflow.finalisasi && (designWorkflow.siteplanComplete || !designWorkflow.siteplan)) {
    return 'finalisasi'
  }
  // A non-survey-only SPK that has a design record has necessarily passed
  // Survei Terestris. Old records may not have a field-survey date, but must
  // still stay in their actual design phase rather than fall back to survey.
  if (designWorkflow.current) {
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
