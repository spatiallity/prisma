'use client'

import { useState } from 'react'
import { Plus } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Modal } from '@/components/ui/modal'
import { AssignmentForm, type SpkOption, type TeamOption, type VendorOption } from './assignment-form'

export function AddAssignmentButton({
  spks,
  vendors,
  teams,
}: {
  spks: SpkOption[]
  vendors: VendorOption[]
  teams: TeamOption[]
}) {
  const [open, setOpen] = useState(false)
  return (
    <Modal
      open={open}
      onOpenChange={setOpen}
      title="Assignment baru"
      description="Hanya SPK berstatus Draft atau On Going yang bisa ditugaskan."
      trigger={
        <Button type="button">
          <Plus size={16} aria-hidden />
          Add Data
        </Button>
      }
    >
      <AssignmentForm spks={spks} vendors={vendors} teams={teams} onSaved={() => setOpen(false)} />
    </Modal>
  )
}
