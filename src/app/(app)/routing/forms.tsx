'use client'

import { useActionState } from 'react'
import { useFormStatus } from 'react-dom'
import { ArrowRight, Plus, RotateCcw } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Field, Input, Select, Textarea } from '@/components/ui/field'
import { Alert } from '@/components/ui/alert'
import type { SpkRoutingRow } from '@/lib/supabase/types'
import {
  advanceStep,
  createRouting,
  setStepStatus,
  updateRouting,
  type RoutingState,
} from './actions'

const initialState: RoutingState = { error: null }

export type Option = { id: string; label: string }

/** Section 23 — the document kinds that actually get routed on this project. */
const DOCUMENT_TYPES = [
  'Berita Acara Opname',
  'PAD',
  'Invoice',
  'Laporan Akhir',
  'Dokumen Desain',
]

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
  templates,
}: {
  spks: Option[]
  templates: Option[]
}) {
  const [state, formAction] = useActionState(createRouting, initialState)

  if (spks.length === 0 || templates.length === 0) {
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

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Field label="SPK" htmlFor="r_spk" required className="lg:col-span-2">
          <Select id="r_spk" name="spk_id" required>
            {spks.map((spk) => (
              <option key={spk.id} value={spk.id}>
                {spk.label}
              </option>
            ))}
          </Select>
        </Field>

        <Field label="Template routing" htmlFor="r_template" required>
          <Select id="r_template" name="template_id" required>
            {templates.map((template) => (
              <option key={template.id} value={template.id}>
                {template.label}
              </option>
            ))}
          </Select>
        </Field>

        <Field label="Jenis dokumen" htmlFor="r_type" required>
          <Select id="r_type" name="document_type" required>
            {DOCUMENT_TYPES.map((type) => (
              <option key={type} value={type}>
                {type}
              </option>
            ))}
          </Select>
        </Field>

        <Field label="Nomor dokumen" htmlFor="r_number">
          <Input id="r_number" name="document_number" placeholder="BA-OPN-2026-014" />
        </Field>

        <Field label="Catatan" htmlFor="r_notes" className="sm:col-span-2 lg:col-span-3">
          <Input id="r_notes" name="notes" />
        </Field>
      </div>

      <div>
        <Submit label="Rutekan dokumen" icon={<Plus size={16} aria-hidden />} />
      </div>
    </form>
  )
}

/** Hands the document to the next stage in the chain. */
export function AdvanceStepForm({
  routingId,
  stepId,
  defaultPic,
}: {
  routingId: string
  stepId: string
  defaultPic: string | null
}) {
  const [state, formAction] = useActionState(advanceStep, initialState)

  return (
    <form action={formAction} className="grid gap-3">
      <Feedback state={state} />
      <input type="hidden" name="routing_id" value={routingId} />
      <input type="hidden" name="step_id" value={stepId} />

      <div className="flex flex-wrap items-end gap-3">
        <Field label="PIC tahap ini" htmlFor="adv_pic" className="min-w-[180px]">
          <Input id="adv_pic" name="pic_name" defaultValue={defaultPic ?? ''} />
        </Field>
        <Field label="Catatan" htmlFor="adv_note" className="min-w-[220px] flex-1">
          <Input id="adv_note" name="note" placeholder="Hasil pemeriksaan…" />
        </Field>
        <Submit label="Selesai &amp; teruskan" icon={<ArrowRight size={16} aria-hidden />} />
      </div>
    </form>
  )
}

/** Return, reject, or resume — the three ways a stage ends other than passing. */
export function StepStatusForm({
  routingId,
  stepId,
  status,
}: {
  routingId: string
  stepId: string
  status: string
}) {
  const [state, formAction] = useActionState(setStepStatus, initialState)
  const blocked = status === 'Returned' || status === 'Rejected'

  return (
    <form action={formAction} className="grid gap-3">
      <Feedback state={state} />
      <input type="hidden" name="routing_id" value={routingId} />
      <input type="hidden" name="step_id" value={stepId} />

      <div className="flex flex-wrap items-end gap-3">
        <Field label="Ubah status tahap" htmlFor="st_status" className="min-w-[170px]">
          <Select id="st_status" name="status" defaultValue={blocked ? 'In Progress' : 'Returned'}>
            {blocked ? (
              <option value="In Progress">Lanjutkan kembali</option>
            ) : (
              <>
                <option value="Returned">Dikembalikan</option>
                <option value="Rejected">Ditolak</option>
              </>
            )}
          </Select>
        </Field>
        <Field label="Alasan" htmlFor="st_note" className="min-w-[220px] flex-1">
          <Input id="st_note" name="note" required placeholder="Alasan pengembalian…" />
        </Field>
        <Submit
          label={blocked ? 'Lanjutkan' : 'Simpan'}
          variant="secondary"
          icon={blocked ? <RotateCcw size={16} aria-hidden /> : undefined}
        />
      </div>
    </form>
  )
}

export function RoutingDetailsForm({ routing }: { routing: SpkRoutingRow }) {
  const [state, formAction] = useActionState(updateRouting, initialState)

  return (
    <form action={formAction} className="grid gap-4">
      <Feedback state={state} />
      <input type="hidden" name="id" value={routing.id} />

      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Jenis dokumen" htmlFor="u_type" required>
          <Select id="u_type" name="document_type" defaultValue={routing.document_type}>
            {[...new Set([routing.document_type, ...DOCUMENT_TYPES])].map((type) => (
              <option key={type} value={type}>
                {type}
              </option>
            ))}
          </Select>
        </Field>

        <Field label="Nomor dokumen" htmlFor="u_number">
          <Input
            id="u_number"
            name="document_number"
            defaultValue={routing.document_number ?? ''}
          />
        </Field>

        <Field label="Catatan" htmlFor="u_notes" className="sm:col-span-2">
          <Textarea id="u_notes" name="notes" defaultValue={routing.notes ?? ''} />
        </Field>
      </div>

      <div>
        <Submit label="Simpan perubahan" />
      </div>
    </form>
  )
}
