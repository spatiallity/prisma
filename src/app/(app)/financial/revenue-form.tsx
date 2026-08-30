'use client'

import { useActionState, useEffect, useRef } from 'react'
import { useFormStatus } from 'react-dom'
import { Plus } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Field, Input, Select } from '@/components/ui/field'
import { Alert } from '@/components/ui/alert'
import { DeleteButton } from '@/components/ui/delete-button'
import { FINANCIAL_DOC_STATUSES } from '@/lib/supabase/types'
import { REVENUE_META, type RevenueKind } from '@/lib/financial'
import {
  deleteRevenueDoc,
  saveRevenueDoc,
  setRevenueDocStatus,
  type FinancialState,
} from './actions'

const initialState: FinancialState = { error: null }

export type Choice = { id: string; label: string }

function Feedback({ state }: { state: FinancialState }) {
  if (state.error) return <Alert tone="danger">{state.error}</Alert>
  if (state.success) return <Alert tone="success">{state.success}</Alert>
  return null
}

function Submit({ label }: { label: string }) {
  const { pending } = useFormStatus()
  return (
    <Button type="submit" disabled={pending}>
      <Plus size={16} aria-hidden />
      {pending ? 'Menyimpan…' : label}
    </Button>
  )
}

/**
 * Section 25 — one form for all five revenue documents. Which extra fields
 * appear is decided by the document kind, not by five separate components.
 */
export function RevenueForm({
  kind,
  spks,
  parents,
  onSaved,
}: {
  kind: RevenueKind
  spks: Choice[]
  /** PAD picks an opname, invoice picks a PAD, payment picks an invoice. */
  parents: Choice[]
  onSaved?: () => void
}) {
  const [state, formAction] = useActionState(saveRevenueDoc, initialState)
  const meta = REVENUE_META[kind]
  const savedKey = useRef<string | undefined>(undefined)

  useEffect(() => {
    if (state.success && state.success !== savedKey.current) {
      savedKey.current = state.success
      onSaved?.()
    }
  }, [state.success, onSaved])

  if (spks.length === 0) {
    return <Alert tone="warning">Belum ada SPK untuk dicatat dokumennya.</Alert>
  }

  const parentLabel =
    kind === 'pad' ? 'Opname' : kind === 'invoice' ? 'PAD' : 'Invoice'

  return (
    <form action={formAction} className="grid gap-4">
      <Feedback state={state} />
      <input type="hidden" name="kind" value={kind} />

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Field label="SPK" htmlFor="f_spk" required className="lg:col-span-2">
          <Select id="f_spk" name="spk_id" required>
            {spks.map((spk) => (
              <option key={spk.id} value={spk.id}>
                {spk.label}
              </option>
            ))}
          </Select>
        </Field>

        <Field
          label={meta.numberLabel}
          htmlFor="f_number"
          required={kind === 'contract'}
        >
          <Input id="f_number" name="number" required={kind === 'contract'} />
        </Field>

        <Field label={`${meta.valueLabel} (Rp)`} htmlFor="f_value" required>
          <Input id="f_value" name="value" inputMode="numeric" required placeholder="500000000" />
        </Field>

        <Field label={meta.dateLabel} htmlFor="f_date">
          <Input id="f_date" name="date" type="date" />
        </Field>

        <Field label="Status" htmlFor="f_status">
          <Select id="f_status" name="status" defaultValue="Draft">
            {FINANCIAL_DOC_STATUSES.map((status) => (
              <option key={status} value={status}>
                {status}
              </option>
            ))}
          </Select>
        </Field>

        {kind === 'contract' && (
          <Field
            label="Amandemen ke"
            htmlFor="f_amendment"
            hint="0 untuk kontrak awal. Amandemen jadi baris baru, tidak menimpa."
          >
            <Input id="f_amendment" name="amendment_no" inputMode="numeric" defaultValue="0" />
          </Field>
        )}

        {kind === 'opname' && (
          <>
            <Field label="Periode mulai" htmlFor="f_ps">
              <Input id="f_ps" name="period_start" type="date" />
            </Field>
            <Field label="Periode selesai" htmlFor="f_pe">
              <Input id="f_pe" name="period_end" type="date" />
            </Field>
          </>
        )}

        {kind === 'invoice' && (
          <Field label="Jatuh tempo" htmlFor="f_due">
            <Input id="f_due" name="due_date" type="date" />
          </Field>
        )}

        {(kind === 'pad' || kind === 'invoice' || kind === 'payment') && (
          <Field
            label={parentLabel}
            htmlFor="f_parent"
            hint={`Menautkan dokumen ini ke ${parentLabel} yang mendasarinya.`}
          >
            <Select id="f_parent" name="parent_id" defaultValue="">
              <option value="">— tidak ditautkan —</option>
              {parents.map((parent) => (
                <option key={parent.id} value={parent.id}>
                  {parent.label}
                </option>
              ))}
            </Select>
          </Field>
        )}

        <Field label="Catatan" htmlFor="f_notes" className="sm:col-span-2">
          <Input id="f_notes" name="notes" />
        </Field>
      </div>

      <div>
        <Submit label={`Simpan ${meta.label}`} />
      </div>
    </form>
  )
}

function StatusSubmit({ label }: { label: string }) {
  const { pending } = useFormStatus()
  return (
    <button
      type="submit"
      disabled={pending}
      className="text-xs font-bold text-primary hover:underline disabled:opacity-50"
    >
      {pending ? '…' : label}
    </button>
  )
}

export function RevenueStatusToggle({
  kind,
  id,
  status,
}: {
  kind: RevenueKind
  id: string
  status: string
}) {
  const [state, formAction] = useActionState(setRevenueDocStatus, initialState)
  const next = status === 'Cancelled' ? 'Draft' : 'Cancelled'

  return (
    <form action={formAction} className="inline">
      <input type="hidden" name="kind" value={kind} />
      <input type="hidden" name="id" value={id} />
      <input type="hidden" name="status" value={next} />
      <StatusSubmit label={next === 'Cancelled' ? 'Batalkan' : 'Aktifkan'} />
      {state.error && <span className="ml-2 text-xs text-danger">{state.error}</span>}
    </form>
  )
}

export function RevenueDeleteButton({
  kind,
  id,
  spkId,
}: {
  kind: RevenueKind
  id: string
  spkId: string
}) {
  return (
    <DeleteButton
      action={deleteRevenueDoc}
      hiddenFields={{ kind, id, spk_id: spkId }}
    />
  )
}
