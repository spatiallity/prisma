'use client'

import { useActionState } from 'react'
import { useFormStatus } from 'react-dom'
import { Button } from '@/components/ui/button'
import { Field, Input, Select, Textarea } from '@/components/ui/field'
import { Alert } from '@/components/ui/alert'
import { useActionToast } from '@/components/ui/toast'
import type { VendorRow } from '@/lib/supabase/types'
import type { VendorFormState } from './actions'

const initialState: VendorFormState = { error: null }

function Submit({ label }: { label: string }) {
  const { pending } = useFormStatus()
  return (
    <Button type="submit" disabled={pending}>
      {pending ? 'Menyimpan…' : label}
    </Button>
  )
}

export function VendorForm({
  action,
  submitLabel,
  vendor,
}: {
  action: (state: VendorFormState, formData: FormData) => Promise<VendorFormState>
  submitLabel: string
  vendor?: VendorRow
}) {
  const [state, formAction] = useActionState(action, initialState)
  useActionToast(state)

  return (
    <form action={formAction} className="grid gap-4">
      {vendor && <input type="hidden" name="id" value={vendor.id} />}

      {state.error && <Alert tone="danger">{state.error}</Alert>}
      {state.success && <Alert tone="success">{state.success}</Alert>}

      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Kode" htmlFor="code" required hint="Huruf besar, contoh KJSB-SYA.">
          <Input
            id="code"
            name="code"
            defaultValue={vendor?.code}
            placeholder="KJSB-SYA"
            required
          />
        </Field>

        <Field label="Nama vendor" htmlFor="name" required>
          <Input
            id="name"
            name="name"
            defaultValue={vendor?.name}
            placeholder="KJSB Syahrial"
            required
          />
        </Field>

        <Field label="Contact person" htmlFor="contact_person">
          <Input
            id="contact_person"
            name="contact_person"
            defaultValue={vendor?.contact_person ?? ''}
          />
        </Field>

        <Field label="Telepon" htmlFor="phone">
          <Input id="phone" name="phone" defaultValue={vendor?.phone ?? ''} />
        </Field>

        <Field label="Email" htmlFor="email">
          <Input
            id="email"
            name="email"
            type="email"
            defaultValue={vendor?.email ?? ''}
          />
        </Field>

        {vendor && (
          <Field
            label="Status"
            htmlFor="status"
            hint="Vendor dinonaktifkan, tidak dihapus."
          >
            <Select id="status" name="status" defaultValue={vendor.status}>
              <option value="Active">Active</option>
              <option value="Inactive">Inactive</option>
              <option value="Archived">Archived</option>
            </Select>
          </Field>
        )}

        <Field label="Alamat" htmlFor="address" className="sm:col-span-2">
          <Textarea id="address" name="address" defaultValue={vendor?.address ?? ''} />
        </Field>

        <Field label="Catatan" htmlFor="notes" className="sm:col-span-2">
          <Textarea id="notes" name="notes" defaultValue={vendor?.notes ?? ''} />
        </Field>
      </div>

      <div>
        <Submit label={submitLabel} />
      </div>
    </form>
  )
}
