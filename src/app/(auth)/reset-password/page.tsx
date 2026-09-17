'use client'
import { useActionState } from 'react'
import { resetPassword, type ResetState } from './actions'
const initial: ResetState = { error: null }
export default function ResetPasswordPage() {
  const [state, action, pending] = useActionState(resetPassword, initial)
  return <main className="grid min-h-dvh place-items-center bg-slate-100 p-4"><form action={action} className="grid w-full max-w-md gap-4 rounded-xl border border-slate-200 bg-white p-6 shadow-sm"><div><h1 className="text-xl font-black text-slate-900">Buat password baru</h1><p className="mt-1 text-sm text-muted-foreground">Gunakan minimal 8 karakter.</p></div><label className="grid gap-1.5 text-sm font-semibold text-slate-700">Password baru<input name="password" type="password" minLength={8} required autoComplete="new-password" className="h-10 rounded-lg border border-slate-300 px-3 text-sm" /></label><label className="grid gap-1.5 text-sm font-semibold text-slate-700">Konfirmasi password<input name="confirmation" type="password" minLength={8} required autoComplete="new-password" className="h-10 rounded-lg border border-slate-300 px-3 text-sm" /></label>{state.error && <p className="text-sm font-semibold text-danger">{state.error}</p>}<button disabled={pending} className="h-10 rounded-lg bg-primary text-sm font-bold text-white disabled:opacity-60">{pending ? 'Menyimpan...' : 'Simpan password baru'}</button></form></main>
}
