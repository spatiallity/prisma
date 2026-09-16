'use client'

import { useActionState, useState } from 'react'
import { useFormStatus } from 'react-dom'
import { Pencil } from 'lucide-react'
import { Modal } from '@/components/ui/modal'
import { Field, Input } from '@/components/ui/field'
import { Button } from '@/components/ui/button'
import { useActionToast } from '@/components/ui/toast'
import { updateSpkDenda, type SpkFormState } from '../../spk/actions'

const initialState: SpkFormState = { error: null }

function Submit() {
  const { pending } = useFormStatus()
  return (
    <Button type="submit" disabled={pending}>
      {pending ? 'Menyimpan…' : 'Simpan perubahan'}
    </Button>
  )
}

/** Edit icon next to the Denda figure — same pattern as Opname/PAD's own
 *  edit popup, just one plain number field since denda has no date/mark. */
export function DendaEditButton({ spkId, value }: { spkId: string; value: number | null }) {
  const [open, setOpen] = useState(false)
  const [state, formAction] = useActionState(updateSpkDenda, initialState)
  useActionToast(state, () => setOpen(false))

  return (
    <Modal
      open={open}
      onOpenChange={setOpen}
      title="Nilai Denda"
      trigger={
        <button
          type="button"
          className="inline-flex h-6 w-6 items-center justify-center rounded-md border border-slate-300 bg-white text-slate-500 hover:bg-slate-50"
          aria-label="Edit denda"
        >
          <Pencil size={12} aria-hidden />
        </button>
      }
    >
      <form action={formAction} className="grid gap-4">
        <input type="hidden" name="id" value={spkId} />
        <Field label="Nilai Denda (Rp)" htmlFor="denda_value" hint="Kosongkan kalau tidak ada denda.">
          <Input id="denda_value" name="denda_value" inputMode="numeric" placeholder="0" defaultValue={value ?? ''} />
        </Field>
        <Submit />
      </form>
    </Modal>
  )
}
