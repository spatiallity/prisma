'use client'

import * as React from 'react'
import { createPortal } from 'react-dom'
import { AlertTriangle, CheckCircle2, X } from 'lucide-react'
import { cn } from '@/lib/utils'

type ToastTone = 'success' | 'danger'
type Toast = { id: number; tone: ToastTone; message: string }

const ToastContext = React.createContext<{
  push: (tone: ToastTone, message: string) => void
} | null>(null)

const DURATION_MS = 5000

/**
 * Mounted once in the root layout. Any form action's success/error message
 * shows here — a Modal-based form closes before its inline Alert has time
 * to be read, so this is the one place the user actually sees the outcome.
 */
export function ToastProvider({ children }: { children: React.ReactNode }) {
  const [toasts, setToasts] = React.useState<Toast[]>([])
  const [mounted, setMounted] = React.useState(false)
  const nextId = React.useRef(0)

  React.useEffect(() => {
    const frame = requestAnimationFrame(() => setMounted(true))
    return () => cancelAnimationFrame(frame)
  }, [])

  const dismiss = React.useCallback((id: number) => {
    setToasts((current) => current.filter((t) => t.id !== id))
  }, [])

  const push = React.useCallback(
    (tone: ToastTone, message: string) => {
      const id = nextId.current++
      setToasts((current) => [...current, { id, tone, message }])
      setTimeout(() => dismiss(id), DURATION_MS)
    },
    [dismiss],
  )

  return (
    <ToastContext.Provider value={{ push }}>
      {children}
      {mounted &&
        createPortal(
          <div className="pointer-events-none fixed inset-x-0 top-4 z-[100] flex flex-col items-center gap-2 px-4 sm:items-end sm:px-6">
            {toasts.map((t) => (
              <ToastItem key={t.id} toast={t} onDismiss={() => dismiss(t.id)} />
            ))}
          </div>,
          document.body,
        )}
    </ToastContext.Provider>
  )
}

function ToastItem({ toast, onDismiss }: { toast: Toast; onDismiss: () => void }) {
  const isSuccess = toast.tone === 'success'
  const Icon = isSuccess ? CheckCircle2 : AlertTriangle
  return (
    <div
      role="alert"
      className={cn(
        'pointer-events-auto flex w-full max-w-sm animate-[toast-in_0.2s_ease-out] items-start gap-2.5 rounded-lg border px-4 py-3 text-sm shadow-lg',
        isSuccess
          ? 'border-green-200 bg-white text-success'
          : 'border-red-200 bg-white text-danger',
      )}
    >
      <Icon className="mt-0.5 h-4 w-4 shrink-0" aria-hidden />
      <p className="min-w-0 flex-1 font-semibold text-slate-700">{toast.message}</p>
      <button
        type="button"
        onClick={onDismiss}
        className="shrink-0 rounded p-0.5 text-slate-400 hover:bg-slate-100 hover:text-slate-600"
        aria-label="Tutup notifikasi"
      >
        <X className="h-3.5 w-3.5" aria-hidden />
      </button>
    </div>
  )
}

export function useToast() {
  const ctx = React.useContext(ToastContext)
  if (!ctx) throw new Error('useToast must be used within ToastProvider')
  return {
    success: (message: string) => ctx.push('success', message),
    error: (message: string) => ctx.push('danger', message),
  }
}

/**
 * Drop into any `useActionState`-backed form: toasts the outcome, and on
 * success runs `onSuccess` once (e.g. closing the Modal it lives in).
 */
export function useActionToast(
  state: { error: string | null; success?: string },
  onSuccess?: () => void,
) {
  const { success, error } = useToast()
  const seen = React.useRef<typeof state | null>(null)

  React.useEffect(() => {
    if (state === seen.current) return
    if (state.error) {
      error(state.error)
    }
    if (state.success) {
      success(state.success)
      onSuccess?.()
    }
    seen.current = state
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [state])
}
