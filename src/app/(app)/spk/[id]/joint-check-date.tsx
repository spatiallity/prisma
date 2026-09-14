'use client'

import { useState } from 'react'
import { useActionState } from 'react'
import { useFormStatus } from 'react-dom'
import { Pencil } from 'lucide-react'
import { Modal } from '@/components/ui/modal'
import { Field, Input } from '@/components/ui/field'
import { Button } from '@/components/ui/button'
import { useActionToast } from '@/components/ui/toast'
import { setJointCheckDate, type SpkFormState } from '../actions'

const initialState: SpkFormState = { error: null }

function Submit() {
  const { pending } = useFormStatus()
  return (
    <Button type="submit" disabled={pending}>
      {pending ? 'Menyimpan…' : 'Simpan'}
    </Button>
  )
}

/** Edit icon → a popup date picker for Pengecekan Bersama — not a mark like
 *  Opname/PAD, just a date that can be set, changed, or cleared. */
export function JointCheckDateRow({ spkId, date }: { spkId: string; date: string | null }) {
  const [open, setOpen] = useState(false)
  const [state, formAction] = useActionState(setJointCheckDate, initialState)
  useActionToast(state, () => setOpen(false))

  return (
    <Modal
      open={open}
      onOpenChange={setOpen}
      title="Pengecekan Bersama"
      trigger={
        <button
          type="button"
          className="inline-flex h-8 w-8 items-center justify-center rounded-lg border border-slate-300 bg-white text-slate-600 hover:bg-slate-50"
          aria-label="Edit Pengecekan Bersama"
        >
          <Pencil size={14} aria-hidden />
        </button>
      }
    >
      <form action={formAction} className="grid gap-4">
        <input type="hidden" name="id" value={spkId} />
        <Field label="Tanggal pelaksanaan" htmlFor="joint_check_date">
          <Input id="joint_check_date" name="joint_check_date" type="date" defaultValue={date ?? ''} />
        </Field>
        <Submit />
      </form>
    </Modal>
  )
}
