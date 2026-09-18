'use client'

import Link from 'next/link'
import { type FormEvent, useState } from 'react'
import { AlertCircle, ArrowLeft, CheckCircle2, Mail, Send } from 'lucide-react'
import { BrandLogo } from '@/components/brand-logo'
import { BRAND } from '@/lib/brand'
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
    <main className="flex min-h-dvh bg-surface-muted">
      <section className="relative hidden w-[52%] overflow-hidden bg-[#123254] lg:flex lg:flex-col lg:justify-between lg:p-12">
        <div className="text-[10px] font-bold tracking-widest text-slate-300 uppercase">
          {BRAND.owner}
        </div>
        <div className="max-w-md">
          <span className="mb-5 inline-flex h-11 w-11 items-center justify-center rounded-lg border border-white/15 bg-white/10 text-white">
            <Mail size={21} aria-hidden />
          </span>
          <h1 className="text-4xl font-black text-white">Pulihkan akses akun</h1>
          <p className="mt-4 text-base leading-7 text-slate-200">
            Kami akan mengirim tautan aman untuk membuat password baru.
          </p>
        </div>
        <p className="border-t border-white/15 pt-4 text-[11px] text-slate-300">
          {BRAND.owner} © {BRAND.year}
        </p>
      </section>

      <section className="flex flex-1 items-center justify-center p-4 sm:p-6">
        <form onSubmit={sendRecoveryEmail} className="w-full max-w-md rounded-lg border border-slate-200 bg-white p-6 shadow-sm sm:p-8">
          <div className="mb-8 flex flex-col items-center text-center">
            <BrandLogo height={82} className="mb-5" priority />
            <h2 className="text-2xl font-black text-slate-900">Lupa password?</h2>
            <p className="mt-2 text-sm leading-6 text-muted-foreground">
              Masukkan alamat email yang terhubung ke akunmu.
            </p>
          </div>

          <label htmlFor="email" className="mb-1.5 block text-xs font-bold text-slate-700">
            Alamat email
          </label>
          <div className="relative">
            <Mail size={17} className="absolute top-1/2 left-3.5 -translate-y-1/2 text-slate-400" aria-hidden />
            <input
              id="email"
              name="email"
              type="email"
              value={email}
              onChange={(event) => setEmail(event.target.value)}
              required
              autoComplete="email"
              placeholder="nama@email.com"
              className="h-11 w-full rounded-lg border border-slate-300 bg-white py-2.5 pr-3 pl-10 text-sm outline-none transition-colors placeholder:text-slate-400 focus:border-primary focus:ring-2 focus:ring-primary/15"
            />
          </div>

          {error && (
            <div className="mt-4 flex gap-2.5 rounded-lg border border-danger/20 bg-danger/5 p-3 text-sm font-medium text-danger">
              <AlertCircle size={17} className="mt-0.5 shrink-0" aria-hidden />
              <p>{error}</p>
            </div>
          )}
          {success && (
            <div className="mt-4 flex gap-2.5 rounded-lg border border-success/20 bg-success/5 p-3 text-sm font-medium text-success">
              <CheckCircle2 size={17} className="mt-0.5 shrink-0" aria-hidden />
              <p>{success}</p>
            </div>
          )}

          <button
            disabled={pending}
            className="mt-5 flex h-11 w-full items-center justify-center gap-2 rounded-lg bg-primary text-sm font-bold text-white transition-colors hover:bg-primary/90 disabled:cursor-not-allowed disabled:opacity-60"
          >
            <Send size={16} aria-hidden />
            {pending ? 'Mengirim...' : 'Kirim tautan reset'}
          </button>
          <Link href="/login" className="mt-5 flex items-center justify-center gap-1.5 text-sm font-bold text-primary hover:underline">
            <ArrowLeft size={16} aria-hidden />
            Kembali ke login
          </Link>
        </form>
      </section>
    </main>
  )
}
