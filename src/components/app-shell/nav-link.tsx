'use client'

import type { ReactNode } from 'react'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { cn } from '@/lib/utils'

const base =
  'relative mb-1 flex w-full items-center gap-3 rounded-xl px-4 py-2.5 text-[13px] leading-snug transition-all duration-200 ' +
  'group-data-[collapsed=true]/sb:justify-center group-data-[collapsed=true]/sb:gap-0 group-data-[collapsed=true]/sb:px-0'

/**
 * The icon arrives as an already-rendered element: component references cannot
 * cross the server/client boundary, React elements can.
 */
export function NavLink({
  href,
  label,
  icon,
  ready,
  phase,
}: {
  href: string
  label: string
  icon: ReactNode
  ready: boolean
  phase: number
}) {
  const pathname = usePathname()
  const target = href.split('?')[0]!
  const active = pathname === target

  if (!ready) {
    return (
      <span
        className={cn(base, 'cursor-not-allowed font-semibold text-slate-300')}
        title={`${label} — dijadwalkan pada Phase ${phase} (Section 37)`}
      >
        <span className="shrink-0">{icon}</span>
        <span className="flex-1 text-left group-data-[collapsed=true]/sb:hidden">
          {label}
        </span>
        <span className="shrink-0 rounded border border-slate-200 px-1 text-[10px] font-bold tracking-wide group-data-[collapsed=true]/sb:hidden">
          P{phase}
        </span>
      </span>
    )
  }

  return (
    <Link
      href={href}
      title={label}
      aria-current={active ? 'page' : undefined}
      className={cn(
        base,
        active
          ? 'bg-primary font-bold text-white shadow-md shadow-primary/20'
          : 'font-semibold text-sidebar-foreground hover:bg-slate-50 hover:text-slate-900',
      )}
    >
      <span className={cn('shrink-0', active ? 'text-white' : 'text-slate-500')}>
        {icon}
      </span>
      <span className="flex-1 text-left group-data-[collapsed=true]/sb:hidden">
        {label}
      </span>
    </Link>
  )
}
