'use client'

import { useState } from 'react'
import { useActionState } from 'react'
import { useFormStatus } from 'react-dom'
import { Check, Pencil, Undo2 } from 'lucide-react'
import { Modal } from '@/components/ui/modal'
import { Field, Input } from '@/components/ui/field'
import { Button } from '@/components/ui/button'
import { useActionToast } from '@/components/ui/toast'
import { setJointCheckDate, unmarkJointCheck, type SpkFormState } from '../actions'

const initialState: SpkFormState = { error: null }

function Submit({ completed }: { completed: boolean }) {
  const { pending } = useFormStatus()
  return (
    <Button type="submit" disabled={pending}>
      {pending ? 'Menyimpan…' : completed ? 'Simpan perubahan' : <><Check size={16} aria-hidden /> Tandai selesai</>}
    </Button>
  )
}

function UnmarkButton() {
  const { pending } = useFormStatus()
  return (
    <button
      type="submit"
      disabled={pending}
      className="inline-flex h-9 items-center gap-1.5 rounded-lg border border-slate-300 bg-white px-3 text-sm font-bold text-slate-700 hover:bg-slate-50 disabled:opacity-50"
    >
      <Undo2 size={14} aria-hidden />
      {pending ? '…' : 'Batalkan selesai'}
    </button>
  )
}

/** Edit icon → an explicit completion action for Pengecekan Bersama. */
export function JointCheckDateRow({
  spkId,
  date,
  completedAt,
}: {
  spkId: string
  date: string | null
  completedAt: string | null
}) {
  const [open, setOpen] = useState(false)
  const [state, formAction] = useActionState(setJointCheckDate, initialState)
  const [unmarkState, unmarkFormAction] = useActionState(unmarkJointCheck, initialState)
  useActionToast(state, () => setOpen(false))
  useActionToast(unmarkState, () => setOpen(false))
  const defaultDate = date?.slice(0, 10) ?? ''

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
        <Field label="Tanggal pelaksanaan" htmlFor="joint_check_date" hint="Opsional">
          <Input id="joint_check_date" name="joint_check_date" type="date" defaultValue={defaultDate} />
        </Field>
        <Submit completed={Boolean(completedAt)} />
      </form>
      {completedAt ? (
        <form action={unmarkFormAction}>
          <input type="hidden" name="id" value={spkId} />
          <UnmarkButton />
        </form>
      ) : null}
    </Modal>
  )
}
