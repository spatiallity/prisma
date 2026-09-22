'use client'

import { useEffect, useRef, useState } from 'react'
import Link from 'next/link'
import { Modal } from '@/components/ui/modal'
import { AccordionChain, NotesList, type AccordionStep } from '@/components/ui/step-chain'
import { formatDate } from '@/lib/utils'
import { PHASE_STAGES, daysBetween, daysInStage, stageDisplayLabel } from '@/lib/design'
import type { DesignPhase, DesignStage } from '@/lib/supabase/types'
import { DeleteRevisionEntryButton, StageEntryForm, StartDesignForm, type PicOption } from './forms'

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
  approved_at: string | null
}

/** The chain for one design, plus its review form — a popup instead of a
 *  separate page. Each stage is its own accordion row: past stages stay
 *  editable in place (Simpan corrects Drafter/PIC Pertamina/Catatan/Tanggal
 *  mulai without moving anything), the current stage also gets Lanjutkan ke
 *  Tahap Selanjutnya, and a row only unlocks once the one before it is
 *  reached. */
export function DesignDetailModal({
  open,
  onOpenChange,
  design,
  title,
  revisions,
  picName,
  pics,
  mayEdit,
  spkId,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  design: DesignLite | null
  title: string
  revisions: Revision[]
  picName: Record<string, string>
  pics: PicOption[]
  mayEdit: boolean
  /** Shows a "Buka Detail SPK" link when set — omitted where the modal is
   *  already opened from inside that SPK's own page. */
  spkId?: string
}) {
  const [openKey, setOpenKey] = useState<string | null>(null)
  const lastDesignId = useRef<string | null>(null)

  useEffect(() => {
    if (design && design.id !== lastDesignId.current) {
      lastDesignId.current = design.id
      setOpenKey(design.current_stage)
    }
  }, [design])

  if (!design) return null

  const isDraft = revisions.length === 0
  const isComplete = Boolean(design.approved_at)
  const stages = PHASE_STAGES[design.phase]
  const currentIndex = stages.indexOf(design.current_stage)
  const latestRevisionId = revisions.at(-1)?.id

  const toggle = (key: string) => setOpenKey((prev) => (prev === key ? null : key))

  const accordionSteps: AccordionStep[] = stages.map((stage, index) => {
    const stageRevisions = revisions.filter((r) => r.stage === stage)
    const latestEntry = stageRevisions[stageRevisions.length - 1]
    // Bulk-imported legacy designs often retain only the current stage. The
    // workflow position is still reliable, so earlier stages are shown as
    // complete without inventing dates or history rows.
    const inferredDone = !isDraft && index < currentIndex
    // Saving a finish date does not itself advance the workflow. Until the
    // user selects Lanjutkan, the current non-terminal stage must stay open
    // so its next-stage and jump controls remain available.
    const now = stage === design.current_stage && !isComplete
    const done = !now && (Boolean(latestEntry?.completed_at) || inferredDone || (isComplete && stage === design.current_stage))
    const state = now ? 'current' : done ? 'done' : 'pending'

    // A freshly-opened stage's own entry has no Drafter/PIC Pertamina yet —
    // default to whoever held the stage right before it, so the common case
    // (same reviewer several stages running) doesn't need retyping. Only
    // fills the gap: once this stage's own entry has a value (even one the
    // user deliberately cleared), that value wins.
    const previousStage = index > 0 ? stages[index - 1] : undefined
    const previousRevisions = previousStage ? revisions.filter((r) => r.stage === previousStage) : []
    const previousEntry = previousRevisions[previousRevisions.length - 1]
    const previousDrafterName = previousEntry?.pic_id ? (picName[previousEntry.pic_id] ?? undefined) : undefined
    const previousPicPertamina = previousEntry?.pic_pertamina ?? undefined

    return {
      key: stage,
      label: stageDisplayLabel(stage),
      state,
      locked: !now && !done,
      summary:
        stageRevisions.length > 0 ? (
          <ul className="grid gap-2">
            {stageRevisions.map((revision) => {
              const spent = revision.completed_at
                ? daysBetween(revision.started_at, revision.completed_at)
                : daysInStage(revision.started_at)
              return (
              <li key={revision.id}>
                Revisi {revision.revision_no} · {formatDate(revision.started_at)}
                {revision.completed_at && ` → ${formatDate(revision.completed_at)}`}
                {spent !== null && (
                  <span className="text-slate-500"> · {spent} hari{!revision.completed_at && ' (berjalan)'}</span>
                )}
                <br />
                {revision.pic_id ? (picName[revision.pic_id] ?? '—') : 'Drafter belum ditentukan'}
                {revision.pic_pertamina && ` · Pertamina: ${revision.pic_pertamina}`}
                <NotesList text={revision.notes} />
              </li>
              )
            })}
          </ul>
        ) : inferredDone ? (
          'Data lama · tanggal belum tercatat.'
        ) : now ? (
          'Belum dimulai.'
        ) : undefined,
      content:
        mayEdit && (now || done) ? (
          isDraft && now ? (
            <StartDesignForm
              designId={design.id}
              phase={design.phase}
              currentStage={design.current_stage}
              pics={pics}
            />
          ) : latestEntry ? (
            <StageEntryForm
              designId={design.id}
              phase={design.phase}
              stage={stage}
              isCurrent={now}
              entry={latestEntry}
              picName={picName}
              pics={pics}
              previousDrafterName={previousDrafterName}
              previousPicPertamina={previousPicPertamina}
              canRollback={latestEntry.id === latestRevisionId && revisions.length > 1}
              canRewind={latestEntry.id !== latestRevisionId}
              onSaved={() => setOpenKey(null)}
            />
          ) : undefined
        ) : undefined,
    }
  })

  return (
    <Modal open={open} onOpenChange={onOpenChange} title={title} size="lg">
      <div className="grid gap-4">
        {spkId && (
          <div className="flex justify-end">
            <Link href={`/spk/${spkId}`} className="text-sm font-bold text-primary hover:underline">
              Buka Detail SPK
            </Link>
          </div>
        )}
        <AccordionChain steps={accordionSteps} openKey={openKey} onToggle={toggle} />
      </div>
    </Modal>
  )
}
