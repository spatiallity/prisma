'use client'

import { useEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { Pencil } from 'lucide-react'
import { cn } from '@/lib/utils'

/** One edit icon per row that opens a small menu with the real actions
 *  (edit, delete, status toggle, …) instead of showing every button inline.
 *  The menu is portaled to document.body and positioned from the trigger's
 *  own bounding box — every list table sits inside a `Card
 *  className="overflow-hidden"` for its rounded corners, which would
 *  otherwise clip the menu for any row near the bottom or right edge. */
export function RowActions({
  children,
  align = 'end',
}: {
  children: React.ReactNode
  align?: 'start' | 'end'
}) {
  const [open, setOpen] = useState(false)
  const [pos, setPos] = useState<{ top: number; left: number } | null>(null)
  const triggerRef = useRef<HTMLButtonElement>(null)
  const menuRef = useRef<HTMLDivElement>(null)
  const [mounted, setMounted] = useState(false)

  useEffect(() => setMounted(true), [])

  useEffect(() => {
    if (!open) return

    function place() {
      const rect = triggerRef.current?.getBoundingClientRect()
      if (!rect) return
      setPos({
        top: rect.bottom + 4,
        left: align === 'end' ? rect.right - 144 : rect.left,
      })
    }
    place()

    function onClick(e: MouseEvent) {
      const target = e.target as Node
      if (triggerRef.current?.contains(target) || menuRef.current?.contains(target)) return
      setOpen(false)
    }
    // A dropdown anchored to a scrolled-past trigger is worse than none —
    // close instead of drifting out of place.
    function onScrollOrResize() {
      setOpen(false)
    }
    document.addEventListener('click', onClick)
    window.addEventListener('scroll', onScrollOrResize, true)
    window.addEventListener('resize', onScrollOrResize)
    return () => {
      document.removeEventListener('click', onClick)
      window.removeEventListener('scroll', onScrollOrResize, true)
      window.removeEventListener('resize', onScrollOrResize)
    }
  }, [open, align])

  return (
    <>
      <button
        ref={triggerRef}
        type="button"
        onClick={() => setOpen((o) => !o)}
        className="inline-flex h-8 w-8 items-center justify-center rounded-lg border border-slate-300 bg-white text-slate-600 hover:bg-slate-50"
        aria-label="Aksi"
      >
        <Pencil size={14} aria-hidden />
      </button>
      {mounted &&
        open &&
        pos &&
        createPortal(
          <div
            ref={menuRef}
            style={{ top: pos.top, left: pos.left }}
            className={cn('fixed z-50 flex w-36 flex-col items-stretch gap-1 rounded-lg border border-slate-200 bg-white p-2 shadow-lg')}
          >
            {children}
          </div>,
          document.body,
        )}
    </>
  )
}
