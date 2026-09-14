'use client'

import { useState } from 'react'
import { useActionState } from 'react'
import { useFormStatus } from 'react-dom'
import { Pencil, Undo2 } from 'lucide-react'
import { Modal } from '@/components/ui/modal'
import { Field, Input } from '@/components/ui/field'
import { Button } from '@/components/ui/button'
import { useActionToast } from '@/components/ui/toast'
import { markOpname, unmarkOpname, type SpkFormState } from '../actions'

const initialState: SpkFormState = { error: null }

function Submit({ label }: { label: string }) {
  const { pending } = useFormStatus()
  return (
    <Button type="submit" disabled={pending}>
      {pending ? 'Menyimpan…' : label}
    </Button>
  )
}

function UnmarkButton({ label }: { label: string }) {
  const { pending } = useFormStatus()
  return (
    <button
      type="submit"
      disabled={pending}
      className="inline-flex h-9 items-center gap-1.5 rounded-lg border border-slate-300 bg-white px-3 text-sm font-bold text-slate-700 hover:bg-slate-50 disabled:opacity-50"
    >
      <Undo2 size={14} aria-hidden />
      {pending ? '…' : label}
    </button>
  )
}

/** Edit icon → a popup with an explicit date (never "now") and, when marked,
 *  a way to undo — used for Survei Terestris, Opname, and PAD, each a plain
 *  mark on the SPK rather than a routed document. */
export function OpnamePadRow({
  label,
  spkId,
  markedAt,
  disabled,
  disabledHint,
  markAction,
  unmarkAction,
  valueLabel,
  value,
}: {
  label: string
  spkId: string
  markedAt: string | null
  markedByName?: string | null
  disabled?: boolean
  disabledHint?: string
  markAction: typeof markOpname
  unmarkAction: typeof unmarkOpname
  /** When set, shows a "Nilai" number input alongside marking, e.g. Nilai Opname. */
  valueLabel?: string
  value?: number | null
}) {
  const [open, setOpen] = useState(false)
  const [markState, markFormAction] = useActionState(markAction, initialState)
  const [unmarkState, unmarkFormAction] = useActionState(unmarkAction, initialState)
  useActionToast(markState, () => setOpen(false))
  useActionToast(unmarkState, () => setOpen(false))

  const defaultDate = markedAt ? markedAt.slice(0, 10) : new Date().toISOString().slice(0, 10)

  if (disabled && !markedAt) {
    return disabledHint ? <span className="text-xs text-muted-foreground">{disabledHint}</span> : null
  }

  return (
    <Modal
      open={open}
      onOpenChange={setOpen}
      title={label}
      trigger={
        <button
          type="button"
          className="inline-flex h-8 w-8 items-center justify-center rounded-lg border border-slate-300 bg-white text-slate-600 hover:bg-slate-50"
          aria-label={`Edit ${label}`}
        >
          <Pencil size={14} aria-hidden />
        </button>
      }
    >
      <div className="grid gap-3">
        <form action={markFormAction} className="grid gap-4">
          <input type="hidden" name="id" value={spkId} />
          <Field label="Tanggal" htmlFor={`${label}_tanggal`} required>
            <Input id={`${label}_tanggal`} name="tanggal" type="date" defaultValue={defaultDate} required />
          </Field>
          {valueLabel && (
            <Field label={valueLabel} htmlFor={`${label}_value`}>
              <Input id={`${label}_value`} name="value" inputMode="numeric" defaultValue={value ?? ''} />
            </Field>
          )}
          <Submit label={markedAt ? 'Simpan perubahan' : 'Tandai selesai'} />
        </form>
        {markedAt && (
          <form action={unmarkFormAction}>
            <input type="hidden" name="id" value={spkId} />
            <UnmarkButton label="Batalkan" />
          </form>
        )}
      </div>
    </Modal>
  )
}
