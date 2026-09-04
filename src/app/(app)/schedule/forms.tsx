'use client'

import { useActionState, useState } from 'react'
import { useFormStatus } from 'react-dom'
import { Pencil, Plus } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Field, Input, Select } from '@/components/ui/field'
import { Alert } from '@/components/ui/alert'
import { Modal } from '@/components/ui/modal'
import { useActionToast } from '@/components/ui/toast'
import type { Database } from '@/lib/supabase/types'
import {
  createDailyPlan,
  createDailyProgress,
  setPlanStatus,
  setProgressStatus,
  updateDailyPlan,
  updateDailyProgress,
  type ScheduleState,
} from './actions'
import type { ScheduleOptions } from './options'

type DailyPlanRow = Database['public']['Tables']['daily_plans']['Row']
type DailyProgressRow = Database['public']['Tables']['daily_progress']['Row']
/** A plan the progress form can be filed against — SPK-scoped by the cascade. */
export type PlanOption = { id: string; label: string; spkId: string }

const initialState: ScheduleState = { error: null }

function Feedback({ state }: { state: ScheduleState }) {
  if (state.error) return <Alert tone="danger">{state.error}</Alert>
  if (state.success) return <Alert tone="success">{state.success}</Alert>
  return null
}

function Submit({ label }: { label: string }) {
  const { pending } = useFormStatus()
  return (
    <Button type="submit" disabled={pending}>
      {pending ? 'Menyimpan…' : label}
    </Button>
  )
}

/** SPK → activity, vendor → team: the second select follows the first. */
function useCascade(options: ScheduleOptions, initialSpkId?: string, initialVendorId?: string) {
  const [spkId, setSpkId] = useState(initialSpkId ?? options.spks[0]?.id ?? '')
  const [vendorId, setVendorId] = useState(initialVendorId ?? '')

  return {
    spkId,
    setSpkId,
    vendorId,
    setVendorId,
    activities: options.activities.filter((a) => a.spkId === spkId),
    teams: vendorId ? options.teams.filter((t) => t.vendorId === vendorId) : [],
  }
}

export function DailyPlanForm({
  options,
  plan,
  onSaved,
}: {
  options: ScheduleOptions
  /** Present → editing this existing plan instead of creating a new one. */
  plan?: DailyPlanRow
  onSaved?: () => void
}) {
  const editing = !!plan
  const [state, formAction] = useActionState(editing ? updateDailyPlan : createDailyPlan, initialState)
  const cascade = useCascade(options, plan?.spk_id, plan?.vendor_id ?? undefined)
  const today = new Date().toISOString().slice(0, 10)
  useActionToast(state, onSaved)

  if (options.spks.length === 0 && !editing) {
    return (
      <Alert tone="warning">
        Belum ada SPK berstatus Draft atau On Going untuk dijadwalkan.
      </Alert>
    )
  }

  return (
    <form action={formAction} className="grid gap-4">
      <Feedback state={state} />

      {plan && <input type="hidden" name="id" value={plan.id} />}

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        <Field label="SPK" htmlFor="plan_spk" required className="lg:col-span-2">
          <Select
            id="plan_spk"
            name="spk_id"
            value={cascade.spkId}
            onChange={(event) => cascade.setSpkId(event.target.value)}
            required
          >
            {options.spks.map((spk) => (
              <option key={spk.id} value={spk.id}>
                {spk.label}
              </option>
            ))}
          </Select>
        </Field>

        <Field label="Tanggal" htmlFor="plan_date" required>
          <Input
            id="plan_date"
            name="plan_date"
            type="date"
            defaultValue={plan?.plan_date ?? today}
            required
          />
        </Field>

        <Field
          label="Aktivitas"
          htmlFor="plan_activity"
          hint={
            cascade.activities.length === 0
              ? 'SPK ini belum punya aktivitas — terapkan Progress Template dulu.'
              : undefined
          }
        >
          <Select id="plan_activity" name="spk_activity_id" defaultValue={plan?.spk_activity_id ?? ''}>
            <option value="">— tidak spesifik —</option>
            {cascade.activities.map((activity) => (
              <option key={activity.id} value={activity.id}>
                {activity.label}
              </option>
            ))}
          </Select>
        </Field>

        <Field label="Vendor" htmlFor="plan_vendor">
          <Select
            id="plan_vendor"
            name="vendor_id"
            value={cascade.vendorId}
            onChange={(event) => cascade.setVendorId(event.target.value)}
          >
            <option value="">— tidak spesifik —</option>
            {options.vendors.map((vendor) => (
              <option key={vendor.id} value={vendor.id}>
                {vendor.label}
              </option>
            ))}
          </Select>
        </Field>

        <Field label="Team" htmlFor="plan_team">
          <Select id="plan_team" name="team_id" defaultValue={plan?.team_id ?? ''}>
            <option value="">— seluruh vendor —</option>
            {cascade.teams.map((team) => (
              <option key={team.id} value={team.id}>
                {team.label}
              </option>
            ))}
          </Select>
        </Field>

        <Field label="Target" htmlFor="plan_target">
          <Input
            id="plan_target"
            name="target_value"
            inputMode="decimal"
            placeholder="1.5"
            defaultValue={plan?.target_value ?? undefined}
          />
        </Field>

        <Field label="Satuan" htmlFor="plan_unit" hint="Kosong = ikut satuan aktivitas.">
          <Input id="plan_unit" name="unit" placeholder="Ha" defaultValue={plan?.unit ?? undefined} />
        </Field>

        <Field label="Catatan" htmlFor="plan_notes" className="sm:col-span-2">
          <Input id="plan_notes" name="notes" defaultValue={plan?.notes ?? undefined} />
        </Field>
      </div>

      <div>
        <Submit label={editing ? 'Simpan perubahan' : 'Simpan Daily Plan'} />
      </div>
    </form>
  )
}

