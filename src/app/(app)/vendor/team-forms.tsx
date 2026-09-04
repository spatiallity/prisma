'use client'

import { useActionState, useState } from 'react'
import { useFormStatus } from 'react-dom'
import { Pencil, Plus } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Field, Input, Select } from '@/components/ui/field'
import { Alert } from '@/components/ui/alert'
import { Modal } from '@/components/ui/modal'
import { DeleteButton } from '@/components/ui/delete-button'
import { useActionToast } from '@/components/ui/toast'
import type { Database } from '@/lib/supabase/types'
import {
  createMember,
  createTeam,
  deleteMember,
  deleteTeam,
  setMemberStatus,
  setTeamStatus,
  updateMember,
  updateTeam,
  type VendorFormState,
} from './actions'

type VendorTeamRow = Database['public']['Tables']['vendor_teams']['Row']
type VendorMemberRow = Database['public']['Tables']['vendor_members']['Row']

const initialState: VendorFormState = { error: null }

function InlineSubmit({ label }: { label: string }) {
  const { pending } = useFormStatus()
  return (
    <Button type="submit" size="sm" disabled={pending}>
      <Plus size={14} aria-hidden />
      {pending ? 'Menyimpan…' : label}
    </Button>
  )
}

function Feedback({ state }: { state: VendorFormState }) {
  if (state.error) return <Alert tone="danger">{state.error}</Alert>
  if (state.success) return <Alert tone="success">{state.success}</Alert>
  return null
}

export function AddTeamForm({
  vendorId,
  onSaved,
}: {
  vendorId: string
  onSaved?: () => void
}) {
  const [state, formAction] = useActionState(createTeam, initialState)
  useActionToast(state, onSaved)

  return (
    <form action={formAction} className="grid gap-3">
      <Feedback state={state} />
      <input type="hidden" name="vendor_id" value={vendorId} />
      <Field label="Nama team" htmlFor="t_name" required>
        <Input id="t_name" name="name" placeholder="Team A" required />
      </Field>
      <div>
        <InlineSubmit label="Tambah team" />
      </div>
    </form>
  )
}

export function AddTeamButton({ vendorId }: { vendorId: string }) {
  const [open, setOpen] = useState(false)
  return (
    <Modal
      open={open}
      onOpenChange={setOpen}
      title="Team baru"
      description="Satu vendor bisa menjalankan beberapa team pada SPK berbeda."
      trigger={
        <Button type="button" size="sm">
          <Plus size={14} aria-hidden />
          Add Data
        </Button>
      }
    >
      <AddTeamForm vendorId={vendorId} onSaved={() => setOpen(false)} />
    </Modal>
  )
}

export function AddMemberForm({
  vendorId,
  teams,
  onSaved,
}: {
  vendorId: string
  teams: { id: string; name: string }[]
  onSaved?: () => void
}) {
  const [state, formAction] = useActionState(createMember, initialState)
  useActionToast(state, onSaved)

  if (teams.length === 0) {
    return (
      <p className="text-sm text-muted-foreground">
        Buat minimal satu team sebelum menambah anggota.
      </p>
    )
  }

  return (
    <form action={formAction} className="grid gap-3">
      <Feedback state={state} />
      <input type="hidden" name="vendor_id" value={vendorId} />
      <div className="grid gap-3 sm:grid-cols-2">
        <Field label="Team" htmlFor="m_team" required>
          <Select id="m_team" name="team_id" required>
            {teams.map((team) => (
              <option key={team.id} value={team.id}>
                {team.name}
              </option>
            ))}
          </Select>
        </Field>
        <Field label="Nama anggota" htmlFor="m_name" required>
          <Input id="m_name" name="full_name" required />
        </Field>
        <Field label="Posisi" htmlFor="m_position">
          <Input id="m_position" name="position" />
        </Field>
        <Field label="Telepon" htmlFor="m_phone">
          <Input id="m_phone" name="phone" />
        </Field>
      </div>
      <div>
        <InlineSubmit label="Tambah anggota" />
      </div>
    </form>
  )
}

function EditSubmit() {
  const { pending } = useFormStatus()
  return (
    <Button type="submit" disabled={pending}>
      <Plus size={16} aria-hidden />
      {pending ? 'Menyimpan…' : 'Simpan perubahan'}
    </Button>
  )
}

