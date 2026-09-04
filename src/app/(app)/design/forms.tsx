'use client'

import { useActionState, useId, useState } from 'react'
import { useFormStatus } from 'react-dom'
import { ArrowRight, Pencil, Plus } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Field, Input, Select } from '@/components/ui/field'
import { Alert } from '@/components/ui/alert'
import { Modal } from '@/components/ui/modal'
import { DeleteButton } from '@/components/ui/delete-button'
import { useActionToast } from '@/components/ui/toast'
import { DESIGN_STAGES, type DesignStage } from '@/lib/supabase/types'
import {
  advanceStage,
  createDesign,
  deleteRevisionEntry,
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

function Submit({ label, icon }: { label: string; icon?: React.ReactNode }) {
  const { pending } = useFormStatus()
  return (
    <Button type="submit" disabled={pending}>
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
}: {
  spks: SpkOption[]
  pics: PicOption[]
}) {
  const [state, formAction] = useActionState(createDesign, initialState)
  useActionToast(state)
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

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Field label="SPK" htmlFor="d_spk" required className="lg:col-span-2">
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

        <Field label="Tanggal mulai" htmlFor="d_start" required>
          <Input id="d_start" name="tanggal" type="date" defaultValue={today} required />
        </Field>

        <Field label="Catatan" htmlFor="d_notes" className="sm:col-span-2 lg:col-span-3">
          <Input id="d_notes" name="notes" />
        </Field>
      </div>

      <div>
        <Submit label="Buka record desain" icon={<Plus size={16} aria-hidden />} />
      </div>
    </form>
  )
}

/** Section 21 — moving the design one step along the chain. */
export function AdvanceStageForm({
  designId,
  currentStage,
  pics,
}: {
  designId: string
  currentStage: DesignStage
  pics: PicOption[]
}) {
  const [state, formAction] = useActionState(advanceStage, initialState)
  useActionToast(state)
  const options = DESIGN_STAGES.filter((stage) => stage !== currentStage)
  const today = new Date().toISOString().slice(0, 10)

  return (
    <form action={formAction} className="grid gap-3">
      <Feedback state={state} />
      <input type="hidden" name="design_id" value={designId} />

      <div className="flex flex-wrap items-end gap-3">
        <Field label="Pindah ke tahap" htmlFor="a_stage" required className="min-w-[180px]">
          <Select id="a_stage" name="stage" required>
            {options.map((stage) => (
              <option key={stage} value={stage}>
                {stage}
              </option>
            ))}
          </Select>
        </Field>

        <Field label="Tanggal" htmlFor="a_date" required className="w-44">
          <Input id="a_date" name="tanggal" type="date" defaultValue={today} required />
        </Field>

        <PicField
          label="PIC tahap ini"
          pics={pics}
          placeholder="Sama seperti sebelumnya"
          className="min-w-[180px]"
        />

        <Field label="Catatan" htmlFor="a_notes" className="min-w-[200px] flex-1">
          <Input id="a_notes" name="notes" placeholder="Alasan revisi, hasil review…" />
        </Field>

        <Submit label="Pindahkan" icon={<ArrowRight size={16} aria-hidden />} />
      </div>
      <p className="text-xs text-muted-foreground">
        Memilih <strong>Revisi Desain Awal</strong> memulai putaran revisi baru; tahap
        lain melanjutkan putaran yang sedang berjalan.
      </p>
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
  entry: { id: string; started_at: string | null; notes: string | null }
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

