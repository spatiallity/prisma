'use server'
import { headers } from 'next/headers'
import { createClient } from '@/lib/supabase/server'
export type RecoveryState = { error: string | null; success?: string }
export async function sendRecoveryEmail(_: RecoveryState, formData: FormData): Promise<RecoveryState> {
  const email = String(formData.get('email') ?? '').trim().toLowerCase()
  if (!email) return { error: 'Email wajib diisi.' }
  const h = await headers()
  const host = h.get('x-forwarded-host') ?? h.get('host')
  const protocol = h.get('x-forwarded-proto') ?? 'http'
  const origin = h.get('origin') ?? (host ? `${protocol}://${host}` : 'http://localhost:3000')
  const { error } = await (await createClient()).auth.resetPasswordForEmail(email, { redirectTo: `${origin}/auth/callback?next=/reset-password` })
  if (error) return { error: error.message }
  return { error: null, success: 'Bila email terdaftar, tautan penggantian password sudah dikirim.' }
}
