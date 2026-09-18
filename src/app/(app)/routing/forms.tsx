'use client'

import { useActionState, useId, useState } from 'react'
import { ArrowRight, Plus, Save, Undo2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Field, Input, Select, Textarea } from '@/components/ui/field'
import { Alert } from '@/components/ui/alert'
import { Modal } from '@/components/ui/modal'
import { Combobox } from '@/components/ui/combobox'
import { useActionToast } from '@/components/ui/toast'
import { PIC_PERTAMINA_SUGGESTIONS } from '@/lib/pic-pertamina'
import {
  advanceStep,
  addRoutingRevision,
  createRouting,
  updateRoutingStepDates,
  type RoutingState,
} from './actions'

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
  name,
  value,
  pending = false,
  disabled = false,
  formNoValidate = false,
}: {
  label: string
  icon?: React.ReactNode
  variant?: 'primary' | 'secondary'
  pending?: boolean
  disabled?: boolean
  formNoValidate?: boolean
  /** Set both to make this button's own name=value pair distinguish which
   *  of several submit buttons in one form was clicked (e.g. Lanjut vs
   *  Masih Revisi both posting to the same action). */
  name?: string
  value?: string
}) {
  return (
    <Button type="submit" name={name} value={value} variant={variant} disabled={disabled || pending} formNoValidate={formNoValidate}>
      {icon}
      {pending ? 'Menyimpan…' : label}
    </Button>
  )
}

export function NewRoutingForm({
  spks,
  templateId,
  lockedSpkId,
  returnToSpk = false,
  onSaved,
}: {
  spks: Option[]
  /** Only one routing template exists in practice, so it's picked for the
   *  user instead of asked — there's nothing to choose between. */
  templateId: string | null
  lockedSpkId?: string
  returnToSpk?: boolean
  onSaved?: () => void
}) {
  const [state, formAction, pending] = useActionState(createRouting, initialState)
  useActionToast(state, onSaved)
  const today = new Date().toISOString().slice(0, 10)

  if (spks.length === 0 || !templateId) {
    return (
      <Alert tone="warning">
        Butuh minimal satu SPK aktif dan satu template routing sebelum dokumen invoice bisa
        dibuat.
      </Alert>
    )
  }

  return (
    <form action={formAction} className="grid gap-4">
      <Feedback state={state} />
      <input type="hidden" name="document_type" value={DOCUMENT_TYPE} />
      <input type="hidden" name="template_id" value={templateId} />
      {returnToSpk && <input type="hidden" name="return_to_spk" value="1" />}

      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="SPK" htmlFor="r_spk" required className="sm:col-span-2">
          {lockedSpkId ? (
            <>
              <input type="hidden" name="spk_id" value={lockedSpkId} />
              <div className="rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-sm font-bold text-slate-900">
                {spks.find((spk) => spk.id === lockedSpkId)?.label ?? 'SPK ini'}
              </div>
            </>
          ) : (
            <Combobox id="r_spk" name="spk_id" options={spks} placeholder="Cari SPK…" />
          )}
        </Field>

        <Field label="Nomor dokumen" htmlFor="r_number">
          <Input id="r_number" name="document_number" placeholder="INV-2026-014" />
        </Field>

        <Field label="Tanggal masuk" htmlFor="r_date" required>
          <Input id="r_date" name="tanggal" type="date" defaultValue={today} required />
        </Field>

        <Field label="Catatan" htmlFor="r_notes" className="sm:col-span-2">
          <Textarea id="r_notes" name="notes" rows={3} />
        </Field>
      </div>

      <div>
        <Submit label="Buat dokumen invoice" icon={<Plus size={16} aria-hidden />} pending={pending} />
      </div>
    </form>
  )
}

export function AddRoutingButton({
  spks,
  templateId,
  lockedSpkId,
  returnToSpk = false,
  label = 'Add Data',
}: {
  spks: Option[]
  templateId: string | null
  lockedSpkId?: string
  returnToSpk?: boolean
  label?: string
}) {
  const [open, setOpen] = useState(false)
  return (
    <Modal
      open={open}
      onOpenChange={setOpen}
      title="Buat dokumen invoice"
      trigger={
        <Button type="button">
          <Plus size={16} aria-hidden />
          {label}
        </Button>
      }
    >
      <NewRoutingForm
        spks={spks}
        templateId={templateId}
        lockedSpkId={lockedSpkId}
        returnToSpk={returnToSpk}
        onSaved={() => setOpen(false)}
      />
    </Modal>
  )
}

export type RoutingStepEntry = {
  id: string
  status: string
  started_at: string | null
  completed_at: string | null
  pic_name: string | null
  note: string | null
  invoice_number: string | null
  invoice_value: number | null
  invoice_date: string | null
}

