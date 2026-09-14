'use client'

import { useActionState } from 'react'
import { useFormStatus } from 'react-dom'
import { Check, Undo2 } from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { useActionToast } from '@/components/ui/toast'
import { formatDateTime, formatRupiah } from '@/lib/utils'
import { markOpname, unmarkOpname, type SpkFormState } from '../actions'

const initialState: SpkFormState = { error: null }

function MarkSubmit({ mark, disabled }: { mark: boolean; disabled?: boolean }) {
  const { pending } = useFormStatus()
  return (
    <button
      type="submit"
      disabled={pending || disabled}
      className="inline-flex h-8 items-center gap-1.5 rounded-lg border border-slate-300 bg-white px-2.5 text-xs font-bold text-slate-700 hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-50"
    >
      {mark ? <Check size={14} aria-hidden /> : <Undo2 size={14} aria-hidden />}
      {pending ? 'Menyimpan…' : mark ? 'Tandai' : 'Batalkan'}
    </button>
  )
}

/** Section 25.2/25.3 — Opname and PAD are a mark on the SPK, not a document. */
export function OpnamePadRow({
  label,
  spkId,
  markedAt,
  markedByName,
  disabled,
  disabledHint,
  markAction,
  unmarkAction,
  doneLabel = 'Sudah',
  pendingLabel = 'Belum',
  valueLabel,
  value,
}: {
  label: string
  spkId: string
  markedAt: string | null
  markedByName: string | null
  disabled?: boolean
  disabledHint?: string
  markAction: typeof markOpname
  unmarkAction: typeof unmarkOpname
  doneLabel?: string
  pendingLabel?: string
  /** When set, shows a "Nilai" number input alongside marking, e.g. Nilai Opname. */
  valueLabel?: string
  value?: number | null
}) {
  const [state, formAction] = useActionState(
    markedAt ? unmarkAction : markAction,
    initialState,
  )
  useActionToast(state)

  return (
    <div className="flex items-center justify-between gap-3 py-2">
      <div className="min-w-0">
        <div className="flex items-center gap-2">
          <span className="text-sm font-bold text-slate-900">{label}</span>
          <Badge tone={markedAt ? 'success' : 'neutral'}>
            {markedAt ? doneLabel : pendingLabel}
          </Badge>
        </div>
        {markedAt ? (
          <div className="text-xs text-muted-foreground">
            {formatDateTime(markedAt)}
            {markedByName && ` · ${markedByName}`}
            {valueLabel && value != null && ` · ${valueLabel} ${formatRupiah(value)}`}
          </div>
        ) : (
          disabled &&
          disabledHint && <div className="text-xs text-muted-foreground">{disabledHint}</div>
        )}
      </div>
      <form action={formAction} className="flex items-center gap-2">
        <input type="hidden" name="id" value={spkId} />
        {valueLabel && !markedAt && (
          <input
            type="number"
            name="value"
            placeholder={valueLabel}
            className="h-8 w-32 rounded-lg border border-slate-300 bg-white px-2 text-xs font-semibold text-slate-700"
          />
        )}
        <MarkSubmit mark={!markedAt} disabled={!markedAt && disabled} />
      </form>
    </div>
  )
}
