'use client'

import { Modal } from '@/components/ui/modal'
import { StepChain, chainBadge, type ChainStep } from '@/components/ui/step-chain'
import { formatDateTime } from '@/lib/utils'
import { PHASE_STAGES, STAGE_ORDER } from '@/lib/design'
import type { DesignPhase, DesignStage } from '@/lib/supabase/types'
import { StageReviewForm, StartDesignForm, type PicOption } from './forms'

type Revision = {
  id: string
  stage: string
  revision_no: number
  pic_id: string | null
  pic_pertamina: string | null
  started_at: string | null
  completed_at: string | null
  notes: string | null
}

type DesignLite = {
  id: string
  phase: DesignPhase
  current_stage: DesignStage
}

/** The chain for one design, plus its review form — a popup instead of a
 *  separate page, matching the routing document popup. */
export function DesignDetailModal({
  open,
  onOpenChange,
  design,
  title,
  revisions,
  picName,
  pics,
  mayEdit,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  design: DesignLite | null
  title: string
  revisions: Revision[]
  picName: Record<string, string>
  pics: PicOption[]
  mayEdit: boolean
}) {
  if (!design) return null

  const isDraft = revisions.length === 0
  const reached = new Set(revisions.map((r) => r.stage))
  const currentOrder = STAGE_ORDER[design.current_stage]
  const currentEntry = revisions.find((r) => !r.completed_at) ?? null
  const stages = PHASE_STAGES[design.phase]

  const chainSteps: ChainStep[] = stages.map((stage) => {
    const done = reached.has(stage) && STAGE_ORDER[stage] < currentOrder
    const now = stage === design.current_stage
    const state = now ? 'current' : done ? 'done' : 'pending'
    const stageRevisions = revisions.filter((r) => r.stage === stage)
    return {
      key: stage,
      label: stage,
      state,
      badge: chainBadge(state, now ? 'Berjalan' : done ? 'Selesai' : 'Belum'),
      sub:
        stageRevisions.length > 0 ? (
          <ul className="grid gap-1">
            {stageRevisions.map((revision) => (
              <li key={revision.id}>
                Revisi {revision.revision_no} · {formatDateTime(revision.started_at)}
                {revision.completed_at && ` → ${formatDateTime(revision.completed_at)}`}
                <br />
                {revision.pic_id ? (picName[revision.pic_id] ?? '—') : 'PIC belum ditentukan'}
                {revision.pic_pertamina && ` · Pertamina: ${revision.pic_pertamina}`}
                {revision.notes && ` · ${revision.notes}`}
              </li>
            ))}
          </ul>
        ) : undefined,
    }
  })

  return (
    <Modal open={open} onOpenChange={onOpenChange} title={title} size="lg">
      <div className="grid gap-5">
        <StepChain steps={chainSteps} />
        {mayEdit && (
          <div className="border-t border-slate-100 pt-4">
            <div className="mb-2 text-sm font-bold text-slate-900">
              {isDraft ? 'Mulai pengerjaan' : `Review ${design.current_stage}`}
            </div>
            {isDraft ? (
              <StartDesignForm
                designId={design.id}
                phase={design.phase}
                currentStage={design.current_stage}
                pics={pics}
              />
            ) : (
              <StageReviewForm
                designId={design.id}
                entryId={currentEntry?.id ?? null}
                phase={design.phase}
                currentStage={design.current_stage}
                pics={pics}
                defaultPicPertamina={currentEntry?.pic_pertamina ?? null}
              />
            )}
          </div>
        )}
      </div>
    </Modal>
  )
}
