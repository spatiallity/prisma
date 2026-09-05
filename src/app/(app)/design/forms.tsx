'use client'

import { useActionState, useId, useState } from 'react'
import { useFormStatus } from 'react-dom'
import { ArrowRight, Pencil, Plus, Undo2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Field, Input, Select } from '@/components/ui/field'
import { Alert } from '@/components/ui/alert'
import { Modal } from '@/components/ui/modal'
import { DeleteButton } from '@/components/ui/delete-button'
import { useActionToast } from '@/components/ui/toast'
import type { DesignPhase, DesignStage } from '@/lib/supabase/types'
import { PHASE_STAGES } from '@/lib/design'
import {
  addDesignRevision,
  advanceStage,
  createDesign,
  deleteRevisionEntry,
  startDesign,
  updateRevisionEntry,
  type DesignState,
} from './actions'

const initialState: DesignState = { error: null }

export type PicOption = { id: string; label: string }
export type SpkOption = { id: string; label: string }

function Feedback({ state }: { state: DesignState }) {
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

/** Free-typed PIC name with autocomplete — a name that doesn't match anyone
 *  in `pics` yet is created automatically when the form is submitted (see
 *  resolvePicId in actions.ts), so there's nothing to "add a PIC" for. */
function PicField({
  label,
  pics,
  defaultValue,
  placeholder,
  className,
}: {
  label: string
  pics: PicOption[]
  defaultValue?: string
  placeholder?: string
  className?: string
}) {
  const id = useId()
  const listId = `${id}-pics`
  return (
    <Field label={label} htmlFor={id} className={className}>
      <Input
        id={id}
        name="pic_name"
        list={listId}
        defaultValue={defaultValue}
        placeholder={placeholder}
        autoComplete="off"
      />
      <datalist id={listId}>
        {pics.map((pic) => (
          <option key={pic.id} value={pic.label} />
        ))}
      </datalist>
    </Field>
  )
}

export function NewDesignForm({
  spks,
  pics,
  onSaved,
}: {
  spks: SpkOption[]
  pics: PicOption[]
  onSaved?: () => void
}) {
  const [state, formAction] = useActionState(createDesign, initialState)
  useActionToast(state, onSaved)
  const today = new Date().toISOString().slice(0, 10)

  if (spks.length === 0) {
    return (
      <Alert tone="warning">
        Semua SPK aktif sudah punya record desain, atau belum ada SPK sama sekali.
      </Alert>
    )
  }

  return (
    <form action={formAction} className="grid gap-4">
      <Feedback state={state} />

      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="SPK" htmlFor="d_spk" required className="sm:col-span-2">
          <Select id="d_spk" name="spk_id" required>
            {spks.map((spk) => (
              <option key={spk.id} value={spk.id}>
                {spk.label}
              </option>
            ))}
          </Select>
        </Field>

        <Field label="Judul desain" htmlFor="d_title">
          <Input id="d_title" name="title" placeholder="Siteplan Lokasi Bor" />
        </Field>

        <PicField label="PIC" pics={pics} placeholder="Nama PIC" />

        <Field label="PIC Pertamina" htmlFor="d_pic_pertamina">
          <Input id="d_pic_pertamina" name="pic_pertamina" placeholder="Reviewer Pertamina" />
        </Field>

        <Field label="Tanggal mulai" htmlFor="d_start" required>
          <Input id="d_start" name="tanggal" type="date" defaultValue={today} required />
        </Field>

        <Field label="Catatan" htmlFor="d_notes" className="sm:col-span-2">
          <Input id="d_notes" name="notes" />
        </Field>
      </div>

      <div>
        <Submit label="Buka record desain" icon={<Plus size={16} aria-hidden />} />
      </div>
    </form>
  )
}

export function AddDesignButton({
  spks,
  pics,
}: {
  spks: SpkOption[]
  pics: PicOption[]
}) {
  const [open, setOpen] = useState(false)
  return (
    <Modal
      open={open}
      onOpenChange={setOpen}
      title="Buka record desain"
      description="Satu SPK punya satu record desain aktif; putaran revisi dicatat di dalamnya."
      trigger={
        <Button type="button">
          <Plus size={16} aria-hidden />
          Add Data
        </Button>
      }
    >
      <NewDesignForm spks={spks} pics={pics} onSaved={() => setOpen(false)} />
    </Modal>
  )
}

/**
 * Section 21 — a stage ends one of two ways, the same two the routing module
 * offers: it passes (Lanjut, which moves the design on and closes the stage),
 * or it needs fixing (Revisi, which logs a round — what to fix, when it comes
 * back — and leaves the design exactly where it is).
 */
export function StageReviewForm({
  designId,
  entryId,
  phase,
  currentStage,
  pics,
  defaultPicPertamina,
}: {
  designId: string
  /** The open design_revisions row — what a Revisi round attaches to. */
  entryId: string | null
  /** Which stages Lanjut may pick from — a design never crosses phases. */
  phase: DesignPhase
  currentStage: DesignStage
  pics: PicOption[]
  defaultPicPertamina: string | null
}) {
  const [mode, setMode] = useState<'lanjut' | 'revisi'>('lanjut')
  const [advanceState, advanceAction] = useActionState(advanceStage, initialState)
  const [revisionState, revisionAction] = useActionState(addDesignRevision, initialState)
  useActionToast(advanceState)
  useActionToast(revisionState)
  const options = PHASE_STAGES[phase].filter((stage) => stage !== currentStage)
  const today = new Date().toISOString().slice(0, 10)

  return (
    <div className="grid gap-3">
      <Feedback state={mode === 'lanjut' ? advanceState : revisionState} />

      <Field label="Hasil review" htmlFor="dv_mode">
        <Select
          id="dv_mode"
          value={mode}
          onChange={(e) => setMode(e.target.value as 'lanjut' | 'revisi')}
        >
          <option value="lanjut">Lanjut</option>
          <option value="revisi">Revisi</option>
        </Select>
      </Field>

      {mode === 'lanjut' ? (
        <form action={advanceAction} className="grid gap-3">
          <input type="hidden" name="design_id" value={designId} />

          <Field label="Pindah ke tahap" htmlFor="a_stage" required>
            <Select id="a_stage" name="stage" required>
              {options.map((stage) => (
                <option key={stage} value={stage}>
                  {stage}
                </option>
              ))}
            </Select>
          </Field>

          <Field label="Tanggal" htmlFor="a_date" required>
            <Input id="a_date" name="tanggal" type="date" defaultValue={today} required />
          </Field>

          <PicField label="PIC tahap ini" pics={pics} placeholder="Sama seperti sebelumnya" />

          <Field label="PIC Pertamina" htmlFor="a_pic_pertamina">
            <Input
              id="a_pic_pertamina"
              name="pic_pertamina"
              defaultValue={defaultPicPertamina ?? ''}
              placeholder="Sama seperti sebelumnya"
            />
          </Field>

          <Field label="Catatan" htmlFor="a_notes">
            <Input id="a_notes" name="notes" placeholder="Hasil review…" />
          </Field>

          <div>
            <Submit label="Selesai &amp; pindahkan" icon={<ArrowRight size={16} aria-hidden />} />
          </div>
        </form>
      ) : (
        <form action={revisionAction} className="grid gap-3">
          <input type="hidden" name="design_id" value={designId} />
          <input type="hidden" name="entry_id" value={entryId ?? ''} />

          <Field label="Catatan revisi" htmlFor="dv_note" required>
            <Input id="dv_note" name="note" required placeholder="Yang perlu diperbaiki…" />
          </Field>

          <Field label="Disubmit ulang tanggal" htmlFor="dv_resubmit" required>
            <Input id="dv_resubmit" name="resubmit_at" type="date" defaultValue={today} required />
          </Field>

          <div>
            <Submit label="Catat revisi" variant="secondary" icon={<Undo2 size={16} aria-hidden />} />
          </div>
        </form>
      )}
    </div>
  )
}

/**
 * Section 21 — an auto-opened Draft has no revision history yet, so it gets
 * a plain "Mulai" form instead of the Lanjut/Revisi review: there's nothing
 * to review until someone actually starts the stage it opened at.
 */
export function StartDesignForm({
  designId,
  currentStage,
  pics,
}: {
  designId: string
  currentStage: DesignStage
  pics: PicOption[]
}) {
  const [state, formAction] = useActionState(startDesign, initialState)
  useActionToast(state)
  const today = new Date().toISOString().slice(0, 10)

  return (
    <form action={formAction} className="grid gap-3">
      <Feedback state={state} />
      <input type="hidden" name="design_id" value={designId} />

      <div>
        <div className="text-sm font-semibold text-slate-700">Tahap</div>
        <div className="mt-1 text-sm font-bold text-slate-900">{currentStage}</div>
      </div>

      <Field label="Tanggal" htmlFor="s_date" required>
        <Input id="s_date" name="tanggal" type="date" defaultValue={today} required />
      </Field>

      <PicField label="PIC" pics={pics} placeholder="Nama PIC" />

      <Field label="PIC Pertamina" htmlFor="s_pic_pertamina">
        <Input id="s_pic_pertamina" name="pic_pertamina" placeholder="Reviewer Pertamina" />
      </Field>

      <div>
        <Submit label="Mulai pengerjaan" icon={<Plus size={16} aria-hidden />} />
      </div>
    </form>
  )
}

/** Fixes tanggal/PIC/catatan on one history row — never the stage itself
 *  (see updateRevisionEntry in actions.ts for why). */
export function EditRevisionEntryButton({
  designId,
  pics,
  entry,
}: {
  designId: string
  pics: PicOption[]
  entry: {
    id: string
    started_at: string | null
    notes: string | null
    pic_pertamina: string | null
  }
}) {
  const [open, setOpen] = useState(false)
  const [state, formAction] = useActionState(updateRevisionEntry, initialState)
  useActionToast(state, () => setOpen(false))

  return (
    <Modal
      open={open}
      onOpenChange={setOpen}
      title="Edit entri tahap"
      trigger={
        <button
          type="button"
          className="inline-flex items-center gap-1 text-xs font-bold text-primary hover:underline"
          aria-label="Edit entri"
        >
          <Pencil size={12} aria-hidden />
          Edit
        </button>
      }
    >
      <form action={formAction} className="grid gap-3">
        {state.error && <Alert tone="danger">{state.error}</Alert>}
        <input type="hidden" name="entry_id" value={entry.id} />
        <input type="hidden" name="design_id" value={designId} />

        <Field label="Tanggal" htmlFor="e_tanggal" required>
          <Input
            id="e_tanggal"
            name="tanggal"
            type="date"
            defaultValue={entry.started_at?.slice(0, 10)}
            required
          />
        </Field>

        <PicField label="PIC" pics={pics} placeholder="Nama PIC" />

        <Field label="PIC Pertamina" htmlFor="e_pic_pertamina">
          <Input
            id="e_pic_pertamina"
            name="pic_pertamina"
            defaultValue={entry.pic_pertamina ?? ''}
            placeholder="Reviewer Pertamina"
          />
        </Field>

        <Field label="Catatan" htmlFor="e_notes">
          <Input id="e_notes" name="notes" defaultValue={entry.notes ?? ''} />
        </Field>

        <div className="flex justify-end gap-2">
          <Button type="button" variant="secondary" onClick={() => setOpen(false)}>
            Batal
          </Button>
          <Submit label="Simpan" />
        </div>
      </form>
    </Modal>
  )
}

/** Only ever shown for the latest history row — see deleteRevisionEntry. */
export function DeleteRevisionEntryButton({
  designId,
  entryId,
}: {
  designId: string
  entryId: string
}) {
  return (
    <DeleteButton
      action={deleteRevisionEntry}
      hiddenFields={{ entry_id: entryId, design_id: designId }}
      itemLabel="tahap terakhir ini"
      confirmText="Batalkan tahap terakhir ini? Desain kembali ke tahap sebelumnya, dan progress SPK yang sudah tersinkron dari tahap ini ikut dibatalkan."
    />
  )
}

