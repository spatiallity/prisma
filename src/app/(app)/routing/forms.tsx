'use client'

import { useActionState, useId, useState } from 'react'
import { useFormStatus } from 'react-dom'
import { ArrowRight, Plus, Undo2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Field, Input, Select } from '@/components/ui/field'
import { Alert } from '@/components/ui/alert'
import { Modal } from '@/components/ui/modal'
import { Combobox } from '@/components/ui/combobox'
import { useActionToast } from '@/components/ui/toast'
import { PIC_PERTAMINA_SUGGESTIONS } from '@/lib/pic-pertamina'
import { advanceStep, addRoutingRevision, createRouting, type RoutingState } from './actions'

const initialState: RoutingState = { error: null }

export type Option = { id: string; label: string }

/** Section 23 — routing only ever handles one kind of document: Invoice. */
const DOCUMENT_TYPE = 'Invoice'

function Feedback({ state }: { state: RoutingState }) {
  if (state.error) return <Alert tone="danger">{state.error}</Alert>
  if (state.success) return <Alert tone="success">{state.success}</Alert>
  return null
}

function Submit({
  label,
  icon,
  variant = 'primary',
}: {
  label: string
  icon?: React.ReactNode
  variant?: 'primary' | 'secondary'
}) {
  const { pending } = useFormStatus()
  return (
    <Button type="submit" variant={variant} disabled={pending}>
      {icon}
      {pending ? 'Menyimpan…' : label}
    </Button>
  )
}

export function NewRoutingForm({
  spks,
  templateId,
  onSaved,
}: {
  spks: Option[]
  /** Only one routing template exists in practice, so it's picked for the
   *  user instead of asked — there's nothing to choose between. */
  templateId: string | null
  onSaved?: () => void
}) {
  const [state, formAction] = useActionState(createRouting, initialState)
  useActionToast(state, onSaved)
  const today = new Date().toISOString().slice(0, 10)

  if (spks.length === 0 || !templateId) {
    return (
      <Alert tone="warning">
        Butuh minimal satu SPK aktif dan satu template routing sebelum dokumen bisa
        dirutekan.
      </Alert>
    )
  }

  return (
    <form action={formAction} className="grid gap-4">
      <Feedback state={state} />
      <input type="hidden" name="document_type" value={DOCUMENT_TYPE} />
      <input type="hidden" name="template_id" value={templateId} />

      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="SPK" htmlFor="r_spk" required className="sm:col-span-2">
          <Combobox id="r_spk" name="spk_id" options={spks} placeholder="Cari SPK…" />
        </Field>

        <Field label="Nomor dokumen" htmlFor="r_number">
          <Input id="r_number" name="document_number" placeholder="INV-2026-014" />
        </Field>

        <Field label="Tanggal masuk" htmlFor="r_date" required>
          <Input id="r_date" name="tanggal" type="date" defaultValue={today} required />
        </Field>

        <Field label="Catatan" htmlFor="r_notes" className="sm:col-span-2">
          <Input id="r_notes" name="notes" />
        </Field>
      </div>

      <div>
        <Submit label="Rutekan invoice" icon={<Plus size={16} aria-hidden />} />
      </div>
    </form>
  )
}

export function AddRoutingButton({
  spks,
  templateId,
}: {
  spks: Option[]
  templateId: string | null
}) {
  const [open, setOpen] = useState(false)
  return (
    <Modal
      open={open}
      onOpenChange={setOpen}
      title="Rutekan invoice"
      trigger={
        <Button type="button">
          <Plus size={16} aria-hidden />
          Add Data
        </Button>
      }
    >
      <NewRoutingForm spks={spks} templateId={templateId} onSaved={() => setOpen(false)} />
    </Modal>
  )
}

/**
 * Section 23 — a stage ends one of two ways: it passes (Lanjut), or it needs
 * fixing (Revisi). Revisi never blocks the step or ends it — it just logs a
 * round (what needs fixing, when it comes back) and leaves the step where it
 * is, ready for another round or for Lanjut once it's right.
 */
export function StepReviewForm({
  routingId,
  stepId,
  defaultPic,
  onSaved,
}: {
  routingId: string
  stepId: string
  defaultPic: string | null
  onSaved?: () => void
}) {
  const [mode, setMode] = useState<'lanjut' | 'revisi'>('lanjut')
  const [advanceState, advanceAction] = useActionState(advanceStep, initialState)
  const [revisionState, revisionAction] = useActionState(addRoutingRevision, initialState)
  useActionToast(advanceState, onSaved)
  useActionToast(revisionState, onSaved)
  const today = new Date().toISOString().slice(0, 10)
  const picListId = useId()

  return (
    <div className="grid gap-3">
      <Feedback state={mode === 'lanjut' ? advanceState : revisionState} />

      <Field label="Hasil review" htmlFor="rv_mode">
        <Select
          id="rv_mode"
          value={mode}
          onChange={(e) => setMode(e.target.value as 'lanjut' | 'revisi')}
        >
          <option value="lanjut">Lanjut</option>
          <option value="revisi">Revisi</option>
        </Select>
      </Field>

      {mode === 'lanjut' ? (
        <form action={advanceAction} className="grid gap-3">
          <input type="hidden" name="routing_id" value={routingId} />
          <input type="hidden" name="step_id" value={stepId} />
          <Field label="Tanggal" htmlFor="adv_date" required>
            <Input id="adv_date" name="tanggal" type="date" defaultValue={today} required />
          </Field>
          <Field label="PIC Pertamina" htmlFor="adv_pic">
            <Input id="adv_pic" name="pic_name" list={picListId} defaultValue={defaultPic ?? ''} autoComplete="off" />
            <datalist id={picListId}>
              {PIC_PERTAMINA_SUGGESTIONS.map((name) => (
                <option key={name} value={name} />
              ))}
            </datalist>
          </Field>
          <Field label="Catatan" htmlFor="adv_note">
            <Input id="adv_note" name="note" placeholder="Hasil pemeriksaan…" />
          </Field>
          <div>
            <Submit label="Selesai &amp; teruskan" icon={<ArrowRight size={16} aria-hidden />} />
          </div>
        </form>
      ) : (
        <form action={revisionAction} className="grid gap-3">
          <input type="hidden" name="routing_id" value={routingId} />
          <input type="hidden" name="step_id" value={stepId} />
          <Field label="Catatan revisi" htmlFor="rv_note" required>
            <Input id="rv_note" name="note" required placeholder="Yang perlu diperbaiki…" />
          </Field>
          <Field label="Disubmit ulang tanggal" htmlFor="rv_resubmit" required>
            <Input id="rv_resubmit" name="resubmit_at" type="date" defaultValue={today} required />
          </Field>
          <div>
            <Submit label="Catat revisi" variant="secondary" icon={<Undo2 size={16} aria-hidden />} />
          </div>
        </form>
      )}
    </div>
  )
}
