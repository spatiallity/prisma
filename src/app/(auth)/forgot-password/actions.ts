'use server'
import { headers } from 'next/headers'
import { createClient } from '@/lib/supabase/server'
export type RecoveryState = { error: string | null; success?: string }
export async function sendRecoveryEmail(_: RecoveryState, formData: FormData): Promise<RecoveryState> {
  const email = String(formData.get('email') ?? '').trim().toLowerCase()
  if (!email) return { error: 'Email wajib diisi.' }
  const configuredOrigin = process.env.NEXT_PUBLIC_APP_URL?.replace(/\/$/, '')
  const h = await headers()
  const host = h.get('x-forwarded-host') ?? h.get('host')
  const protocol = h.get('x-forwarded-proto') ?? 'http'
  const requestOrigin = h.get('origin') ?? (host ? `${protocol}://${host}` : 'http://localhost:3000')
  const origin = configuredOrigin ?? requestOrigin
  const { error } = await (await createClient()).auth.resetPasswordForEmail(email, { redirectTo: `${origin}/auth/callback?next=/reset-password` })
  if (error) return { error: error.message }
  return { error: null, success: 'Bila email terdaftar, tautan penggantian password sudah dikirim.' }
}
