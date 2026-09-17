'use client'

import { useActionState } from 'react'
import { useFormStatus } from 'react-dom'
import { AlertCircle, CheckCircle, Mail } from 'lucide-react'
import { requestPasswordReset, type ForgotPasswordState } from './actions'

const initialState: ForgotPasswordState = { error: null, success: false }

const inputClass =
  'w-full rounded-xl border border-slate-300 bg-white py-2.5 pl-10 text-sm outline-none transition-all ' +
  'focus:border-blue-500 focus:ring-2 focus:ring-blue-100'

function SubmitButton() {
  const { pending } = useFormStatus()
  return (
    <button
      type="submit"
      disabled={pending}
      className="mt-1 flex w-full items-center justify-center gap-2 rounded-xl px-6 py-2.5 text-sm font-bold text-white transition-all disabled:cursor-not-allowed disabled:opacity-60"
      style={{
        background: pending ? '#64748b' : 'linear-gradient(135deg, #2563eb, #1d4ed8)',
        boxShadow: pending ? 'none' : '0 4px 14px rgba(37, 99, 235, 0.35)',
      }}
    >
      {pending ? (
        <>
          <span className="h-4 w-4 animate-spin rounded-full border-2 border-white border-t-transparent" />
          Mengirim…
        </>
      ) : (
        'Kirim Link Reset'
      )}
    </button>
  )
}

export function ForgotPasswordForm() {
  const [state, formAction] = useActionState(requestPasswordReset, initialState)

  return (
    <form action={formAction} className="flex flex-col gap-3">
      <div>
        <label
          htmlFor="email"
          className="mb-1.5 block text-xs font-bold text-slate-700"
        >
          Email Kerja
        </label>
        <div className="relative">
          <Mail
            size={16}
            className="absolute top-1/2 left-3.5 -translate-y-1/2 text-slate-400"
            aria-hidden
          />
          <input
            id="email"
            name="email"
            type="email"
            autoComplete="email"
            placeholder="nama@sucofindo.co.id"
            autoFocus
            required
            className={inputClass}
            disabled={state.success}
          />
        </div>
      </div>

      {state.error && (
        <div className="flex items-start gap-2.5 rounded-xl border border-red-200 bg-red-50 p-3">
          <AlertCircle size={16} className="mt-0.5 shrink-0 text-red-500" aria-hidden />
          <p className="text-xs leading-relaxed font-medium text-red-700">
            {state.error}
          </p>
        </div>
      )}

      {state.success && (
        <div className="flex items-start gap-2.5 rounded-xl border border-green-200 bg-green-50 p-3">
          <CheckCircle size={16} className="mt-0.5 shrink-0 text-green-600" aria-hidden />
          <div>
            <p className="text-xs font-medium text-green-700">
              Link reset password telah dikirim!
            </p>
            <p className="text-xs text-green-600 mt-1">
              Periksa email Anda untuk instruksi selanjutnya.
            </p>
          </div>
        </div>
      )}

      <SubmitButton />
    </form>
  )
}
