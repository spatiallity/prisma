'use client'

import { useActionState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { Alert } from '@/components/ui/alert'
import { Button } from '@/components/ui/button'
import { Field, Input, Textarea } from '@/components/ui/field'
import { useToast } from '@/components/ui/toast'
import { createRole, type RoleActionState } from './actions'

const initialState: RoleActionState = { error: null }

export function RoleForm() {
  const [state, formAction, pending] = useActionState(createRole, initialState)
  const router = useRouter()
  const toast = useToast()

  useEffect(() => {
    if (!state.success) return
    toast.success(state.success)
    router.push('/admin/roles')
  }, [router, state.success, toast])

  return (
    <form action={formAction} className="grid gap-5">
      {state.error && <Alert tone="danger" title="Role tidak dapat disimpan">{state.error}</Alert>}

      <Field label="Nama role" htmlFor="name" required>
        <Input id="name" name="name" placeholder="Contoh: Finance" required />
      </Field>
      <Field label="Kode role" htmlFor="code" hint="Huruf kecil, angka, dan garis bawah.">
        <Input id="code" name="code" placeholder="contoh: finance" required />
      </Field>
      <Field label="Deskripsi" htmlFor="description">
        <Textarea id="description" name="description" placeholder="Ringkasan tanggung jawab role ini" rows={3} />
      </Field>

      <div className="flex justify-end gap-2 border-t border-slate-100 pt-4">
        <Button type="button" variant="secondary" onClick={() => router.push('/admin/roles')}>
          Batal
        </Button>
        <Button type="submit" disabled={pending}>
          {pending ? 'Menambahkan…' : 'Tambah role'}
        </Button>
      </div>
    </form>
  )
}
