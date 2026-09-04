'use client'

import { useState, type ReactNode } from 'react'
import { usePathname } from 'next/navigation'
import { ChevronDown } from 'lucide-react'
import { cn } from '@/lib/utils'

/**
 * One collapsible section of the sidebar. The group holding the current page
 * opens itself; clicking any header overrides that for the rest of the
 * session. When the rail is collapsed to icons there is no header to click,
 * so every group's items stay visible regardless of the open state.
 *
 * Items arrive as already-rendered children — permission filtering happens on
 * the server and never reaches the client bundle.
 */
export function NavGroup({
  label,
  icon,
  hrefs,
  children,
}: {
  label: string
  icon: ReactNode
  /** Item links, used to decide which group the current page belongs to. */
  hrefs: string[]
  children: ReactNode
}) {
  const pathname = usePathname()
  const [manual, setManual] = useState<boolean | null>(null)

  const holdsCurrentPage = hrefs.some((href) => pathname === href.split('?')[0])
  const open = manual ?? holdsCurrentPage

  return (
    <div className="mb-1">
      <button
        type="button"
        onClick={() => setManual(!open)}
        aria-expanded={open}
        title={label}
        className={cn(
          'mt-3 mb-1.5 flex w-full items-center gap-2 rounded-lg px-3 py-1.5 text-[11px] font-black tracking-widest uppercase transition-colors',
          'text-sidebar-section hover:bg-slate-50 hover:text-slate-700',
          'group-data-[collapsed=true]/sb:justify-center group-data-[collapsed=true]/sb:px-0',
        )}
      >
        <span className="shrink-0">{icon}</span>
        <span className="flex-1 text-left group-data-[collapsed=true]/sb:hidden">
          {label}
        </span>
        <ChevronDown
          size={14}
          aria-hidden
          className={cn(
            'shrink-0 transition-transform duration-200 group-data-[collapsed=true]/sb:hidden',
            open ? 'rotate-0' : '-rotate-90',
          )}
        />
      </button>

      <div className={cn(!open && 'hidden group-data-[collapsed=true]/sb:block')}>
        {children}
      </div>
    </div>
  )
}
