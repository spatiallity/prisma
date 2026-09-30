'use client'

import { useEffect, useRef, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { RefreshCw } from 'lucide-react'

export function MonthlyFinanceRefresh() {
  const router = useRouter()
  const [isPending, startTransition] = useTransition()
  const lastRefresh = useRef(0)

  useEffect(() => {
    lastRefresh.current = Date.now()
    const refreshWhenVisible = () => {
      if (document.visibilityState !== 'visible' || Date.now() - lastRefresh.current < 30_000) return
      lastRefresh.current = Date.now()
      startTransition(() => router.refresh())
    }

    window.addEventListener('focus', refreshWhenVisible)
    document.addEventListener('visibilitychange', refreshWhenVisible)
    return () => {
      window.removeEventListener('focus', refreshWhenVisible)
      document.removeEventListener('visibilitychange', refreshWhenVisible)
    }
  }, [router, startTransition])

  return (
    <button
      type="button"
      title="Perbarui data"
      aria-label="Perbarui data"
      disabled={isPending}
      onClick={() => {
        lastRefresh.current = Date.now()
        startTransition(() => router.refresh())
      }}
      className="inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-md border border-slate-300 text-slate-600 hover:bg-slate-50 disabled:opacity-50"
    >
      <RefreshCw size={17} aria-hidden className={isPending ? 'animate-spin' : undefined} />
    </button>
  )
}
