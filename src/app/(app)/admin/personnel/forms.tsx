'use client'

import { useActionState, useEffect, useRef, useState } from 'react'
import { useFormStatus } from 'react-dom'
import { Plus } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Field, Input } from '@/components/ui/field'
import { Alert } from '@/components/ui/alert'
import { Pencil } from 'lucide-react'
import { Modal } from '@/components/ui/modal'
import type { Database } from '@/lib/supabase/types'
import {
  createPersonnel,
  updatePersonnel,
  setPersonnelStatus,
  type PersonnelState,
} from './actions'

type PersonnelRow = Database['public']['Tables']['personnel']['Row']

const initialState: PersonnelState = { error: null }

function Feedback({ state }: { state: PersonnelState }) {
  if (state.error) return <Alert tone="danger">{state.error}</Alert>
  if (state.success) return <Alert tone="success">{state.success}</Alert>
  return null
}

function Submit({ editing }: { editing: boolean }) {
  const { pending } = useFormStatus()
  return (
    <Button type="submit" disabled={pending}>
      <Plus size={16} aria-hidden />
      {pending ? 'Menyimpan…' : editing ? 'Simpan perubahan' : 'Tambah personel'}
    </Button>
  )
}

export function PersonnelForm({
  personnel,
  onSaved,
}: {
  /** Present → editing this existing row instead of creating a new one. */
  personnel?: PersonnelRow
  onSaved?: () => void
}) {
  const editing = !!personnel
  const [state, formAction] = useActionState(
    editing ? updatePersonnel : createPersonnel,
    initialState,
  )
  const savedKey = useRef<string | undefined>(undefined)

  useEffect(() => {
    if (state.success && state.success !== savedKey.current) {
      savedKey.current = state.success
      onSaved?.()
    }
  }, [state.success, onSaved])

  return (
    <form action={formAction} className="grid gap-3">
      <Feedback state={state} />

      {personnel && <input type="hidden" name="id" value={personnel.id} />}

      <Field label="Nama lengkap" htmlFor="pn_name" required>
        <Input id="pn_name" name="full_name" required defaultValue={personnel?.full_name} />
      </Field>
      <Field label="Kode" htmlFor="pn_code">
        <Input id="pn_code" name="code" placeholder="SVY-01" defaultValue={personnel?.code ?? undefined} />
      </Field>
      <Field label="Posisi" htmlFor="pn_pos">
        <Input id="pn_pos" name="position" placeholder="Surveyor" defaultValue={personnel?.position ?? undefined} />
      </Field>
      <Field label="Tanggal masuk" htmlFor="pn_join">
        <Input id="pn_join" name="join_date" type="date" defaultValue={personnel?.join_date ?? undefined} />
      </Field>
      <div>
        <Submit editing={editing} />
      </div>
    </form>
  )
}

/** Top-right "Add Data" trigger + popup form. */
export function AddPersonnelButton() {
  const [open, setOpen] = useState(false)
  return (
    <Modal
      open={open}
      onOpenChange={setOpen}
      title="Tambah personel"
      trigger={
        <Button type="button">
          <Plus size={16} aria-hidden />
          Add Data
        </Button>
      }
    >
      <PersonnelForm onSaved={() => setOpen(false)} />
    </Modal>
  )
}

/** Row-level "Edit" trigger — opens the same form pre-filled. */
export function EditPersonnelButton({ personnel }: { personnel: PersonnelRow }) {
  const [open, setOpen] = useState(false)
  return (
    <Modal
      open={open}
      onOpenChange={setOpen}
      title="Edit personel"
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
      <PersonnelForm personnel={personnel} onSaved={() => setOpen(false)} />
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

export function PersonnelStatusToggle({
  id,
  status,
}: {
  id: string
  status: string
}) {
  const [state, formAction] = useActionState(setPersonnelStatus, initialState)
  const next = status === 'Active' ? 'Inactive' : 'Active'

  return (
    <form action={formAction} className="inline">
      <input type="hidden" name="id" value={id} />
      <input type="hidden" name="status" value={next} />
      <ToggleSubmit label={next === 'Active' ? 'Aktifkan' : 'Nonaktifkan'} />
      {state.error && <span className="ml-2 text-xs text-danger">{state.error}</span>}
    </form>
  )
}
