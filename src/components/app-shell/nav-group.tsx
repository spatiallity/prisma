'use client'

import type { ReactNode } from 'react'
import { usePathname } from 'next/navigation'
import { cn } from '@/lib/utils'

/**
 * One section of the sidebar. Submenus stay visible in the full sidebar so
 * users can scan the app structure without opening each group first.
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
  const holdsCurrentPage = hrefs.some((href) => pathname === href.split('?')[0])

  return (
    <div className="mb-1">
      <div
        title={label}
        className={cn(
          'mt-3 mb-1.5 flex w-full items-center gap-2 rounded-lg px-3 py-1.5 text-[11px] font-black tracking-widest uppercase transition-colors',
          holdsCurrentPage ? 'text-sidebar-section' : 'text-sidebar-section/90',
          'group-data-[collapsed=true]/sb:justify-center group-data-[collapsed=true]/sb:px-0',
        )}
      >
        <span className="shrink-0">{icon}</span>
        <span className="flex-1 text-left group-data-[collapsed=true]/sb:hidden">
          {label}
        </span>
      </div>

      <div>{children}</div>
    </div>
  )
}
