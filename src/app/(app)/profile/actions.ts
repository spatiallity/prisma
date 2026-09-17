'use server'
import { revalidatePath } from 'next/cache'
import { createAdminClient } from '@/lib/supabase/admin'
import { createClient } from '@/lib/supabase/server'
import { requireUser } from '@/lib/auth/session'
export type ProfileState = { error: string | null; success?: string }
export async function updateProfile(_: ProfileState, formData: FormData): Promise<ProfileState> {
  const user = await requireUser(); const fullName = String(formData.get('full_name') ?? '').trim()
  if (!fullName) return { error: 'Nama wajib diisi.' }
  const { error } = await createAdminClient().from('users').update({ full_name: fullName }).eq('id', user.id)
  if (error) return { error: error.message }; revalidatePath('/profile'); return { error: null, success: 'Nama diperbarui.' }
}
export async function changeOwnPassword(_: ProfileState, formData: FormData): Promise<ProfileState> {
  await requireUser(); const password = String(formData.get('password') ?? ''); const confirmation = String(formData.get('confirmation') ?? '')
  if (password.length < 8) return { error: 'Password minimal 8 karakter.' }; if (password !== confirmation) return { error: 'Konfirmasi password tidak sama.' }
  const { error } = await (await createClient()).auth.updateUser({ password })
  return error ? { error: error.message } : { error: null, success: 'Password diperbarui.' }
}