/**
 * Section 23 — the popup version of step review. A step still open (not yet
 * Completed) gets three plain outcomes instead of a mode picker or a separate
 * revision sub-form: Simpan perubahan (keeps it open), Lanjut ke Tahap
 * Selanjutnya (closes it, Tanggal selesai required), or Masih Revisi (stays
 * open, status Returned, and Catatan is required for this one).
 * An already-Completed step just gets Simpan, correcting the fields in
 * place without touching its status.
 */
export function RoutingStepDateForm({
  routingId,
  stepId,
  stepName,
  entry,
  previousCompletedAt,
  dendaValue,
  onSaved,
}: {
  routingId: string
  stepId: string
  /** "Invoiced" shows the invoice number/value/date fields; every other
   *  step doesn't. */
  stepName: string
  entry: RoutingStepEntry
  /** The step before this one's Tanggal selesai — Tanggal mulai defaults to
   *  it (not "today") so consecutive stages stay continuous. */
  previousCompletedAt?: string | null
  /** The SPK's current denda_value — only meaningful alongside the Invoiced
   *  fields, since that's the moment denda actually gets decided. */
  dendaValue?: number | null
  onSaved?: () => void
}) {
  const [state, formAction, pending] = useActionState(updateRoutingStepDates, initialState)
  useActionToast(state, onSaved)
  const today = new Date().toISOString().slice(0, 10)
  const picListId = useId()
  const isInvoiced = stepName === 'Invoiced'
  const isDone = entry.status === 'Completed'
  const [finishingInvoice, setFinishingInvoice] = useState(isDone)

  if (isInvoiced) {
    return (
      <form action={formAction} className="grid gap-3">
        <Feedback state={state} />
        <input type="hidden" name="routing_id" value={routingId} />
        <input type="hidden" name="step_id" value={stepId} />
        <input type="hidden" name="invoice_complete" value={finishingInvoice ? '1' : '0'} />
        <div className="flex items-center justify-between rounded-lg border border-slate-200 bg-slate-50 px-3 py-2">
          <span className="text-sm font-bold text-slate-700">Status invoice</span>
          <span className={isDone ? 'text-sm font-black text-success' : 'text-sm font-black text-primary'}>
            {isDone ? 'Invoiced' : 'Sedang Berjalan'}
          </span>
        </div>
        <Field label="Tanggal mulai" htmlFor="rd_inv_started" required>
          <Input
            id="rd_inv_started"
            name="started_at"
            type="date"
            defaultValue={entry.started_at?.slice(0, 10) ?? previousCompletedAt?.slice(0, 10) ?? today}
            required
          />
        </Field>
        <Field label="PIC Pertamina" htmlFor="rd_inv_pic">
          <Input id="rd_inv_pic" name="pic_name" list={picListId} defaultValue={entry.pic_name ?? ''} autoComplete="off" />
          <datalist id={picListId}>
            {PIC_PERTAMINA_SUGGESTIONS.map((name) => <option key={name} value={name} />)}
          </datalist>
        </Field>
        <Field label="Catatan" htmlFor="rd_inv_note">
          <Textarea id="rd_inv_note" name="note" rows={3} defaultValue={entry.note ?? ''} />
        </Field>
        {finishingInvoice && (
          <div className="grid gap-3 border-t border-slate-200 pt-3">
            <Field label="Tanggal selesai" htmlFor="rd_inv_completed" required>
              <Input id="rd_inv_completed" name="completed_at" type="date" defaultValue={entry.completed_at?.slice(0, 10) ?? today} required />
            </Field>
            <Field label="Nomor invoice" htmlFor="rd_inv_number">
              <Input id="rd_inv_number" name="invoice_number" defaultValue={entry.invoice_number ?? ''} placeholder="INV-2026-014" />
            </Field>
            <Field label="Nilai invoice" htmlFor="rd_inv_value" required>
              <Input id="rd_inv_value" name="invoice_value" inputMode="numeric" defaultValue={entry.invoice_value ?? ''} required />
            </Field>
            <Field label="Tanggal invoice" htmlFor="rd_inv_date" required>
              <Input id="rd_inv_date" name="invoice_date" type="date" defaultValue={entry.invoice_date ?? entry.completed_at?.slice(0, 10) ?? today} required />
            </Field>
            <Field label="Denda (Rp)" htmlFor="rd_denda" hint="Kosongkan kalau tidak ada denda.">
              <Input id="rd_denda" name="denda_value" inputMode="numeric" placeholder="0" defaultValue={dendaValue ?? ''} />
            </Field>
          </div>
        )}
        <div className="flex flex-wrap gap-2">
          {finishingInvoice ? (
            <>
              {!isDone && <Button type="button" variant="secondary" onClick={() => setFinishingInvoice(false)}><Undo2 size={16} aria-hidden /> Kembali ke progres</Button>}
              <Submit label={isDone ? 'Simpan perubahan invoice' : 'Simpan invoice'} icon={<ArrowRight size={16} aria-hidden />} pending={pending} />
            </>
          ) : (
            <>
              <Submit label="Simpan progres" icon={<ArrowRight size={16} aria-hidden />} pending={pending} />
              <Button type="button" variant="secondary" onClick={() => setFinishingInvoice(true)}>Selesaikan invoice</Button>
            </>
          )}
        </div>
      </form>
    )
  }

  return (
    <form action={formAction} className="grid gap-3">
      <Feedback state={state} />
      <input type="hidden" name="routing_id" value={routingId} />
      <input type="hidden" name="step_id" value={stepId} />

      <Field label="Tanggal mulai" htmlFor="rd_started" required>
        <Input
          id="rd_started"
          name="started_at"
          type="date"
          defaultValue={entry.started_at?.slice(0, 10) ?? previousCompletedAt?.slice(0, 10) ?? today}
          required
        />
      </Field>

      <Field label="PIC Pertamina" htmlFor="rd_pic">
        <Input id="rd_pic" name="pic_name" list={picListId} defaultValue={entry.pic_name ?? ''} autoComplete="off" />
        <datalist id={picListId}>
          {PIC_PERTAMINA_SUGGESTIONS.map((name) => (
            <option key={name} value={name} />
          ))}
        </datalist>
      </Field>

      <Field label="Catatan" htmlFor="rd_note">
        <Textarea
          id="rd_note"
          name="note"
          rows={3}
          defaultValue={entry.note ?? ''}
          placeholder={
            isDone
              ? undefined
              : 'Kalau masih revisi, tulis apa yang perlu diperbaiki. Satu poin per baris, misalnya:\n- dokumen kurang lengkap\n- perlu tanda tangan ulang'
          }
        />
      </Field>

      {isDone ? (
        <>
          <Field label="Tanggal selesai" htmlFor="rd_completed">
            <Input id="rd_completed" name="completed_at" type="date" defaultValue={entry.completed_at?.slice(0, 10) ?? ''} />
          </Field>
          <div>
            <Submit label="Simpan" icon={<ArrowRight size={16} aria-hidden />} pending={pending} />
          </div>
        </>
      ) : (
        <>
          <div className="grid gap-3 border-t border-slate-200 pt-3">
            <Field label="Tanggal selesai" htmlFor="rd_completed" required>
              <Input id="rd_completed" name="completed_at" type="date" defaultValue={today} required />
            </Field>
          </div>

          <div className="flex flex-wrap gap-2">
            <Submit
              label="Simpan perubahan"
              variant="secondary"
              icon={<Save size={16} aria-hidden />}
              name="decision"
              value="simpan"
              formNoValidate
              pending={pending}
            />
            <Submit
              label="Lanjutkan ke Tahap Selanjutnya"
              icon={<ArrowRight size={16} aria-hidden />}
              name="decision"
              value="lanjut"
              pending={pending}
            />
            <Submit
              label="Masih Revisi"
              variant="secondary"
              icon={<Undo2 size={16} aria-hidden />}
              name="decision"
              value="revisi"
              pending={pending}
            />
          </div>
        </>
      )}
    </form>
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
  const [advanceState, advanceAction, advancePending] = useActionState(advanceStep, initialState)
  const [revisionState, revisionAction, revisionPending] = useActionState(addRoutingRevision, initialState)
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
            <Textarea id="adv_note" name="note" rows={3} placeholder="Hasil pemeriksaan…" />
          </Field>
          <div>
            <Submit label="Selesai &amp; teruskan" icon={<ArrowRight size={16} aria-hidden />} pending={advancePending} />
          </div>
        </form>
      ) : (
        <form action={revisionAction} className="grid gap-3">
          <input type="hidden" name="routing_id" value={routingId} />
          <input type="hidden" name="step_id" value={stepId} />
          <Field label="Catatan revisi" htmlFor="rv_note" required>
            <Textarea id="rv_note" name="note" rows={3} required placeholder="Yang perlu diperbaiki…" />
          </Field>
          <Field label="Disubmit ulang tanggal" htmlFor="rv_resubmit" required>
            <Input id="rv_resubmit" name="resubmit_at" type="date" defaultValue={today} required />
          </Field>
          <div>
            <Submit label="Catat revisi" variant="secondary" icon={<Undo2 size={16} aria-hidden />} pending={revisionPending} />
          </div>
        </form>
      )}
    </div>
  )
}
