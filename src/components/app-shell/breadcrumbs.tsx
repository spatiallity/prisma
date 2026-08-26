'use client'

import { Fragment } from 'react'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { ChevronRight } from 'lucide-react'
import { NAV } from '@/lib/nav'

/** Path segment → label, using the Section 7 menu wording where it exists. */
const LABEL_BY_HREF = new Map(
  NAV.flatMap((group) => group.items).map((item) => [
    item.href.split('?')[0]!,
    item.label,
  ]),
)

const EXTRA: Record<string, string> = {
  '/admin': 'Administration',
  '/admin/users/new': 'Tambah user',
  '/financial': 'Financial',
  '/schedule': 'Schedule',
  '/reports': 'Reports',
  '/forbidden': 'Akses ditolak',
}

function labelFor(href: string, segment: string) {
  return (
    LABEL_BY_HREF.get(href) ??
    EXTRA[href] ??
    // A UUID segment is a record id — the page heading names it, not the trail.
    (/^[0-9a-f-]{20,}$/i.test(segment) ? 'Detail' : segment.replace(/-/g, ' '))
  )
}

export function Breadcrumbs() {
  const pathname = usePathname()
  const segments = pathname.split('/').filter(Boolean)

  const crumbs = segments.map((segment, index) => {
    const href = `/${segments.slice(0, index + 1).join('/')}`
    return { href, label: labelFor(href, segment) }
  })

  if (crumbs.length === 0) return <span />

  return (
    <nav className="flex items-center gap-2 text-sm" aria-label="Breadcrumb">
      {crumbs.map((crumb, index) => {
        const last = index === crumbs.length - 1
        return (
          <Fragment key={crumb.href}>
            {index > 0 && (
              <ChevronRight size={14} className="text-slate-400" aria-hidden />
            )}
            {last ? (
              <span
                className="font-semibold text-primary capitalize"
                aria-current="page"
              >
                {crumb.label}
              </span>
            ) : (
              <Link
                href={crumb.href}
                className="font-semibold text-slate-600 capitalize transition-colors hover:text-primary"
              >
                {crumb.label}
              </Link>
            )}
          </Fragment>
        )
      })}
    </nav>
  )
}
