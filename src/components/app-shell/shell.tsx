'use client'

import {
  createContext,
  useCallback,
  useContext,
  useState,
  type ReactNode,
} from 'react'
import { usePathname } from 'next/navigation'
import { ChevronLeft, ChevronRight, Menu, X } from 'lucide-react'
import { cn } from '@/lib/utils'

type ShellState = {
  collapsed: boolean
  toggleCollapsed: () => void
  mobileOpen: boolean
  setMobileOpen: (open: boolean) => void
}

const ShellContext = createContext<ShellState>({
  collapsed: false,
  toggleCollapsed: () => {},
  mobileOpen: false,
  setMobileOpen: () => {},
})

/** Hamburger in the mobile header. */
export function MobileNavToggle() {
  const { setMobileOpen } = useContext(ShellContext)
  return (
    <button
      type="button"
      onClick={() => setMobileOpen(true)}
      className="-ml-2 rounded-lg p-2 text-slate-600 transition-colors hover:bg-primary-soft hover:text-primary md:hidden"
      aria-label="Buka menu"
    >
      <Menu size={20} />
    </button>
  )
}

/** Chevron in the sidebar header — desktop collapses, mobile closes. */
export function SidebarToggle() {
  const { collapsed, toggleCollapsed, setMobileOpen } = useContext(ShellContext)
  return (
    <>
      <button
        type="button"
        onClick={toggleCollapsed}
        className="hidden shrink-0 rounded-lg p-1.5 text-slate-400 transition-colors hover:bg-slate-100 hover:text-slate-700 md:block"
        aria-label={collapsed ? 'Lebarkan sidebar' : 'Ciutkan sidebar'}
      >
        {collapsed ? <ChevronRight size={20} /> : <ChevronLeft size={20} />}
      </button>
      <button
        type="button"
        onClick={() => setMobileOpen(false)}
        className="shrink-0 rounded-lg p-1.5 text-slate-400 transition-colors hover:bg-red-50 hover:text-red-600 md:hidden"
        aria-label="Tutup menu"
      >
        <X size={18} />
      </button>
    </>
  )
}

/**
 * Holds the sidebar collapse and mobile drawer state. The sidebar and topbar
 * arrive already rendered on the server, so permission filtering never reaches
 * the client bundle; collapsing is driven purely by `data-collapsed` plus
 * `group-data-*` classes on that server markup.
 */
export function Shell({
  sidebar,
  topbar,
  children,
}: {
  sidebar: ReactNode
  topbar: ReactNode
  children: ReactNode
}) {
  const pathname = usePathname()
  const [collapsed, setCollapsed] = useState(false)

  // The drawer is remembered per route, so navigating closes it on its own.
  const [openFor, setOpenFor] = useState<string | null>(null)
  const mobileOpen = openFor === pathname

  const setMobileOpen = useCallback(
    (open: boolean) => setOpenFor(open ? pathname : null),
    [pathname],
  )
  const toggleCollapsed = useCallback(() => setCollapsed((c) => !c), [])

  return (
    <ShellContext.Provider
      value={{ collapsed, toggleCollapsed, mobileOpen, setMobileOpen }}
    >
      <div className="flex min-h-dvh bg-background text-foreground">
        {mobileOpen && (
          <div
            className="fixed inset-0 z-30 bg-slate-900/50 backdrop-blur-sm md:hidden"
            onClick={() => setMobileOpen(false)}
            aria-hidden
          />
        )}

        <aside
          data-collapsed={collapsed}
          className={cn(
            'group/sb fixed inset-y-0 left-0 z-40 flex flex-col border-r border-sidebar-border bg-sidebar transition-all duration-300 ease-in-out',
            collapsed ? 'w-[68px]' : 'w-[240px]',
            mobileOpen ? 'translate-x-0 shadow-2xl' : '-translate-x-full md:translate-x-0',
          )}
          role="navigation"
          aria-label="Navigasi utama"
        >
          {sidebar}
        </aside>

        <div
          className={cn(
            'flex min-w-0 flex-1 flex-col transition-all duration-300 ease-in-out',
            collapsed ? 'md:ml-[68px]' : 'md:ml-[240px]',
          )}
        >
          {topbar}
          <main className="mx-auto w-full max-w-[1600px] p-4 sm:p-6">
            {children}
          </main>
        </div>
      </div>
    </ShellContext.Provider>
  )
}