/** Row-level "Edit" trigger for a team's name — modal, pre-filled. */
export function AddMemberButton({
  vendorId,
  teams,
}: {
  vendorId: string
  teams: { id: string; name: string }[]
}) {
  const [open, setOpen] = useState(false)
  return (
    <Modal
      open={open}
      onOpenChange={setOpen}
      title="Anggota baru"
      trigger={
        <Button type="button" size="sm">
          <Plus size={14} aria-hidden />
          Add Data
        </Button>
      }
    >
      <AddMemberForm vendorId={vendorId} teams={teams} onSaved={() => setOpen(false)} />
    </Modal>
  )
}

export function EditTeamButton({ team, vendorId }: { team: VendorTeamRow; vendorId: string }) {
  const [open, setOpen] = useState(false)
  const [state, formAction] = useActionState(updateTeam, initialState)
  useActionToast(state, () => setOpen(false))

  return (
    <Modal
      open={open}
      onOpenChange={setOpen}
      title="Edit team"
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
      <form action={formAction} className="grid gap-3">
        <Feedback state={state} />
        <input type="hidden" name="id" value={team.id} />
        <input type="hidden" name="vendor_id" value={vendorId} />
        <Field label="Nama team" htmlFor="et_name" required>
          <Input id="et_name" name="name" required defaultValue={team.name} />
        </Field>
        <div>
          <EditSubmit />
        </div>
      </form>
    </Modal>
  )
}

/** Row-level "Edit" trigger for a member's details — modal, pre-filled. */
export function EditMemberButton({
  member,
  vendorId,
  teams,
}: {
  member: VendorMemberRow
  vendorId: string
  teams: { id: string; name: string }[]
}) {
  const [open, setOpen] = useState(false)
  const [state, formAction] = useActionState(updateMember, initialState)
  useActionToast(state, () => setOpen(false))

  return (
    <Modal
      open={open}
      onOpenChange={setOpen}
      title="Edit anggota"
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
      <form action={formAction} className="grid gap-3">
        <Feedback state={state} />
        <input type="hidden" name="id" value={member.id} />
        <input type="hidden" name="vendor_id" value={vendorId} />
        <Field label="Team" htmlFor="em_team" required>
          <Select id="em_team" name="team_id" required defaultValue={member.team_id}>
            {teams.map((team) => (
              <option key={team.id} value={team.id}>
                {team.name}
              </option>
            ))}
          </Select>
        </Field>
        <Field label="Nama anggota" htmlFor="em_name" required>
          <Input id="em_name" name="full_name" required defaultValue={member.full_name} />
        </Field>
        <Field label="Posisi" htmlFor="em_pos">
          <Input id="em_pos" name="position" defaultValue={member.position ?? undefined} />
        </Field>
        <Field label="Telepon" htmlFor="em_phone">
          <Input id="em_phone" name="phone" defaultValue={member.phone ?? undefined} />
        </Field>
        <div>
          <EditSubmit />
        </div>
      </form>
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

/** Section 4.4 — deactivate rather than delete. */
export function StatusToggle({
  kind,
  id,
  vendorId,
  status,
}: {
  kind: 'team' | 'member'
  id: string
  vendorId: string
  status: string
}) {
  const action = kind === 'team' ? setTeamStatus : setMemberStatus
  const [state, formAction] = useActionState(action, initialState)
  useActionToast(state)
  const next = status === 'Active' ? 'Inactive' : 'Active'

  return (
    <form action={formAction} className="inline">
      <input type="hidden" name="id" value={id} />
      <input type="hidden" name="vendor_id" value={vendorId} />
      <input type="hidden" name="status" value={next} />
      <ToggleSubmit label={next === 'Active' ? 'Aktifkan' : 'Nonaktifkan'} />
      {state.error && <span className="ml-2 text-xs text-danger">{state.error}</span>}
    </form>
  )
}

export function DeleteEntry({
  kind,
  id,
  vendorId,
}: {
  kind: 'team' | 'member'
  id: string
  vendorId: string
}) {
  const action = kind === 'team' ? deleteTeam : deleteMember
  return (
    <DeleteButton action={action} hiddenFields={{ id, vendor_id: vendorId }} />
  )
}
