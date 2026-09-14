'use client'

import { useEffect, useRef, useState } from 'react'
import { Pencil } from 'lucide-react'
import { cn } from '@/lib/utils'

/** One edit icon per row that opens a small menu with the real actions
 *  (edit, delete, status toggle, …) instead of showing every button inline. */
export function RowActions({
  children,
  align = 'end',
}: {
  children: React.ReactNode
  align?: 'start' | 'end'
}) {
  const [open, setOpen] = useState(false)
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!open) return
    function onClick(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false)
    }
    document.addEventListener('click', onClick)
    return () => document.removeEventListener('click', onClick)
  }, [open])

  return (
    <div ref={ref} className="relative inline-block">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        className="inline-flex h-8 w-8 items-center justify-center rounded-lg border border-slate-300 bg-white text-slate-600 hover:bg-slate-50"
        aria-label="Aksi"
      >
        <Pencil size={14} aria-hidden />
      </button>
      {open && (
        <div
          className={cn(
            'absolute z-20 mt-1 flex min-w-[9rem] flex-col items-stretch gap-1 rounded-lg border border-slate-200 bg-white p-2 shadow-lg',
            align === 'end' ? 'right-0' : 'left-0',
          )}
        >
          {children}
        </div>
      )}
    </div>
  )
}
