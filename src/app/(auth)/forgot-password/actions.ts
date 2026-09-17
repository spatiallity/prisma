'use server'

import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'

export type ForgotPasswordState = {
  error: string | null
  success: boolean
}

const initialState: ForgotPasswordState = { error: null, success: false }

function getBaseUrl(): string {
  if (process.env.NEXT_PUBLIC_BASE_URL) {
    return process.env.NEXT_PUBLIC_BASE_URL
  }
  if (process.env.VERCEL_URL) {
    return `https://${process.env.VERCEL_URL}`
  }
  return 'http://localhost:3000'
}

export async function requestPasswordReset(
  _prev: ForgotPasswordState,
  formData: FormData,
): Promise<ForgotPasswordState> {
  const email = String(formData.get('email') ?? '').trim()

  if (!email) {
    return { error: 'Email wajib diisi.', success: false }
  }

  const supabase = await createClient()
  const baseUrl = getBaseUrl()
  const { error } = await supabase.auth.resetPasswordForEmail(email, {
    redirectTo: `${baseUrl}/auth/reset-password`,
  })

  if (error) {
    return {
      error: error.message || 'Gagal mengirim email reset password.',
      success: false,
    }
  }

  return { error: null, success: true }
}
