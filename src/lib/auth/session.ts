import 'server-only'

import { cache } from 'react'
import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import type { AppAction, AppModule, PermissionMap } from '@/lib/auth/permissions'
import { can } from '@/lib/auth/permissions'
import type { RecordStatus } from '@/lib/supabase/types'

export type SessionUser = {
  id: string
  email: string
  fullName: string
  phone: string | null
  status: RecordStatus
  vendorId: string | null
  lastLoginAt: string | null
  role: { id: string; code: string; name: string }
  permissions: PermissionMap
}

export type SessionResult =
  | { state: 'anonymous' }
  /** Signed in through Supabase Auth but no row in public.users yet. */
  | { state: 'no-profile'; authUserId: string; email: string | null }
  /** Profile exists but was deactivated (Section 4.4 — no hard delete). */
  | { state: 'inactive'; email: string }
  | { state: 'active'; user: SessionUser }

/**
 * Resolves the signed-in user together with the Section 6 permission matrix.
 * Wrapped in cache() so a request that renders the shell plus a page hits the
 * database once.
 */
export const getSession = cache(async (): Promise<SessionResult> => {
  const supabase = await createClient()

  const {
    data: { user: authUser },
  } = await supabase.auth.getUser()

  if (!authUser) return { state: 'anonymous' }

  const { data: profile } = await supabase
    .from('users')
    .select('*')
    .eq('id', authUser.id)
    .maybeSingle()

  if (!profile) {
    return { state: 'no-profile', authUserId: authUser.id, email: authUser.email ?? null }
  }

  if (profile.status !== 'Active') {
    return { state: 'inactive', email: profile.email }
  }

  const [{ data: role }, { data: grants }, { data: catalogue }] = await Promise.all([
    supabase.from('roles').select('id, code, name').eq('id', profile.role_id).single(),
    supabase.from('role_permissions').select('permission_id, scope').eq('role_id', profile.role_id),
    supabase.from('permissions').select('id, module, action'),
  ])

  const byId = new Map((catalogue ?? []).map((p) => [p.id, p]))
  const permissions: PermissionMap = {}
  for (const grant of grants ?? []) {
    const permission = byId.get(grant.permission_id)
    if (permission) permissions[`${permission.module}:${permission.action}`] = grant.scope
  }

  return {
    state: 'active',
    user: {
      id: profile.id,
      email: profile.email,
      fullName: profile.full_name,
      phone: profile.phone,
      status: profile.status,
      vendorId: profile.vendor_id,
      lastLoginAt: profile.last_login_at,
      role: role ?? { id: profile.role_id, code: 'unknown', name: 'Unknown' },
      permissions,
    },
  }
})

/** Server-side guard for every page inside the (app) group. */
export async function requireUser(): Promise<SessionUser> {
  const session = await getSession()

  switch (session.state) {
    case 'active':
      return session.user
    case 'no-profile':
      redirect('/no-profile')
    case 'inactive':
      redirect('/inactive')
    default:
      redirect('/login')
  }
}

/**
 * Page-level permission guard. RLS already refuses the data; this keeps the
 * user from landing on a page that would render nothing but errors.
 */
export async function requirePermission(
  module: AppModule,
  action: AppAction = 'view',
): Promise<SessionUser> {
  const user = await requireUser()
  if (!can(user.permissions, module, action)) redirect('/forbidden')
  return user
}