/** Row-level "Edit" trigger — opens the same form pre-filled. */
export function EditDailyPlanButton({ plan, options }: { plan: DailyPlanRow; options: ScheduleOptions }) {
  const [open, setOpen] = useState(false)
  return (
    <Modal
      open={open}
      onOpenChange={setOpen}
      title="Edit Daily Plan"
      trigger={
        <button
          type="button"
          className="inline-flex items-center gap-1 text-xs font-bold text-primary hover:underline"
          aria-label="Edit"
        >
          <Pencil size={14} aria-hidden />
          Edit
        </button>
      }
    >
      <DailyPlanForm options={options} plan={plan} onSaved={() => setOpen(false)} />
    </Modal>
  )
}

export function AddDailyPlanButton({ options }: { options: ScheduleOptions }) {
  const [open, setOpen] = useState(false)
  return (
    <Modal
      open={open}
      onOpenChange={setOpen}
      title="Rencana baru"
      description="Target di sini yang nanti dibandingkan dengan hasil aktual."
      size="lg"
      trigger={
        <Button type="button">
          <Plus size={16} aria-hidden />
          Add Data
        </Button>
      }
    >
      <DailyPlanForm options={options} onSaved={() => setOpen(false)} />
    </Modal>
  )
}

export function DailyProgressForm({
  options,
  plans,
  entry,
  onSaved,
}: {
  options: ScheduleOptions
  plans: PlanOption[]
  /** Present → editing this existing entry instead of creating a new one. */
  entry?: DailyProgressRow
  onSaved?: () => void
}) {
  const editing = !!entry
  const [state, formAction] = useActionState(
    editing ? updateDailyProgress : createDailyProgress,
    initialState,
  )
  const cascade = useCascade(options, entry?.spk_id, entry?.vendor_id ?? undefined)
  const today = new Date().toISOString().slice(0, 10)
  useActionToast(state, onSaved)

  const spkPlans = plans.filter((plan) => plan.spkId === cascade.spkId)

  if (options.spks.length === 0 && !editing) {
    return <Alert tone="warning">Belum ada SPK aktif untuk dilaporkan.</Alert>
  }

  return (
    <form action={formAction} className="grid gap-4">
      <Feedback state={state} />

      {entry && <input type="hidden" name="id" value={entry.id} />}

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        <Field label="SPK" htmlFor="prog_spk" required className="lg:col-span-2">
          <Select
            id="prog_spk"
            name="spk_id"
            value={cascade.spkId}
            onChange={(event) => cascade.setSpkId(event.target.value)}
            required
          >
            {options.spks.map((spk) => (
              <option key={spk.id} value={spk.id}>
                {spk.label}
              </option>
            ))}
          </Select>
        </Field>

        <Field label="Tanggal" htmlFor="prog_date" required>
          <Input
            id="prog_date"
            name="progress_date"
            type="date"
            defaultValue={entry?.progress_date ?? today}
            required
          />
        </Field>

        <Field
          label="Daily Plan"
          htmlFor="prog_plan"
          hint="Memilih plan otomatis mewarisi aktivitas, vendor, dan team-nya."
          className="lg:col-span-2"
        >
          <Select id="prog_plan" name="daily_plan_id" defaultValue={entry?.daily_plan_id ?? ''}>
            <option value="">— tanpa plan —</option>
            {spkPlans.map((plan) => (
              <option key={plan.id} value={plan.id}>
                {plan.label}
              </option>
            ))}
          </Select>
        </Field>

        <Field label="Aktivitas" htmlFor="prog_activity">
          <Select id="prog_activity" name="spk_activity_id" defaultValue={entry?.spk_activity_id ?? ''}>
            <option value="">— ikut plan —</option>
            {cascade.activities.map((activity) => (
              <option key={activity.id} value={activity.id}>
                {activity.label}
              </option>
            ))}
          </Select>
        </Field>

        <Field
          label="Hasil hari ini"
          htmlFor="prog_actual"
          required
          hint="Tambahan hari itu saja, bukan kumulatif."
        >
          <Input
            id="prog_actual"
            name="actual_value"
            inputMode="decimal"
            required
            placeholder="1.4"
            defaultValue={entry?.actual_value ?? undefined}
          />
        </Field>

        <Field label="Satuan" htmlFor="prog_unit">
          <Input id="prog_unit" name="unit" placeholder="Ha" defaultValue={entry?.unit ?? undefined} />
        </Field>

        <Field label="Catatan" htmlFor="prog_notes">
          <Input id="prog_notes" name="notes" defaultValue={entry?.notes ?? undefined} />
        </Field>
      </div>

      <div>
        <Submit label={editing ? 'Simpan perubahan' : 'Simpan Daily Progress'} />
      </div>
    </form>
  )
}

