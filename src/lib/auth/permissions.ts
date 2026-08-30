import type { AppAction, AppModule, PermissionScope } from '@/lib/supabase/types'

export type { AppAction, AppModule, PermissionScope }

export type PermissionKey = `${AppModule}:${AppAction}`

/** Granted permissions of the signed-in user, keyed "module:action". */
export type PermissionMap = Partial<Record<PermissionKey, PermissionScope>>

export function scopeOf(
  permissions: PermissionMap,
  module: AppModule,
  action: AppAction,
): PermissionScope | null {
  return permissions[`${module}:${action}`] ?? null
}

/**
 * Frontend mirror of has_perm() (migration 0002). The database enforces the
 * same rule under RLS — this only decides what the UI offers (Section 31:
 * "Pembatasan dilakukan pada database level, bukan hanya frontend").
 */
export function can(
  permissions: PermissionMap,
  module: AppModule,
  action: AppAction,
): boolean {
  return scopeOf(permissions, module, action) !== null
}

/** True when the user sees every record, not only their own (Section 6). */
export function canAll(
  permissions: PermissionMap,
  module: AppModule,
  action: AppAction,
): boolean {
  const scope = scopeOf(permissions, module, action)
  return scope === 'all' || scope === 'limited'
}

export const SCOPE_LABEL: Record<PermissionScope, string> = {
  all: 'Semua data',
  own: 'Data sendiri',
  limited: 'Terbatas',
}

export const MODULE_LABEL: Record<AppModule, string> = {
  dashboard: 'Dashboard',
  spk: 'SPK',
  vendor: 'Vendor Jasa Survey',
  schedule: 'Schedule',
  daily_plan: 'Daily Plan',
  daily_progress: 'Daily Progress',
  progress: 'Progress',
  design: 'Design',
  routing: 'Routing',
  contract: 'Contract',
  opname: 'Opname',
  pad: 'PAD',
  invoice: 'Invoice',
  payment: 'Payment',
  spending: 'Finance (RAB)',
  /** migration 0016 retired the margin-per-SPK cost model; kept only because
   *  the app_module enum value still exists in the database. */
  margin: 'Margin per SPK (nonaktif)',
  report: 'Reports',
  master_data: 'Master Data',
  user_management: 'User Management',
  audit_log: 'Audit Log',
}

export const ACTION_LABEL: Record<AppAction, string> = {
  view: 'View',
  create: 'Create',
  edit: 'Edit',
}

export const ALL_MODULES = Object.keys(MODULE_LABEL) as AppModule[]
export const ALL_ACTIONS: AppAction[] = ['view', 'create', 'edit']
