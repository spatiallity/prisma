import { LogOut } from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { initials } from '@/lib/utils'
import type { SessionUser } from '@/lib/auth/session'
import { MobileNavToggle } from './shell'
import { Breadcrumbs } from './breadcrumbs'

/** White sticky header with the breadcrumb trail, as in tenderhub-lsi. */
export function Topbar({ user }: { user: SessionUser }) {
  return (
    <header className="sticky top-0 z-20 border-b border-slate-200 bg-surface shadow-sm">
      <div className="flex h-14 items-center justify-between gap-3 px-4 sm:px-6">
        <div className="flex min-w-0 items-center gap-2">
          <MobileNavToggle />
          <div className="hidden md:block">
            <Breadcrumbs />
          </div>
        </div>

        <div className="flex items-center gap-3">
          <div className="hidden text-right sm:block">
            <p className="text-sm leading-tight font-bold text-slate-900">
              {user.fullName}
            </p>
            <p className="text-xs leading-tight font-medium text-muted-foreground">
              {user.email}
            </p>
          </div>

          <div
            className="flex h-9 w-9 items-center justify-center rounded-full bg-primary text-xs font-bold text-white"
            aria-hidden
          >
            {initials(user.fullName)}
          </div>

          <Badge tone="primary" className="hidden lg:inline-flex">
            {user.role.name}
          </Badge>

          <form action="/auth/signout" method="post">
            <button
              type="submit"
              className="rounded-lg p-2 text-slate-600 transition-colors hover:bg-red-50 hover:text-red-600"
              aria-label="Keluar"
              title="Keluar"
            >
              <LogOut size={18} />
            </button>
          </form>
        </div>
      </div>
    </header>
  )
}
