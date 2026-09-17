'use server'
import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
export type ResetState = { error: string | null }
export async function resetPassword(_: ResetState, formData: FormData): Promise<ResetState> {
  const password = String(formData.get('password') ?? '')
  const confirmation = String(formData.get('confirmation') ?? '')
  if (password.length < 8) return { error: 'Password minimal 8 karakter.' }
  if (password !== confirmation) return { error: 'Konfirmasi password tidak sama.' }
  const { error } = await (await createClient()).auth.updateUser({ password })
  if (error) return { error: error.message }
  redirect('/dashboard')
}
