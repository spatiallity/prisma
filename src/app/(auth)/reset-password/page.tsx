'use client'

import Link from 'next/link'
import { useActionState, useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { resetPassword, type ResetState } from './actions'

const initial: ResetState = { error: null }

export default function ResetPasswordPage() {
  const [state, action, pending] = useActionState(resetPassword, initial)
  const [checking, setChecking] = useState(true)
  const [recoveryError, setRecoveryError] = useState<string | null>(null)

  useEffect(() => {
    let mounted = true
    const hash = new URLSearchParams(window.location.hash.slice(1))
    const hashError = hash.get('error_description') ?? hash.get('error')

    if (hashError) {
      setRecoveryError(decodeURIComponent(hashError.replace(/\+/g, ' ')))
      setChecking(false)
      return
    }

    const supabase = createClient()
    const code = new URLSearchParams(window.location.search).get('code')
    const verifyRecovery = async () => {
      if (code) {
        const { error } = await supabase.auth.exchangeCodeForSession(code)
        if (error) {
          if (mounted) {
            setRecoveryError('Tautan reset tidak valid atau sudah kedaluwarsa. Minta tautan baru.')
            setChecking(false)
          }
          return
        }
      }

      const { data } = await supabase.auth.getSession()
      if (!mounted) return
      if (!data.session) {
        setRecoveryError('Sesi reset tidak ditemukan. Minta tautan reset baru, lalu buka tautan tersebut di browser yang sama.')
      }
      setChecking(false)
    }

    void verifyRecovery()
    return () => {
      mounted = false
    }
  }, [])

  return (
    <main className="grid min-h-dvh place-items-center bg-slate-100 p-4">
      <form action={action} className="grid w-full max-w-md gap-4 rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
        <div>
          <h1 className="text-xl font-black text-slate-900">Buat password baru</h1>
          <p className="mt-1 text-sm text-muted-foreground">Gunakan minimal 8 karakter.</p>
        </div>

        {checking ? (
          <p className="text-sm font-medium text-muted-foreground">Memverifikasi tautan reset...</p>
        ) : recoveryError ? (
          <>
            <p className="rounded-lg border border-danger/20 bg-danger/5 p-3 text-sm font-semibold text-danger">
              {recoveryError}
            </p>
            <Link href="/forgot-password" className="text-center text-sm font-bold text-primary hover:underline">
              Kirim tautan reset baru
            </Link>
          </>
        ) : (
          <>
            <label className="grid gap-1.5 text-sm font-semibold text-slate-700">
              Password baru
              <input name="password" type="password" minLength={8} required autoComplete="new-password" className="h-10 rounded-lg border border-slate-300 px-3 text-sm" />
            </label>
            <label className="grid gap-1.5 text-sm font-semibold text-slate-700">
              Konfirmasi password
              <input name="confirmation" type="password" minLength={8} required autoComplete="new-password" className="h-10 rounded-lg border border-slate-300 px-3 text-sm" />
            </label>
            {state.error && <p className="text-sm font-semibold text-danger">{state.error}</p>}
            <button disabled={pending} className="h-10 rounded-lg bg-primary text-sm font-bold text-white disabled:opacity-60">
              {pending ? 'Menyimpan...' : 'Simpan password baru'}
            </button>
          </>
        )}
      </form>
    </main>
  )
}
