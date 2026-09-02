'use client'

import { useActionState } from 'react'
import { useFormStatus } from 'react-dom'
import { Button } from '@/components/ui/button'
import { Field, Input } from '@/components/ui/field'
import { Alert } from '@/components/ui/alert'
import { useActionToast } from '@/components/ui/toast'
import { resetPassword, type FormState } from './actions'

const initialState: FormState = { error: null }

function Submit() {
  const { pending } = useFormStatus()
  return (
    <Button type="submit" variant="secondary" disabled={pending}>
      {pending ? 'Mengganti…' : 'Ganti password'}
    </Button>
  )
}

export function PasswordForm({ userId }: { userId: string }) {
  const [state, formAction] = useActionState(resetPassword, initialState)
  useActionToast(state)

  return (
    <form action={formAction} className="grid gap-4">
      <input type="hidden" name="id" value={userId} />
      {state.error && <Alert tone="danger">{state.error}</Alert>}
      {state.success && <Alert tone="success">{state.success}</Alert>}

      <Field label="Password baru" htmlFor="new-password" required>
        <Input id="new-password" name="password" type="password" minLength={8} required />
      </Field>

      <div>
        <Submit />
      </div>
    </form>
  )
}
