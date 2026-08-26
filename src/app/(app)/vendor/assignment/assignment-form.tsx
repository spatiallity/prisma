'use client'

import { useActionState, useState } from 'react'
import { useFormStatus } from 'react-dom'
import { Button } from '@/components/ui/button'
import { Field, Input, Select, Textarea } from '@/components/ui/field'
import { Alert } from '@/components/ui/alert'
import {
  createAssignment,
  setAssignmentStatus,
  type VendorFormState,
} from '../actions'

const initialState: VendorFormState = { error: null }

export type SpkOption = { id: string; label: string }
export type VendorOption = { id: string; label: string }
export type TeamOption = { id: string; vendorId: string; label: string }

function Submit() {
  const { pending } = useFormStatus()
  return (
    <Button type="submit" disabled={pending}>
      {pending ? 'Menyimpan…' : 'Buat assignment'}
    </Button>
  )
}

export function AssignmentForm({
  spks,
  vendors,
  teams,
}: {
  spks: SpkOption[]
  vendors: VendorOption[]
  teams: TeamOption[]
}) {
  const [state, formAction] = useActionState(createAssignment, initialState)
  const [vendorId, setVendorId] = useState(vendors[0]?.id ?? '')

  // A team belongs to exactly one vendor, so the list narrows with the choice.
  const vendorTeams = teams.filter((team) => team.vendorId === vendorId)

  if (spks.length === 0 || vendors.length === 0) {
    return (
      <Alert tone="warning">
        Butuh minimal satu SPK dan satu vendor sebelum assignment bisa dibuat.
      </Alert>
    )
  }

  return (
    <form action={formAction} className="grid gap-4">
      {state.error && <Alert tone="danger">{state.error}</Alert>}
      {state.success && <Alert tone="success">{state.success}</Alert>}

      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="SPK" htmlFor="spk_id" required>
          <Select id="spk_id" name="spk_id" required>
            {spks.map((spk) => (
              <option key={spk.id} value={spk.id}>
                {spk.label}
              </option>
            ))}
          </Select>
        </Field>

        <Field label="Vendor" htmlFor="vendor_id" required>
          <Select
            id="vendor_id"
            name="vendor_id"
            value={vendorId}
            onChange={(event) => setVendorId(event.target.value)}
            required
          >
            {vendors.map((vendor) => (
              <option key={vendor.id} value={vendor.id}>
                {vendor.label}
              </option>
            ))}
          </Select>
        </Field>

        <Field
          label="Team"
          htmlFor="team_id"
          hint="Kosongkan bila seluruh vendor yang ditugaskan."
        >
          <Select id="team_id" name="team_id" defaultValue="">
            <option value="">— seluruh vendor —</option>
            {vendorTeams.map((team) => (
              <option key={team.id} value={team.id}>
                {team.label}
              </option>
            ))}
          </Select>
        </Field>

        <div className="grid grid-cols-2 gap-3">
          <Field label="Mulai" htmlFor="assigned_from">
            <Input id="assigned_from" name="assigned_from" type="date" />
          </Field>
          <Field label="Selesai" htmlFor="assigned_to">
            <Input id="assigned_to" name="assigned_to" type="date" />
          </Field>
        </div>

        <Field label="Catatan" htmlFor="notes" className="sm:col-span-2">
          <Textarea id="notes" name="notes" />
        </Field>
      </div>

      <div>
        <Submit />
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

export function AssignmentStatusToggle({
  id,
  spkId,
  status,
}: {
  id: string
  spkId: string
  status: string
}) {
  const [state, formAction] = useActionState(setAssignmentStatus, initialState)
  const next = status === 'Active' ? 'Inactive' : 'Active'

  return (
    <form action={formAction} className="inline">
      <input type="hidden" name="id" value={id} />
      <input type="hidden" name="spk_id" value={spkId} />
      <input type="hidden" name="status" value={next} />
      <ToggleSubmit label={next === 'Active' ? 'Aktifkan' : 'Akhiri'} />
      {state.error && <span className="ml-2 text-xs text-danger">{state.error}</span>}
    </form>
  )
}
