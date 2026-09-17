'use server'

import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'

export type ResetPasswordState = {
  error: string | null
  success: boolean
}

const initialState: ResetPasswordState = { error: null, success: false }

export async function resetPassword(
  _prev: ResetPasswordState,
  formData: FormData,
): Promise<ResetPasswordState> {
  const password = String(formData.get('password') ?? '')
  const confirmPassword = String(formData.get('confirmPassword') ?? '')

  if (!password || !confirmPassword) {
    return { error: 'Password dan konfirmasi password wajib diisi.', success: false }
  }

  if (password.length < 8) {
    return { error: 'Password minimal 8 karakter.', success: false }
  }

  if (password !== confirmPassword) {
    return { error: 'Password tidak cocok.', success: false }
  }

  const supabase = await createClient()

  const { error } = await supabase.auth.updateUser({ password })

  if (error) {
    return {
      error: error.message || 'Gagal mengubah password.',
      success: false,
    }
  }

  redirect('/auth/login')
}
