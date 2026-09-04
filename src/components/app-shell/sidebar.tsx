import Link from 'next/link'
import { NAV } from '@/lib/nav'
import { BRAND } from '@/lib/brand'
import { BrandLogo } from '@/components/brand-logo'
import { can, type PermissionMap } from '@/lib/auth/permissions'
import { NavLink } from './nav-link'
import { SidebarToggle } from './shell'

/**
 * Section 7: "Menu ditampilkan berdasarkan permission user."
 * Items the role has no permission for are not rendered at all; items whose
 * module is not built yet render disabled with their Section 37 phase, so the
 * shell shows the whole system without pretending it exists.
 *
 * Layout follows tenderhub-lsi's AppShell: white rail, grouped sections,
 * rounded-xl pills, labels hidden when the rail is collapsed to 68px.
 */
export function Sidebar({ permissions }: { permissions: PermissionMap }) {
  const groups = NAV.map((group) => ({
    ...group,
    items: group.items.filter((item) =>
      can(permissions, item.module, item.action ?? 'view'),
    ),
  })).filter((group) => group.items.length > 0)

  return (
    <div className="flex h-full flex-col p-4">
      <div className="mb-6 flex items-center justify-between gap-2">
        <Link
          href="/dashboard"
          className="flex min-w-0 flex-1 justify-center group-data-[collapsed=true]/sb:hidden"
          aria-label={`${BRAND.name} — Dashboard`}
        >
          <BrandLogo height={64} priority />
        </Link>
        <SidebarToggle />
      </div>

      <nav className="flex-1 overflow-y-auto px-0.5">
        {groups.map((group) => {
          const Icon = group.icon
          return (
            <div key={group.label} className="mb-1">
              <div className="mt-3 mb-1.5 flex items-center gap-2 px-3 text-[11px] font-black tracking-widest text-sidebar-section uppercase group-data-[collapsed=true]/sb:justify-center group-data-[collapsed=true]/sb:px-0">
                <Icon size={14} className="shrink-0" aria-hidden />
                <span className="group-data-[collapsed=true]/sb:hidden">
                  {group.label}
                </span>
              </div>
              {group.items.map((item) => {
                const ItemIcon = item.icon
                return (
                  <NavLink
                    key={item.href}
                    href={item.href}
                    label={item.label}
                    icon={<ItemIcon size={18} aria-hidden />}
                    ready={item.ready ?? false}
                    phase={item.phase}
                  />
                )
              })}
            </div>
          )
        })}
      </nav>

      <div className="mt-auto border-t border-slate-100 pt-3 group-data-[collapsed=true]/sb:hidden">
        <div
          className="text-[8px] leading-tight font-medium text-slate-400"
          title={`${BRAND.project} — ${BRAND.client}`}
        >
          {BRAND.owner} © {BRAND.year}
        </div>
      </div>
    </div>
  )
}
