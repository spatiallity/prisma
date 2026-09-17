'use client'

import { useActionState, useState } from 'react'
import { useFormStatus } from 'react-dom'
import { AlertCircle, Eye, EyeOff, Lock } from 'lucide-react'
import { resetPassword, type ResetPasswordState } from './actions'

const initialState: ResetPasswordState = { error: null, success: false }

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
          Menyimpan…
        </>
      ) : (
        'Reset Password'
      )}
    </button>
  )
}

export function ResetPasswordForm() {
  const [state, formAction] = useActionState(resetPassword, initialState)
  const [showPassword, setShowPassword] = useState(false)
  const [showConfirmPassword, setShowConfirmPassword] = useState(false)

  return (
    <form action={formAction} className="flex flex-col gap-3">
      <div>
        <label
          htmlFor="password"
          className="mb-1.5 block text-xs font-bold text-slate-700"
        >
          Password Baru
        </label>
        <div className="relative">
          <Lock
            size={16}
            className="absolute top-1/2 left-3.5 -translate-y-1/2 text-slate-400"
            aria-hidden
          />
          <input
            id="password"
            name="password"
            type={showPassword ? 'text' : 'password'}
            autoComplete="new-password"
            placeholder="••••••••"
            required
            className={`${inputClass} pr-12`}
          />
          <button
            type="button"
            onClick={() => setShowPassword((s) => !s)}
            tabIndex={-1}
            aria-label={showPassword ? 'Sembunyikan password' : 'Tampilkan password'}
            className="absolute top-1/2 right-3.5 -translate-y-1/2 text-slate-400 transition-colors hover:text-slate-600"
          >
            {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
          </button>
        </div>
        <p className="mt-1 text-[11px] text-slate-500">Minimal 8 karakter</p>
      </div>

      <div>
        <label
          htmlFor="confirmPassword"
          className="mb-1.5 block text-xs font-bold text-slate-700"
        >
          Konfirmasi Password
        </label>
        <div className="relative">
          <Lock
            size={16}
            className="absolute top-1/2 left-3.5 -translate-y-1/2 text-slate-400"
            aria-hidden
          />
          <input
            id="confirmPassword"
            name="confirmPassword"
            type={showConfirmPassword ? 'text' : 'password'}
            autoComplete="new-password"
            placeholder="••••••••"
            required
            className={`${inputClass} pr-12`}
          />
          <button
            type="button"
            onClick={() => setShowConfirmPassword((s) => !s)}
            tabIndex={-1}
            aria-label={showConfirmPassword ? 'Sembunyikan password' : 'Tampilkan password'}
            className="absolute top-1/2 right-3.5 -translate-y-1/2 text-slate-400 transition-colors hover:text-slate-600"
          >
            {showConfirmPassword ? <EyeOff size={16} /> : <Eye size={16} />}
          </button>
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

      <SubmitButton />
    </form>
  )
}
