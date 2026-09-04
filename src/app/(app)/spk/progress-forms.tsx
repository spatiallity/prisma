'use client'

import { useActionState, useState } from 'react'
import { useFormStatus } from 'react-dom'
import { Pencil, Plus, Wand2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Field, Input, Select } from '@/components/ui/field'
import { Alert } from '@/components/ui/alert'
import { Modal } from '@/components/ui/modal'
import { DeleteButton } from '@/components/ui/delete-button'
import { useActionToast } from '@/components/ui/toast'
import {
  MEASUREMENTS,
  STAGE_STATUSES,
  type MeasurementType,
  type StageStatus,
} from '@/lib/supabase/types'
import { MEASUREMENT_LABEL } from '@/lib/progress'
import {
  addActivity,
  applyTemplate,
  deleteProgressEntry,
  recordProgress,
  updateActivityTarget,
  updateProgressEntry,
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
  useActionToast(state)

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
  useActionToast(state)
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

/**
 * Target isn't always known up front — jumlah titik Stake Out, luas
 * Pengukuran Terestris (which only inherits the SPK's luas area as a
 * starting point). Only meaningful for quantity/area measurement — a
 * percentage target is implicitly 100, and a tahapan has no number at all.
 */
export function EditTargetForm({
  spkId,
  activityId,
  unit,
  targetValue,
}: {
  spkId: string
  activityId: string
  unit: string | null
  targetValue: number | null
}) {
  const [state, formAction] = useActionState(updateActivityTarget, initialState)
  useActionToast(state)

  return (
    <form action={formAction} className="flex flex-wrap items-end gap-3">
      <Feedback state={state} />
      <input type="hidden" name="spk_id" value={spkId} />
      <input type="hidden" name="spk_activity_id" value={activityId} />

      <Field label={`Target${unit ? ` (${unit})` : ''}`} htmlFor="target_value" className="w-32">
        <Input
          id="target_value"
          name="target_value"
          inputMode="decimal"
          defaultValue={targetValue ?? ''}
          placeholder="—"
        />
      </Field>

      <Submit label="Simpan target" />
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
  useActionToast(state)
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

/** Section 16 — fixes one existing entry, e.g. a mistyped value or wrong
 *  date. Only for `manual` entries: a `daily_progress`-sourced row is
 *  recomputed from Daily Progress, so correcting it here would just get
 *  overwritten the next time that module recalculates — go fix it there. */
export function EditProgressEntryButton({
  spkId,
  activityId,
  measurement,
  unit,
  targetValue,
  entry,
}: {
  spkId: string
  activityId: string
  measurement: MeasurementType
  unit: string | null
  targetValue: number | null
  entry: {
    id: string
    progress_date: string
    actual_value: number | null
    stage: StageStatus | null
    notes: string | null
  }
}) {
  const [open, setOpen] = useState(false)
  const [state, formAction] = useActionState(updateProgressEntry, initialState)
  useActionToast(state, () => setOpen(false))

  return (
    <Modal
      open={open}
      onOpenChange={setOpen}
      title="Edit entri progress"
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
        <input type="hidden" name="spk_id" value={spkId} />
        <input type="hidden" name="spk_activity_id" value={activityId} />
        <input type="hidden" name="measurement" value={measurement} />

        <Field label="Tanggal" htmlFor="e_progress_date" required>
          <Input
            id="e_progress_date"
            name="progress_date"
            type="date"
            defaultValue={entry.progress_date}
            required
          />
        </Field>

        {measurement === 'stage' ? (
          <Field label="Status tahapan" htmlFor="e_stage" required>
            <Select id="e_stage" name="stage" defaultValue={entry.stage ?? ''} required>
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
            htmlFor="e_actual_value"
            required
            hint={
              measurement !== 'percentage' && targetValue !== null
                ? `Target ${targetValue}${unit ? ` ${unit}` : ''}`
                : undefined
            }
          >
            <Input
              id="e_actual_value"
              name="actual_value"
              inputMode="decimal"
              defaultValue={entry.actual_value ?? ''}
              required
            />
          </Field>
        )}

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

/** Same manual-only scope as EditProgressEntryButton. */
export function DeleteProgressEntryButton({
  spkId,
  activityId,
  entryId,
}: {
  spkId: string
  activityId: string
  entryId: string
}) {
  return (
    <DeleteButton
      action={deleteProgressEntry}
      hiddenFields={{ entry_id: entryId, spk_id: spkId, spk_activity_id: activityId }}
      itemLabel="entri progress ini"
    />
  )
}

