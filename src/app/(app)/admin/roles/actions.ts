'use server'

import { revalidatePath } from 'next/cache'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { requirePermission } from '@/lib/auth/session'
import {
  ALL_ACTIONS,
  ALL_MODULES,
  type AppAction,
  type AppModule,
  type PermissionScope,
} from '@/lib/auth/permissions'

export type MatrixState = { error: string | null; success?: string }
export type RoleActionState = { error: string | null; success?: string }

const PROTECTED_ROLE_CODES = new Set([
  'administration',
  'drafter',
  'management',
  'operational',
  'project_manager',
  'super_admin',
  'tester',
  'vendor',
])

const SCOPES: PermissionScope[] = ['all', 'own', 'limited']

function isScope(value: string): value is PermissionScope {
  return (SCOPES as string[]).includes(value)
}

function value(formData: FormData, key: string) {
  const raw = formData.get(key)
  return typeof raw === 'string' ? raw.trim() : ''
}

async function requireSuperAdmin() {
  const current = await requirePermission('user_management', 'edit')
  if (current.role.code !== 'super_admin') {
    throw new Error('Hanya Super Admin yang dapat mengelola daftar role.')
  }
}

export async function createRole(
  _prev: RoleActionState,
  formData: FormData,
): Promise<RoleActionState> {
  await requireSuperAdmin()

  const name = value(formData, 'name')
  const code = value(formData, 'code').toLowerCase()
  const description = value(formData, 'description')

  if (!name || !code) return { error: 'Nama dan kode role wajib diisi.' }
  if (!/^[a-z][a-z0-9_]{2,48}$/.test(code)) {
    return { error: 'Kode role gunakan huruf kecil, angka, atau garis bawah (3–49 karakter).' }
  }
  if (PROTECTED_ROLE_CODES.has(code)) return { error: 'Kode tersebut digunakan oleh role inti sistem.' }

  const supabase = await createClient()
  const { error } = await supabase.from('roles').insert({
    name,
    code,
    description: description || null,
    status: 'Active',
  })
  if (error) {
    return {
      error: error.code === '23505' ? 'Kode role sudah digunakan.' : error.message,
    }
  }

  revalidatePath('/admin/roles')
  return { error: null, success: 'Role baru ditambahkan. Atur permission-nya dari daftar role.' }
}

export async function deleteRole(
  _prev: RoleActionState,
  formData: FormData,
): Promise<RoleActionState> {
  await requireSuperAdmin()

  const roleId = value(formData, 'id')
  if (!roleId) return { error: 'Role tidak dikenali.' }

  const supabase = await createClient()
  const { data: role, error: roleError } = await supabase
    .from('roles')
    .select('id, code')
    .eq('id', roleId)
    .maybeSingle()
  if (roleError) return { error: roleError.message }
  if (!role) return { error: 'Role tidak ditemukan.' }
  const { count, error: userError } = await supabase
    .from('users')
    .select('id', { count: 'exact', head: true })
    .eq('role_id', roleId)
  if (userError) return { error: userError.message }
  if ((count ?? 0) > 0) {
    return { error: `Role ini masih digunakan oleh ${count} pengguna. Pindahkan pengguna tersebut ke role lain terlebih dahulu.` }
  }

  // Authorization has been checked above. This avoids stale browser JWT
  // permissions blocking a valid Super Admin deletion.
  const admin = createAdminClient()
  const { error: grantsError } = await admin.from('role_permissions').delete().eq('role_id', roleId)
  if (grantsError) return { error: grantsError.message }

  const { error } = await admin.from('roles').delete().eq('id', roleId)
  if (error) return { error: error.message }

  revalidatePath('/admin/roles')
  return { error: null }
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
