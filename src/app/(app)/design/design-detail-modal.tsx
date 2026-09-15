'use client'

import { useEffect, useRef, useState } from 'react'
import Link from 'next/link'
import { Modal } from '@/components/ui/modal'
import { AccordionChain, type AccordionStep } from '@/components/ui/step-chain'
import { formatDateTime } from '@/lib/utils'
import { PHASE_STAGES, STAGE_ORDER } from '@/lib/design'
import type { DesignPhase, DesignStage } from '@/lib/supabase/types'
import { StageAdvanceForm, StartDesignForm, EditRevisionEntryButton, type PicOption } from './forms'

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
 *  separate page, matching the routing document popup. Each stage is its own
 *  accordion row instead of one form for "the current stage" plus a
 *  Lanjut/Revisi picker: expand a row to fill it in, the next one unlocks
 *  once this one has a Tanggal selesai. */
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
  const reached = new Set(revisions.map((r) => r.stage))
  const currentOrder = STAGE_ORDER[design.current_stage]
  const currentEntry = revisions.find((r) => !r.completed_at) ?? null
  const stages = PHASE_STAGES[design.phase]

  const toggle = (key: string) => setOpenKey((prev) => (prev === key ? null : key))

  const accordionSteps: AccordionStep[] = stages.map((stage) => {
    const done = reached.has(stage) && STAGE_ORDER[stage] < currentOrder
    const now = stage === design.current_stage
    const state = now ? 'current' : done ? 'done' : 'pending'
    const stageRevisions = revisions.filter((r) => r.stage === stage)

    return {
      key: stage,
      label: stage,
      state,
      locked: !now && !done,
      summary:
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
        ) : now ? (
          'Belum dimulai.'
        ) : undefined,
      content:
        mayEdit && now ? (
          isDraft ? (
            <StartDesignForm
              designId={design.id}
              phase={design.phase}
              currentStage={design.current_stage}
              pics={pics}
            />
          ) : (
            <div className="grid gap-3">
              {currentEntry && (
                <div className="flex justify-end">
                  <EditRevisionEntryButton designId={design.id} pics={pics} entry={currentEntry} />
                </div>
              )}
              <StageAdvanceForm
                designId={design.id}
                phase={design.phase}
                currentStage={design.current_stage}
                pics={pics}
                defaultPicPertamina={currentEntry?.pic_pertamina ?? null}
              />
            </div>
          )
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
