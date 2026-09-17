import { LogOut } from 'lucide-react'
import Link from 'next/link'
import { Badge } from '@/components/ui/badge'
import { initials } from '@/lib/utils'
import type { SessionUser } from '@/lib/auth/session'
import { BrandLogo } from '@/components/brand-logo'
import { MobileNavToggle } from './shell'
import { Breadcrumbs } from './breadcrumbs'

/** White sticky header with the breadcrumb trail, as in tenderhub-lsi. */
export function Topbar({ user }: { user: SessionUser }) {
  return (
    <header className="sticky top-0 z-20 border-b border-slate-200 bg-surface shadow-sm">
      <div className="flex h-14 items-center justify-between gap-3 px-4 sm:px-6">
        <div className="flex min-w-0 items-center gap-2">
          <MobileNavToggle />
          <span className="md:hidden">
            <BrandLogo height={26} />
          </span>
          <div className="hidden md:block">
            <Breadcrumbs />
          </div>
        </div>

        <div className="flex items-center gap-3">
          <Link href="/profile" className="hidden rounded-lg px-1 py-0.5 hover:bg-slate-50 sm:block" title="Akun saya">
          <div className="text-right">
            <p className="text-sm leading-tight font-bold text-slate-900">
              {user.fullName}
            </p>
            <p className="text-xs leading-tight font-medium text-muted-foreground">
              {user.email}
            </p>
          </div>
          </Link>

          <Link href="/profile" className="rounded-full" title="Akun saya">
          <div
            className="flex h-9 w-9 items-center justify-center rounded-full bg-primary text-xs font-bold text-white"
            aria-hidden
          >
            {initials(user.fullName)}
          </div>
          </Link>

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
