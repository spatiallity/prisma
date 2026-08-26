'use client'

import { useActionState, useState } from 'react'
import { useFormStatus } from 'react-dom'
import { Button } from '@/components/ui/button'
import { Field, Input, Select } from '@/components/ui/field'
import { Alert } from '@/components/ui/alert'
import type { FormState } from './actions'

export type RoleOption = { id: string; code: string; name: string }
export type VendorOption = { id: string; name: string }

const initialState: FormState = { error: null }

function Submit({ label }: { label: string }) {
  const { pending } = useFormStatus()
  return (
    <Button type="submit" disabled={pending}>
      {pending ? 'Menyimpan…' : label}
    </Button>
  )
}

export function UserForm({
  action,
  roles,
  vendors,
  user,
  submitLabel,
}: {
  action: (state: FormState, formData: FormData) => Promise<FormState>
  roles: RoleOption[]
  vendors: VendorOption[]
  submitLabel: string
  user?: {
    id: string
    email: string
    full_name: string
    phone: string | null
    role_id: string
    vendor_id: string | null
    status: string
  }
}) {
  const [state, formAction] = useActionState(action, initialState)
  const [roleId, setRoleId] = useState(user?.role_id ?? roles[0]?.id ?? '')

  const isVendorRole = roles.find((role) => role.id === roleId)?.code === 'vendor'

  return (
    <form action={formAction} className="grid gap-4">
      {user && <input type="hidden" name="id" value={user.id} />}

      {state.error && <Alert tone="danger">{state.error}</Alert>}
      {state.success && <Alert tone="success">{state.success}</Alert>}

      <Field label="Nama lengkap" htmlFor="full_name" required>
        <Input
          id="full_name"
          name="full_name"
          defaultValue={user?.full_name}
          required
        />
      </Field>

      <Field
        label="Email"
        htmlFor="email"
        required={!user}
        hint={user ? 'Email tidak dapat diubah dari sini.' : undefined}
      >
        <Input
          id="email"
          name="email"
          type="email"
          defaultValue={user?.email}
          disabled={Boolean(user)}
          required={!user}
        />
      </Field>

      {!user && (
        <Field
          label="Password awal"
          htmlFor="password"
          required
          hint="Minimal 8 karakter. Sampaikan ke user untuk diganti setelah login."
        >
          <Input id="password" name="password" type="password" minLength={8} required />
        </Field>
      )}

      <Field label="Telepon" htmlFor="phone">
        <Input id="phone" name="phone" defaultValue={user?.phone ?? ''} />
      </Field>

      <Field label="Role" htmlFor="role_id" required>
        <Select
          id="role_id"
          name="role_id"
          value={roleId}
          onChange={(event) => setRoleId(event.target.value)}
          required
        >
          {roles.map((role) => (
            <option key={role.id} value={role.id}>
              {role.name}
            </option>
          ))}
        </Select>
      </Field>

      {isVendorRole && (
        <Field
          label="Vendor Jasa Survey"
          htmlFor="vendor_id"
          required
          hint="Akun vendor hanya melihat SPK yang di-assign kepadanya (Section 5.7)."
        >
          <Select
            id="vendor_id"
            name="vendor_id"
            defaultValue={user?.vendor_id ?? ''}
            required
          >
            <option value="">— pilih vendor —</option>
            {vendors.map((vendor) => (
              <option key={vendor.id} value={vendor.id}>
                {vendor.name}
              </option>
            ))}
          </Select>
        </Field>
      )}

      {user && (
        <Field
          label="Status"
          htmlFor="status"
          hint="Section 4.4 — akun dinonaktifkan, tidak pernah dihapus."
        >
          <Select id="status" name="status" defaultValue={user.status}>
            <option value="Active">Active</option>
            <option value="Inactive">Inactive</option>
            <option value="Archived">Archived</option>
          </Select>
        </Field>
      )}

      <div className="pt-1">
        <Submit label={submitLabel} />
      </div>
    </form>
  )
}
