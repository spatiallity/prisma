'use server'

import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { requirePermission } from '@/lib/auth/session'
import type { RecordStatus } from '@/lib/supabase/types'

export type FormState = { error: string | null; success?: string }

const MIN_PASSWORD = 8

function str(formData: FormData, key: string) {
  const value = formData.get(key)
  return typeof value === 'string' ? value.trim() : ''
}

async function roleCode(roleId: string) {
  const supabase = await createClient()
  const { data } = await supabase.from('roles').select('code').eq('id', roleId).maybeSingle()
  return data?.code ?? null
}

/**
 * Creates the Supabase Auth account with the service role, then the profile
 * row through the *caller's* client so RLS (user_management:edit) is what
 * actually authorises the write. If the profile fails, the orphaned auth user
 * is removed again.
 */
export async function createUser(
  _prev: FormState,
  formData: FormData,
): Promise<FormState> {
  await requirePermission('user_management', 'edit')

  const email = str(formData, 'email').toLowerCase()
  const fullName = str(formData, 'full_name')
  const phone = str(formData, 'phone')
  const roleId = str(formData, 'role_id')
  const vendorId = str(formData, 'vendor_id')
  const password = String(formData.get('password') ?? '')

  if (!email || !fullName || !roleId) {
    return { error: 'Email, nama lengkap dan role wajib diisi.' }
  }
  if (password.length < MIN_PASSWORD) {
    return { error: `Password minimal ${MIN_PASSWORD} karakter.` }
  }

  const code = await roleCode(roleId)
  if (code === 'vendor' && !vendorId) {
    return { error: 'Role Vendor Jasa Survey wajib terhubung ke satu vendor.' }
  }

  const admin = createAdminClient()
  const { data: created, error: authError } = await admin.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
  })

  if (authError || !created.user) {
    return { error: authError?.message ?? 'Gagal membuat akun login.' }
  }

  const supabase = await createClient()
  const { error: profileError } = await supabase.from('users').insert({
    id: created.user.id,
    email,
    full_name: fullName,
    phone: phone || null,
    role_id: roleId,
    vendor_id: code === 'vendor' ? vendorId : null,
  })

  if (profileError) {
    await admin.auth.admin.deleteUser(created.user.id)
    return { error: `Profil gagal disimpan, akun login dibatalkan: ${profileError.message}` }
  }

  revalidatePath('/admin/users')
  redirect('/admin/users?created=1')
}

export async function updateUser(
  _prev: FormState,
  formData: FormData,
): Promise<FormState> {
  await requirePermission('user_management', 'edit')

  const id = str(formData, 'id')
  const fullName = str(formData, 'full_name')
  const phone = str(formData, 'phone')
  const roleId = str(formData, 'role_id')
  const vendorId = str(formData, 'vendor_id')
  const status = str(formData, 'status') as RecordStatus

  if (!id || !fullName || !roleId) {
    return { error: 'Nama lengkap dan role wajib diisi.' }
  }

  const code = await roleCode(roleId)
  if (code === 'vendor' && !vendorId) {
    return { error: 'Role Vendor Jasa Survey wajib terhubung ke satu vendor.' }
  }

  const supabase = await createClient()
  const { error } = await supabase
    .from('users')
    .update({
      full_name: fullName,
      phone: phone || null,
      role_id: roleId,
      vendor_id: code === 'vendor' ? vendorId : null,
      status,
    })
    .eq('id', id)

  if (error) return { error: error.message }

  revalidatePath('/admin/users')
  revalidatePath(`/admin/users/${id}`)
  return { error: null, success: 'Perubahan tersimpan.' }
}

/** Section 4.4 — no hard delete; an account is deactivated instead. */
export async function setUserStatus(
  _prev: FormState,
  formData: FormData,
): Promise<FormState> {
  await requirePermission('user_management', 'edit')

  const id = str(formData, 'id')
  const status = str(formData, 'status') as RecordStatus
  if (!id || !status) return { error: 'Data tidak lengkap.' }

  const supabase = await createClient()
  const { error } = await supabase.from('users').update({ status }).eq('id', id)
  if (error) return { error: error.message }

  revalidatePath('/admin/users')
  revalidatePath(`/admin/users/${id}`)
  return { error: null, success: `Status diubah menjadi ${status}.` }
}

export async function resetPassword(
  _prev: FormState,
  formData: FormData,
): Promise<FormState> {
  await requirePermission('user_management', 'edit')

  const id = str(formData, 'id')
  const password = String(formData.get('password') ?? '')

  if (password.length < MIN_PASSWORD) {
    return { error: `Password minimal ${MIN_PASSWORD} karakter.` }
  }

  const admin = createAdminClient()
  const { error } = await admin.auth.admin.updateUserById(id, { password })
  if (error) return { error: error.message }

  return { error: null, success: 'Password diganti.' }
}
