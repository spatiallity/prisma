'use client'

import { useActionState, useState } from 'react'
import { useFormStatus } from 'react-dom'
import { Plus, Wand2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Field, Input, Select } from '@/components/ui/field'
import { Alert } from '@/components/ui/alert'
import {
  MEASUREMENTS,
  STAGE_STATUSES,
  type MeasurementType,
} from '@/lib/supabase/types'
import { MEASUREMENT_LABEL } from '@/lib/progress'
import {
  addActivity,
  applyTemplate,
  recordProgress,
  type ProgressState,
} from './progress-actions'

const initialState: ProgressState = { error: null }

function Feedback({ state }: { state: ProgressState }) {
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

export function ApplyTemplateForm({
  spkId,
  templates,
  defaultTemplateId,
}: {
  spkId: string
  templates: { id: string; label: string }[]
  defaultTemplateId?: string | null
}) {
  const [state, formAction] = useActionState(applyTemplate, initialState)

  if (templates.length === 0) {
    return (
      <Alert tone="warning">
        Belum ada Progress Template aktif. Jalankan seed atau buat template lebih
        dulu.
      </Alert>
    )
  }

  return (
    <form action={formAction} className="grid gap-3">
      <Feedback state={state} />
      <input type="hidden" name="spk_id" value={spkId} />
      <div className="flex flex-wrap items-end gap-3">
        <Field label="Progress Template" htmlFor="template_id" className="min-w-[240px]">
          <Select
            id="template_id"
            name="template_id"
            defaultValue={defaultTemplateId ?? templates[0]?.id}
          >
            {templates.map((template) => (
              <option key={template.id} value={template.id}>
                {template.label}
              </option>
            ))}
          </Select>
        </Field>
        <Submit label="Terapkan template" icon={<Wand2 size={16} aria-hidden />} />
      </div>
      <p className="text-xs text-muted-foreground">
        Aktivitas berbasis luas otomatis memakai luas area SPK sebagai target.
      </p>
    </form>
  )
}

export function AddActivityForm({ spkId }: { spkId: string }) {
  const [state, formAction] = useActionState(addActivity, initialState)
  const [measurement, setMeasurement] = useState<MeasurementType>('percentage')

  return (
    <form action={formAction} className="grid gap-3">
      <Feedback state={state} />
      <input type="hidden" name="spk_id" value={spkId} />

      <div className="flex flex-wrap items-end gap-3">
        <Field label="Nama aktivitas" htmlFor="name" required className="min-w-[220px]">
          <Input id="name" name="name" required placeholder="Pengukuran Terestris" />
        </Field>

        <Field label="Bobot (%)" htmlFor="weight" required className="w-28">
          <Input id="weight" name="weight" inputMode="decimal" required placeholder="20" />
        </Field>

        <Field label="Pengukuran" htmlFor="measurement" className="w-40">
          <Select
            id="measurement"
            name="measurement"
            value={measurement}
            onChange={(event) => setMeasurement(event.target.value as MeasurementType)}
          >
            {MEASUREMENTS.map((type) => (
              <option key={type} value={type}>
                {MEASUREMENT_LABEL[type]}
              </option>
            ))}
          </Select>
        </Field>

        {measurement !== 'stage' && measurement !== 'percentage' && (
          <>
            <Field label="Target" htmlFor="target_value" className="w-28">
              <Input id="target_value" name="target_value" inputMode="decimal" />
            </Field>
            <Field label="Satuan" htmlFor="unit" className="w-24">
              <Input id="unit" name="unit" placeholder="Ha" />
            </Field>
          </>
        )}

        <Submit label="Tambah" icon={<Plus size={16} aria-hidden />} />
      </div>
    </form>
  )
}

/** Section 14 — the input shape follows the activity's measurement type. */
export function RecordProgressForm({
  spkId,
  activityId,
  measurement,
  unit,
  targetValue,
}: {
  spkId: string
  activityId: string
  measurement: MeasurementType
  unit: string | null
  targetValue: number | null
}) {
  const [state, formAction] = useActionState(recordProgress, initialState)
  const today = new Date().toISOString().slice(0, 10)

  return (
    <form action={formAction} className="grid gap-3">
      <Feedback state={state} />
      <input type="hidden" name="spk_id" value={spkId} />
      <input type="hidden" name="spk_activity_id" value={activityId} />
      <input type="hidden" name="measurement" value={measurement} />

      <div className="flex flex-wrap items-end gap-3">
        <Field label="Tanggal" htmlFor="progress_date" required className="w-44">
          <Input
            id="progress_date"
            name="progress_date"
            type="date"
            defaultValue={today}
            required
          />
        </Field>

        {measurement === 'stage' ? (
          <Field label="Status tahapan" htmlFor="stage" required className="w-52">
            <Select id="stage" name="stage" required>
              {STAGE_STATUSES.map((status) => (
                <option key={status} value={status}>
                  {status}
                </option>
              ))}
            </Select>
          </Field>
        ) : (
          <Field
            label={
              measurement === 'percentage'
                ? 'Progress (%)'
                : `Kumulatif${unit ? ` (${unit})` : ''}`
            }
            htmlFor="actual_value"
            required
            className="w-44"
            hint={
              measurement !== 'percentage' && targetValue !== null
                ? `Target ${targetValue}${unit ? ` ${unit}` : ''}`
                : undefined
            }
          >
            <Input id="actual_value" name="actual_value" inputMode="decimal" required />
          </Field>
        )}

        <Field label="Catatan" htmlFor="notes" className="min-w-[200px] flex-1">
          <Input id="notes" name="notes" />
        </Field>

        <Submit label="Catat progress" />
      </div>
    </form>
  )
}

