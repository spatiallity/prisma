'use client'

import { useActionState, useState } from 'react'
import { useFormStatus } from 'react-dom'
import { Button } from '@/components/ui/button'
import { Field, Input, Select } from '@/components/ui/field'
import { Alert } from '@/components/ui/alert'
import {
  createDailyPlan,
  createDailyProgress,
  setPlanStatus,
  setProgressStatus,
  type ScheduleState,
} from './actions'
import type { ScheduleOptions } from './options'

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
function useCascade(options: ScheduleOptions) {
  const [spkId, setSpkId] = useState(options.spks[0]?.id ?? '')
  const [vendorId, setVendorId] = useState('')

  return {
    spkId,
    setSpkId,
    vendorId,
    setVendorId,
    activities: options.activities.filter((a) => a.spkId === spkId),
    teams: vendorId ? options.teams.filter((t) => t.vendorId === vendorId) : [],
  }
}

export function DailyPlanForm({ options }: { options: ScheduleOptions }) {
  const [state, formAction] = useActionState(createDailyPlan, initialState)
  const cascade = useCascade(options)
  const today = new Date().toISOString().slice(0, 10)

  if (options.spks.length === 0) {
    return (
      <Alert tone="warning">
        Belum ada SPK berstatus Draft atau On Going untuk dijadwalkan.
      </Alert>
    )
  }

  return (
    <form action={formAction} className="grid gap-4">
      <Feedback state={state} />

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
          <Input id="plan_date" name="plan_date" type="date" defaultValue={today} required />
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
          <Select id="plan_activity" name="spk_activity_id" defaultValue="">
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
          <Select id="plan_team" name="team_id" defaultValue="">
            <option value="">— seluruh vendor —</option>
            {cascade.teams.map((team) => (
              <option key={team.id} value={team.id}>
                {team.label}
              </option>
            ))}
          </Select>
        </Field>

        <Field label="Target" htmlFor="plan_target">
          <Input id="plan_target" name="target_value" inputMode="decimal" placeholder="1.5" />
        </Field>

        <Field label="Satuan" htmlFor="plan_unit" hint="Kosong = ikut satuan aktivitas.">
          <Input id="plan_unit" name="unit" placeholder="Ha" />
        </Field>

        <Field label="Catatan" htmlFor="plan_notes" className="sm:col-span-2">
          <Input id="plan_notes" name="notes" />
        </Field>
      </div>

      <div>
        <Submit label="Simpan Daily Plan" />
      </div>
    </form>
  )
}

export function DailyProgressForm({
  options,
  plans,
}: {
  options: ScheduleOptions
  plans: { id: string; label: string; spkId: string }[]
}) {
  const [state, formAction] = useActionState(createDailyProgress, initialState)
  const cascade = useCascade(options)
  const today = new Date().toISOString().slice(0, 10)

  const spkPlans = plans.filter((plan) => plan.spkId === cascade.spkId)

  if (options.spks.length === 0) {
    return <Alert tone="warning">Belum ada SPK aktif untuk dilaporkan.</Alert>
  }

  return (
    <form action={formAction} className="grid gap-4">
      <Feedback state={state} />

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
            defaultValue={today}
            required
          />
        </Field>

        <Field
          label="Daily Plan"
          htmlFor="prog_plan"
          hint="Memilih plan otomatis mewarisi aktivitas, vendor, dan team-nya."
          className="lg:col-span-2"
        >
          <Select id="prog_plan" name="daily_plan_id" defaultValue="">
            <option value="">— tanpa plan —</option>
            {spkPlans.map((plan) => (
              <option key={plan.id} value={plan.id}>
                {plan.label}
              </option>
            ))}
          </Select>
        </Field>

        <Field label="Aktivitas" htmlFor="prog_activity">
          <Select id="prog_activity" name="spk_activity_id" defaultValue="">
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
          />
        </Field>

        <Field label="Satuan" htmlFor="prog_unit">
          <Input id="prog_unit" name="unit" placeholder="Ha" />
        </Field>

        <Field label="Catatan" htmlFor="prog_notes">
          <Input id="prog_notes" name="notes" />
        </Field>
      </div>

      <div>
        <Submit label="Simpan Daily Progress" />
      </div>
    </form>
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

  return (
    <form action={formAction} className="inline">
      <input type="hidden" name="id" value={id} />
      <input type="hidden" name="status" value={next} />
      <ToggleSubmit label={next === 'Active' ? 'Aktifkan' : 'Batalkan'} />
      {state.error && <span className="ml-2 text-xs text-danger">{state.error}</span>}
    </form>
  )
}