/** Row-level "Edit" trigger — opens the same form pre-filled. */
export function AddDailyProgressButton({
  options,
  plans,
}: {
  options: ScheduleOptions
  plans: PlanOption[]
}) {
  const [open, setOpen] = useState(false)
  return (
    <Modal
      open={open}
      onOpenChange={setOpen}
      title="Laporan hari ini"
      description="Isi tambahan hari itu saja. Sistem yang menjumlahkannya jadi kumulatif dan menaikkan Overall Progress."
      size="lg"
      trigger={
        <Button type="button">
          <Plus size={16} aria-hidden />
          Add Data
        </Button>
      }
    >
      <DailyProgressForm options={options} plans={plans} onSaved={() => setOpen(false)} />
    </Modal>
  )
}

export function EditDailyProgressButton({
  entry,
  options,
  plans,
}: {
  entry: DailyProgressRow
  options: ScheduleOptions
  plans: { id: string; label: string; spkId: string }[]
}) {
  const [open, setOpen] = useState(false)
  return (
    <Modal
      open={open}
      onOpenChange={setOpen}
      title="Edit Daily Progress"
      trigger={
        <button
          type="button"
          className="inline-flex items-center gap-1 text-xs font-bold text-primary hover:underline"
          aria-label="Edit"
        >
          <Pencil size={14} aria-hidden />
          Edit
        </button>
      }
    >
      <DailyProgressForm options={options} plans={plans} entry={entry} onSaved={() => setOpen(false)} />
    </Modal>
  )
}

function ToggleSubmit({ label }: { label: string }) {
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

export function ScheduleStatusToggle({
  kind,
  id,
  status,
}: {
  kind: 'plan' | 'progress'
  id: string
  status: string
}) {
  const action = kind === 'plan' ? setPlanStatus : setProgressStatus
  const [state, formAction] = useActionState(action, initialState)
  const next = status === 'Active' ? 'Inactive' : 'Active'
  useActionToast(state)

  return (
    <form action={formAction} className="inline">
      <input type="hidden" name="id" value={id} />
      <input type="hidden" name="status" value={next} />
      <ToggleSubmit label={next === 'Active' ? 'Aktifkan' : 'Batalkan'} />
      {state.error && <span className="ml-2 text-xs text-danger">{state.error}</span>}
    </form>
  )
}
