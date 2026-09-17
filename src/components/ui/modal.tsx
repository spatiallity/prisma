'use client'

import * as React from 'react'
import { createPortal } from 'react-dom'
import { X } from 'lucide-react'
import { cn } from '@/lib/utils'

/**
 * Trigger + popup form, so "Add Data" never requires scrolling to the bottom
 * of a long list to find the form. `trigger` renders the opener (usually a
 * Button); `children` is the modal body, typically a <form>.
 */
const MAX_WIDTH = {
  md: 'max-w-lg',
  lg: 'max-w-3xl',
  xl: 'max-w-6xl',
} as const

export function Modal({
  trigger,
  title,
  description,
  children,
  open: controlledOpen,
  onOpenChange,
  size = 'md',
}: {
  trigger?: React.ReactNode
  title: string
  description?: string
  children: React.ReactNode
  open?: boolean
  onOpenChange?: (open: boolean) => void
  /** 'lg' for content that needs room, e.g. a data table — default fits a form. */
  size?: keyof typeof MAX_WIDTH
}) {
  const [internalOpen, setInternalOpen] = React.useState(false)
  const open = controlledOpen ?? internalOpen
  const setOpen = onOpenChange ?? setInternalOpen
  const [mounted, setMounted] = React.useState(false)

  React.useEffect(() => {
    const frame = requestAnimationFrame(() => setMounted(true))
    return () => cancelAnimationFrame(frame)
  }, [])

  React.useEffect(() => {
    if (!open) return
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setOpen(false)
    }
    document.addEventListener('keydown', onKey)
    document.body.style.overflow = 'hidden'
    return () => {
      document.removeEventListener('keydown', onKey)
      document.body.style.overflow = ''
    }
  }, [open, setOpen])

  return (
    <>
      {trigger && <span onClick={() => setOpen(true)}>{trigger}</span>}
      {mounted &&
        open &&
        createPortal(
          <div className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto p-4 sm:p-8">
            <div
              className="fixed inset-0 bg-slate-900/50"
              onClick={() => setOpen(false)}
              aria-hidden
            />
            <div
              role="dialog"
              aria-modal="true"
              aria-label={title}
              className={cn(
                'relative z-10 my-8 w-full rounded-xl border border-slate-200',
                MAX_WIDTH[size],
                'bg-surface shadow-2xl',
              )}
            >
              <div className="flex items-start justify-between gap-3 border-b border-slate-100 px-5 py-4">
                <div>
                  <h2 className="text-base font-extrabold text-slate-900">{title}</h2>
                  {description && (
                    <p className="mt-0.5 text-xs text-muted-foreground">{description}</p>
                  )}
                </div>
                <button
                  type="button"
                  onClick={() => setOpen(false)}
                  className="rounded-lg p-1 text-slate-400 hover:bg-slate-100 hover:text-slate-600"
                  aria-label="Tutup"
                >
                  <X size={18} />
                </button>
              </div>
              <div className="px-5 py-4">{children}</div>
            </div>
          </div>,
          document.body,
        )}
    </>
  )
}
