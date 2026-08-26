import type { ReactNode } from 'react'
import { requireUser } from '@/lib/auth/session'
import { Shell } from '@/components/app-shell/shell'
import { Sidebar } from '@/components/app-shell/sidebar'
import { Topbar } from '@/components/app-shell/topbar'

export default async function AppLayout({ children }: { children: ReactNode }) {
  const user = await requireUser()

  return (
    <Shell
      sidebar={<Sidebar permissions={user.permissions} />}
      topbar={<Topbar user={user} />}
    >
      {children}
    </Shell>
  )
}
