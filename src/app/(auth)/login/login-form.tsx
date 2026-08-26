'use client'

import { useActionState } from 'react'
import { useFormStatus } from 'react-dom'
import { LogIn } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Field, Input } from '@/components/ui/field'
import { Alert } from '@/components/ui/alert'
import { login, type LoginState } from './actions'

const initialState: LoginState = { error: null }

function SubmitButton() {
  const { pending } = useFormStatus()
  return (
    <Button type="submit" className="w-full" disabled={pending}>
      <LogIn className="h-4 w-4" aria-hidden />
      {pending ? 'Memproses…' : 'Masuk'}
    </Button>
  )
}

export function LoginForm({ next }: { next?: string }) {
  const [state, formAction] = useActionState(login, initialState)

  return (
    <form action={formAction} className="grid gap-4">
      {next && <input type="hidden" name="next" value={next} />}

      {state.error && <Alert tone="danger">{state.error}</Alert>}

      <Field label="Email" htmlFor="email" required>
        <Input
          id="email"
          name="email"
          type="email"
          autoComplete="username"
          placeholder="nama@sucofindo.co.id"
          required
        />
      </Field>

      <Field label="Password" htmlFor="password" required>
        <Input
          id="password"
          name="password"
          type="password"
          autoComplete="current-password"
          required
        />
      </Field>

      <SubmitButton />
    </form>
  )
}
