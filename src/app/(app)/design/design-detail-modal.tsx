'use client'

import { useEffect, useRef, useState } from 'react'
import Link from 'next/link'
import { Modal } from '@/components/ui/modal'
import { AccordionChain, NotesList, type AccordionStep } from '@/components/ui/step-chain'
import { formatDate } from '@/lib/utils'
import { PHASE_STAGES, STAGE_ORDER, daysBetween, daysInStage } from '@/lib/design'
import type { DesignPhase, DesignStage } from '@/lib/supabase/types'
import { StageEntryForm, StartDesignForm, type PicOption } from './forms'

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
  const reached = new Set(revisions.map((r) => r.stage))
  const currentOrder = STAGE_ORDER[design.current_stage]
  const stages = PHASE_STAGES[design.phase]

  const toggle = (key: string) => setOpenKey((prev) => (prev === key ? null : key))

  const accordionSteps: AccordionStep[] = stages.map((stage) => {
    const done = reached.has(stage) && STAGE_ORDER[stage] < currentOrder
    const now = stage === design.current_stage
    const state = now ? 'current' : done ? 'done' : 'pending'
    const stageRevisions = revisions.filter((r) => r.stage === stage)
    const latestEntry = stageRevisions[stageRevisions.length - 1]

    return {
      key: stage,
      label: stage,
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
