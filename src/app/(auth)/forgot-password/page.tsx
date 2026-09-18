'use client'

import Link from 'next/link'
import { type FormEvent, useState } from 'react'
import { createClient } from '@/lib/supabase/client'

export default function ForgotPasswordPage() {
  const [email, setEmail] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState<string | null>(null)
  const [pending, setPending] = useState(false)

  const sendRecoveryEmail = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    setError(null)
    setSuccess(null)
    setPending(true)

    // Requesting from the browser keeps Supabase's PKCE verifier in this
    // browser's cookies. The callback can then exchange the recovery code.
    const supabase = createClient()
    const { error: requestError } = await supabase.auth.resetPasswordForEmail(email.trim(), {
      redirectTo: `${window.location.origin}/auth/callback`,
    })

    setPending(false)
    if (requestError) {
      setError(requestError.message)
      return
    }
    setSuccess('Bila email terdaftar, tautan penggantian password sudah dikirim.')
  }

  return (
    <main className="grid min-h-dvh place-items-center bg-slate-100 p-4">
      <form onSubmit={sendRecoveryEmail} className="grid w-full max-w-md gap-4 rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
        <div>
          <h1 className="text-xl font-black text-slate-900">Lupa password</h1>
          <p className="mt-1 text-sm text-muted-foreground">Masukkan email kerja untuk menerima tautan penggantian password.</p>
        </div>
        <label className="grid gap-1.5 text-sm font-semibold text-slate-700">
          Email kerja
          <input
            name="email"
            type="email"
            value={email}
            onChange={(event) => setEmail(event.target.value)}
            required
            autoComplete="email"
            className="h-10 rounded-lg border border-slate-300 px-3 text-sm"
          />
        </label>
        {error && <p className="text-sm font-semibold text-danger">{error}</p>}
        {success && <p className="text-sm font-semibold text-success">{success}</p>}
        <button disabled={pending} className="h-10 rounded-lg bg-primary text-sm font-bold text-white disabled:opacity-60">
          {pending ? 'Mengirim...' : 'Kirim tautan reset'}
        </button>
        <Link href="/login" className="text-center text-sm font-bold text-primary hover:underline">Kembali ke login</Link>
      </form>
    </main>
  )
}
