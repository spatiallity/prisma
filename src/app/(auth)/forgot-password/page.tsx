'use client'
import Link from 'next/link'
import { useActionState } from 'react'
import { sendRecoveryEmail, type RecoveryState } from './actions'
const initial: RecoveryState = { error: null }
export default function ForgotPasswordPage() {
  const [state, action, pending] = useActionState(sendRecoveryEmail, initial)
  return <main className="grid min-h-dvh place-items-center bg-slate-100 p-4"><form action={action} className="grid w-full max-w-md gap-4 rounded-xl border border-slate-200 bg-white p-6 shadow-sm"><div><h1 className="text-xl font-black text-slate-900">Lupa password</h1><p className="mt-1 text-sm text-muted-foreground">Masukkan email kerja untuk menerima tautan penggantian password.</p></div><label className="grid gap-1.5 text-sm font-semibold text-slate-700">Email kerja<input name="email" type="email" required autoComplete="email" className="h-10 rounded-lg border border-slate-300 px-3 text-sm" /></label>{state.error && <p className="text-sm font-semibold text-danger">{state.error}</p>}{state.success && <p className="text-sm font-semibold text-success">{state.success}</p>}<button disabled={pending} className="h-10 rounded-lg bg-primary text-sm font-bold text-white disabled:opacity-60">{pending ? 'Mengirim...' : 'Kirim tautan reset'}</button><Link href="/login" className="text-center text-sm font-bold text-primary hover:underline">Kembali ke login</Link></form></main>
}
