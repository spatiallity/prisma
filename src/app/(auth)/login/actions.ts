'use server'

import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'

export type LoginState = { error: string | null }

/** Only same-origin paths may be used as a post-login destination. */
function safeNext(value: FormDataEntryValue | null) {
  const next = typeof value === 'string' ? value : ''
  return next.startsWith('/') && !next.startsWith('//') ? next : '/dashboard'
}

export async function login(
  _prev: LoginState,
  formData: FormData,
): Promise<LoginState> {
  const email = String(formData.get('email') ?? '').trim()
  const password = String(formData.get('password') ?? '')

  if (!email || !password) {
    return { error: 'Email dan password wajib diisi.' }
  }

  const supabase = await createClient()
  const { data, error } = await supabase.auth.signInWithPassword({ email, password })

  if (error) {
    return {
      error:
        error.message === 'Invalid login credentials'
          ? 'Email atau password salah.'
          : error.message,
    }
  }

  // The signed-in user normally cannot update public.users under RLS, so use
  // the server-only admin client after Supabase Auth has verified credentials.
  // A missing profile is still handled by requireUser() on the destination.
  if (data.user) {
    await createAdminClient()
      .from('users')
      .update({ last_login_at: new Date().toISOString() })
      .eq('id', data.user.id)
  }

  redirect(safeNext(formData.get('next')))
}
