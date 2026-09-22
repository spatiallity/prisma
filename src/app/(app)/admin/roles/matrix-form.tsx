'use client'

import { useActionState } from 'react'
import { useFormStatus } from 'react-dom'
import { Button } from '@/components/ui/button'
import { Alert } from '@/components/ui/alert'
import { useActionToast } from '@/components/ui/toast'
import {
  ACTION_LABEL,
  ALL_ACTIONS,
  ALL_MODULES,
  MODULE_LABEL,
  type PermissionMap,
  type PermissionScope,
} from '@/lib/auth/permissions'
import { saveRoleMatrix, type MatrixState } from './actions'

const initialState: MatrixState = { error: null }

const SCOPE_OPTIONS: { value: '' | PermissionScope; label: string }[] = [
  { value: '', label: '—' },
  { value: 'all', label: 'Semua data' },
  { value: 'own', label: 'Data sendiri' },
  { value: 'limited', label: 'Terbatas' },
]

function Submit() {
  const { pending } = useFormStatus()
  return (
    <Button type="submit" disabled={pending}>
      {pending ? 'Menyimpan…' : 'Simpan matrix'}
    </Button>
  )
}

export function MatrixForm({
  roleId,
  granted,
  readOnly,
}: {
  roleId: string
  granted: PermissionMap
  readOnly: boolean
}) {
  const [state, formAction] = useActionState(saveRoleMatrix, initialState)
  useActionToast(state)

  return (
    <form action={formAction} className="grid gap-4">
      <input type="hidden" name="role_id" value={roleId} />

      {state.error && <Alert tone="danger">{state.error}</Alert>}
      {state.success && <Alert tone="success">{state.success}</Alert>}

      <div className="max-h-[70vh] overflow-auto rounded-lg border border-border">
        <table className="w-full border-collapse text-sm">
          <thead>
            <tr>
              <th className="sticky top-0 z-10 border-b border-border bg-surface-muted px-4 py-2.5 text-left text-xs font-semibold tracking-wide text-muted-foreground uppercase">
                Modul
              </th>
              {ALL_ACTIONS.map((action) => (
                <th
                  key={action}
                  className="sticky top-0 z-10 w-44 border-b border-border bg-surface-muted px-4 py-2.5 text-left text-xs font-semibold tracking-wide text-muted-foreground uppercase"
                >
                  {ACTION_LABEL[action]}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {ALL_MODULES.map((module) => (
              <tr key={module} className="hover:bg-surface-muted/50">
                <td className="border-b border-border px-4 py-2 font-medium text-slate-900">
                  {MODULE_LABEL[module]}
                </td>
                {ALL_ACTIONS.map((action) => {
                  const name = `${module}:${action}` as const
                  return (
                    <td key={action} className="border-b border-border px-4 py-2">
                      <select
                        name={name}
                        defaultValue={granted[name] ?? ''}
                        disabled={readOnly}
                        aria-label={`${MODULE_LABEL[module]} — ${ACTION_LABEL[action]}`}
                        className="h-8 w-full rounded-md border border-input bg-surface px-2 text-sm focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none disabled:opacity-60"
                      >
                        {SCOPE_OPTIONS.map((option) => (
                          <option key={option.value} value={option.value}>
                            {option.label}
                          </option>
                        ))}
                      </select>
                    </td>
                  )
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {!readOnly && (
        <div className="flex items-center gap-3">
          <Submit />
          <p className="text-xs text-muted-foreground">
            Menghapus permission memutus akses di level database, bukan hanya menu.
          </p>
        </div>
      )}
    </form>
  )
}
