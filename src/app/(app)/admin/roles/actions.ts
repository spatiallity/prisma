'use server'

import { revalidatePath } from 'next/cache'
import { createClient } from '@/lib/supabase/server'
import { requirePermission } from '@/lib/auth/session'
import {
  ALL_ACTIONS,
  ALL_MODULES,
  type AppAction,
  type AppModule,
  type PermissionScope,
} from '@/lib/auth/permissions'

export type MatrixState = { error: string | null; success?: string }

const SCOPES: PermissionScope[] = ['all', 'own', 'limited']

function isScope(value: string): value is PermissionScope {
  return (SCOPES as string[]).includes(value)
}

/**
 * Replaces one role's grants with what the form submitted. Each cell posts
 * `${module}:${action}` = '' (revoked) or a scope. Writes go through the
 * caller's client, so RLS (user_management:edit) authorises them and the audit
 * trigger records every change.
 */
export async function saveRoleMatrix(
  _prev: MatrixState,
  formData: FormData,
): Promise<MatrixState> {
  await requirePermission('user_management', 'edit')

  const roleId = String(formData.get('role_id') ?? '')
  if (!roleId) return { error: 'Role tidak dikenali.' }

  const supabase = await createClient()

  const [{ data: catalogue, error: catalogueError }, { data: existing, error: existingError }] =
    await Promise.all([
      supabase.from('permissions').select('id, module, action'),
      supabase.from('role_permissions').select('permission_id, scope').eq('role_id', roleId),
    ])

  if (catalogueError) return { error: catalogueError.message }
  if (existingError) return { error: existingError.message }

  const permissionId = new Map(
    (catalogue ?? []).map((p) => [`${p.module}:${p.action}`, p.id]),
  )
  const currentScope = new Map((existing ?? []).map((row) => [row.permission_id, row.scope]))

  const toUpsert: { role_id: string; permission_id: string; scope: PermissionScope }[] = []
  const toRevoke: string[] = []

  for (const mod of ALL_MODULES as AppModule[]) {
    for (const action of ALL_ACTIONS as AppAction[]) {
      const id = permissionId.get(`${mod}:${action}`)
      if (!id) continue

      const raw = String(formData.get(`${mod}:${action}`) ?? '')
      const wanted = isScope(raw) ? raw : null
      const held = currentScope.get(id) ?? null

      if (wanted && wanted !== held) {
        toUpsert.push({ role_id: roleId, permission_id: id, scope: wanted })
      } else if (!wanted && held) {
        toRevoke.push(id)
      }
    }
  }

  if (toUpsert.length > 0) {
    const { error } = await supabase
      .from('role_permissions')
      .upsert(toUpsert, { onConflict: 'role_id,permission_id' })
    if (error) return { error: error.message }
  }

  if (toRevoke.length > 0) {
    const { error } = await supabase
      .from('role_permissions')
      .delete()
      .eq('role_id', roleId)
      .in('permission_id', toRevoke)
    if (error) return { error: error.message }
  }

  const changed = toUpsert.length + toRevoke.length
  revalidatePath('/admin/roles')
  revalidatePath(`/admin/roles/${roleId}`)

  return {
    error: null,
    success:
      changed === 0
        ? 'Tidak ada perubahan.'
        : `${changed} permission diperbarui. Berlaku setelah user login berikutnya memuat ulang halaman.`,
  }
}
