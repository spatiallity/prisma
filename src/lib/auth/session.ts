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

type PermissionCatalogue = { id: string; module: AppModule; action: AppAction }[]

/**
 * The permission catalogue is reference data — it only changes when a
 * migration adds a module or an action, never through the app. Fetching it on
 * every request spent a database round trip per page view on a table that is
 * effectively frozen, so it is held briefly per server instance instead.
 */
const CATALOGUE_TTL_MS = 5 * 60 * 1000
let catalogueCache: { rows: PermissionCatalogue; expires: number } | null = null

async function getPermissionCatalogue(
  supabase: Awaited<ReturnType<typeof createClient>>,
): Promise<PermissionCatalogue> {
  if (catalogueCache && catalogueCache.expires > Date.now()) return catalogueCache.rows

  const { data } = await supabase.from('permissions').select('id, module, action')
  const rows = (data ?? []) as PermissionCatalogue
  // Only a real answer is worth keeping: an empty result usually means the
  // request failed, and caching that would strip every permission for the
  // whole TTL.
  if (rows.length > 0) catalogueCache = { rows, expires: Date.now() + CATALOGUE_TTL_MS }
  return rows
}

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

  // The catalogue does not depend on which user this is, so it rides along
  // with the profile lookup instead of queueing behind it.
  const [{ data: profile }, catalogue] = await Promise.all([
    supabase.from('users').select('*').eq('id', authUser.id).maybeSingle(),
    getPermissionCatalogue(supabase),
  ])

  if (!profile) {
    return { state: 'no-profile', authUserId: authUser.id, email: authUser.email ?? null }
  }

  if (profile.status !== 'Active') {
    return { state: 'inactive', email: profile.email }
  }

  const [{ data: role }, { data: grants }] = await Promise.all([
    supabase.from('roles').select('id, code, name').eq('id', profile.role_id).single(),
    supabase.from('role_permissions').select('permission_id, scope').eq('role_id', profile.role_id),
  ])

  const byId = new Map(catalogue.map((p) => [p.id, p]))
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
