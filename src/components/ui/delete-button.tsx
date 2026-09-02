'use client'

import { useActionState, useEffect, useRef, useState } from 'react'
import { useFormStatus } from 'react-dom'
import { AlertTriangle, Trash2 } from 'lucide-react'
import { Button } from './button'
import { Modal } from './modal'
import { useToast } from './toast'

export type DeleteState = { error: string | null }

function ConfirmSubmit() {
  const { pending } = useFormStatus()
  return (
    <Button type="submit" variant="danger" disabled={pending}>
      {pending ? 'Menghapus…' : 'Ya, Hapus'}
    </Button>
  )
}

/**
 * Delete trigger with a real "Apakah Anda Yakin?" confirmation dialog —
 * every destructive action in the app goes through this one component, so
 * the confirm step only needs to be built once. `action` is a server action
 * that deletes the record identified by `hiddenFields`. Deletion is
 * permanent — no soft-delete fallback.
 */
export function DeleteButton({
  action,
  hiddenFields,
  label = 'Hapus',
  itemLabel = 'data ini',
  confirmText,
}: {
  action: (prevState: DeleteState, formData: FormData) => Promise<DeleteState>
  hiddenFields?: Record<string, string>
  label?: string
  /** Named in the confirm dialog: "Apakah Anda yakin ingin menghapus {itemLabel}?" */
  itemLabel?: string
  /** Overrides the generated question entirely, if a longer explanation is needed. */
  confirmText?: string
}) {
  const [state, formAction] = useActionState(action, { error: null })
  const [open, setOpen] = useState(false)
  const toast = useToast()
  // Initial state is also {error: null}, same shape as a successful delete —
  // this flag is what tells the two apart so the dialog doesn't auto-close
  // the instant it opens, before the user ever confirms anything.
  const submitted = useRef(false)

  // A successful delete returns {error: null} and the row disappears on
  // revalidation; only close the dialog once that has actually happened.
  useEffect(() => {
    if (!submitted.current) return
    if (state.error) {
      submitted.current = false
      toast.error(state.error)
    } else if (open) {
      submitted.current = false
      setOpen(false)
      toast.success(`${itemLabel[0].toUpperCase()}${itemLabel.slice(1)} dihapus.`)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [state, open])

  return (
    <Modal
      open={open}
      onOpenChange={setOpen}
      title="Apakah Anda yakin?"
      trigger={
        <button
          type="button"
          className="inline-flex items-center gap-1 text-xs font-bold text-danger hover:underline"
          aria-label={label}
        >
          <Trash2 size={14} aria-hidden />
          {label}
        </button>
      }
    >
      <div className="grid gap-4">
        <div className="flex items-start gap-3">
          <AlertTriangle size={20} className="mt-0.5 shrink-0 text-danger" aria-hidden />
          <p className="text-sm text-slate-700">
            {confirmText ?? `Apakah Anda yakin ingin menghapus ${itemLabel}? Tindakan ini permanen dan tidak bisa dibatalkan.`}
          </p>
        </div>

        {state.error && <p className="text-sm font-semibold text-danger">{state.error}</p>}

        <form
          action={formAction}
          onSubmit={() => {
            submitted.current = true
          }}
          className="flex justify-end gap-2"
        >
          {hiddenFields &&
            Object.entries(hiddenFields).map(([key, value]) => (
              <input key={key} type="hidden" name={key} value={value} />
            ))}
          <Button type="button" variant="secondary" onClick={() => setOpen(false)}>
            Batal
          </Button>
          <ConfirmSubmit />
        </form>
      </div>
    </Modal>
  )
}
