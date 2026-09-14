'use client'

import { useState } from 'react'
import { Pencil } from 'lucide-react'
import { Modal } from '@/components/ui/modal'
import { StepReviewForm } from './forms'

/** Edit icon → the current step's review form in a popup — the one place a
 *  routing step actually gets moved forward or sent back for revision. */
export function RoutingStepEdit({
  routingId,
  stepId,
  stepName,
  defaultPic,
}: {
  routingId: string
  stepId: string
  stepName: string
  defaultPic: string | null
}) {
  const [open, setOpen] = useState(false)
  return (
    <Modal
      open={open}
      onOpenChange={setOpen}
      title={`Review ${stepName}`}
      trigger={
        <button
          type="button"
          className="inline-flex h-8 w-8 items-center justify-center rounded-lg border border-slate-300 bg-white text-slate-600 hover:bg-slate-50"
          aria-label={`Edit ${stepName}`}
        >
          <Pencil size={14} aria-hidden />
        </button>
      }
    >
      <StepReviewForm routingId={routingId} stepId={stepId} defaultPic={defaultPic} onSaved={() => setOpen(false)} />
    </Modal>
  )
}
