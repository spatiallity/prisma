'use client'

import { useState } from 'react'
import { Plus } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Modal } from '@/components/ui/modal'
import { REVENUE_META, type RevenueKind } from '@/lib/financial'
import { RevenueForm, type Choice } from './revenue-form'

export function AddRevenueButton({
  kind,
  spks,
  parents,
}: {
  kind: RevenueKind
  spks: Choice[]
  parents: Choice[]
}) {
  const [open, setOpen] = useState(false)
  const meta = REVENUE_META[kind]
  return (
    <Modal
      open={open}
      onOpenChange={setOpen}
      title={`${meta.label} baru`}
      description="Koreksi dilakukan dengan membatalkan lalu mencatat ulang, bukan menimpa (Section 4.4)."
      trigger={
        <Button type="button">
          <Plus size={16} aria-hidden />
          Add Data
        </Button>
      }
    >
      <RevenueForm kind={kind} spks={spks} parents={parents} onSaved={() => setOpen(false)} />
    </Modal>
  )
}
