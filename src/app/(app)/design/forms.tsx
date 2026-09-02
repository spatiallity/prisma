'use client'

import { useActionState } from 'react'
import { useFormStatus } from 'react-dom'
import { ArrowRight, Plus } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Field, Input, Select, Textarea } from '@/components/ui/field'
import { Alert } from '@/components/ui/alert'
import { useActionToast } from '@/components/ui/toast'
import { DESIGN_STAGES, type DesignRow, type DesignStage } from '@/lib/supabase/types'
import {
  advanceStage,
  createDesign,
  updateDesign,
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

export function NewDesignForm({
  spks,
  pics,
}: {
  spks: SpkOption[]
  pics: PicOption[]
}) {
  const [state, formAction] = useActionState(createDesign, initialState)
  useActionToast(state)

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

        <Field label="PIC" htmlFor="d_pic">
          <Select id="d_pic" name="pic_id" defaultValue="">
            <option value="">— belum ditentukan —</option>
            {pics.map((pic) => (
              <option key={pic.id} value={pic.id}>
                {pic.label}
              </option>
            ))}
          </Select>
        </Field>

        <Field label="Target selesai" htmlFor="d_target">
          <Input id="d_target" name="target_date" type="date" />
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

        <Field label="PIC tahap ini" htmlFor="a_pic" className="min-w-[180px]">
          <Select id="a_pic" name="pic_id" defaultValue="">
            <option value="">— sama seperti sebelumnya —</option>
            {pics.map((pic) => (
              <option key={pic.id} value={pic.id}>
                {pic.label}
              </option>
            ))}
          </Select>
        </Field>

        <Field label="Catatan" htmlFor="a_notes" className="min-w-[200px] flex-1">
          <Input id="a_notes" name="notes" placeholder="Alasan revisi, hasil review…" />
        </Field>

        <Submit label="Pindahkan" icon={<ArrowRight size={16} aria-hidden />} />
      </div>
      <p className="text-xs text-muted-foreground">
        Memilih <strong>Revisi</strong> memulai putaran revisi baru; tahap lain
        melanjutkan putaran yang sedang berjalan.
      </p>
    </form>
  )
}

export function DesignDetailsForm({
  design,
  pics,
}: {
  design: DesignRow
  pics: PicOption[]
}) {
  const [state, formAction] = useActionState(updateDesign, initialState)
  useActionToast(state)

  return (
    <form action={formAction} className="grid gap-4">
      <Feedback state={state} />
      <input type="hidden" name="id" value={design.id} />

      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Judul desain" htmlFor="u_title">
          <Input id="u_title" name="title" defaultValue={design.title ?? ''} />
        </Field>

        <Field label="PIC" htmlFor="u_pic">
          <Select id="u_pic" name="pic_id" defaultValue={design.pic_id ?? ''}>
            <option value="">— belum ditentukan —</option>
            {pics.map((pic) => (
              <option key={pic.id} value={pic.id}>
                {pic.label}
              </option>
            ))}
          </Select>
        </Field>

        <Field label="Target selesai" htmlFor="u_target">
          <Input
            id="u_target"
            name="target_date"
            type="date"
            defaultValue={design.target_date ?? ''}
          />
        </Field>

        <Field
          label="Status"
          htmlFor="u_status"
          hint="Record dinonaktifkan, tidak dihapus."
        >
          <Select id="u_status" name="status" defaultValue={design.status}>
            <option value="Active">Active</option>
            <option value="Inactive">Inactive</option>
            <option value="Archived">Archived</option>
          </Select>
        </Field>

        <Field label="Catatan" htmlFor="u_notes" className="sm:col-span-2">
          <Textarea id="u_notes" name="notes" defaultValue={design.notes ?? ''} />
        </Field>
      </div>

      <div>
        <Submit label="Simpan perubahan" />
      </div>
    </form>
  )
}
