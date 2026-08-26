// Hand-written subset covering the Phase 1 (Foundation) tables only.
//
// Regenerate the full file once the migrations are applied to a project:
//   pnpm dlx supabase gen types typescript --project-id <ref> > src/lib/supabase/types.ts
// The shape below matches what the generator emits, so the swap is drop-in.

export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

// --- Enums (supabase/migrations/20260825000100, 20260825000200) -------------

export type RecordStatus = 'Active' | 'Inactive' | 'Archived'
export type PermissionScope = 'all' | 'own' | 'limited'
export type AppAction = 'view' | 'create' | 'edit'

export type AppModule =
  | 'dashboard'
  | 'spk'
  | 'vendor'
  | 'schedule'
  | 'daily_plan'
  | 'daily_progress'
  | 'progress'
  | 'design'
  | 'routing'
  | 'contract'
  | 'opname'
  | 'pad'
  | 'invoice'
  | 'payment'
  | 'spending'
  | 'margin'
  | 'report'
  | 'master_data'
  | 'user_management'
  | 'audit_log'

export type AuditAction = 'INSERT' | 'UPDATE' | 'DELETE'

export type SpkStatus = 'Draft' | 'On Going' | 'Selesai' | 'Archived' | 'Cancelled'

// --- Row shapes -------------------------------------------------------------

type Timestamps = {
  created_at: string
  updated_at: string
}

export type RoleRow = Timestamps & {
  id: string
  code: string
  name: string
  description: string | null
  status: RecordStatus
}

export type PermissionRow = {
  id: string
  module: AppModule
  action: AppAction
  description: string | null
  created_at: string
}

export type RolePermissionRow = {
  role_id: string
  permission_id: string
  scope: PermissionScope
  created_at: string
}

export type UserRow = Timestamps & {
  id: string
  email: string
  full_name: string
  phone: string | null
  role_id: string
  vendor_id: string | null
  status: RecordStatus
  last_login_at: string | null
}

export type VendorRow = Timestamps & {
  id: string
  code: string
  name: string
  contact_person: string | null
  phone: string | null
  email: string | null
  address: string | null
  notes: string | null
  status: RecordStatus
  created_by: string | null
}

export type AuditLogRow = {
  id: number
  table_name: string
  record_id: string | null
  spk_id: string | null
  action: AuditAction
  changed_by: string | null
  changed_at: string
  changed_fields: string[] | null
  before_data: Json | null
  after_data: Json | null
}

export type Database = {
  public: {
    Tables: {
      roles: {
        Row: RoleRow
        Insert: Omit<RoleRow, 'id' | 'created_at' | 'updated_at' | 'status'> &
          Partial<Pick<RoleRow, 'id' | 'status'>>
        Update: Partial<RoleRow>
        Relationships: []
      }
      permissions: {
        Row: PermissionRow
        Insert: Omit<PermissionRow, 'id' | 'created_at' | 'description'> &
          Partial<Pick<PermissionRow, 'id' | 'description'>>
        Update: Partial<PermissionRow>
        Relationships: []
      }
      role_permissions: {
        Row: RolePermissionRow
        Insert: Omit<RolePermissionRow, 'created_at' | 'scope'> &
          Partial<Pick<RolePermissionRow, 'scope'>>
        Update: Partial<RolePermissionRow>
        Relationships: []
      }
      users: {
        Row: UserRow
        Insert: Omit<UserRow, 'created_at' | 'updated_at' | 'status' | 'last_login_at'> &
          Partial<Pick<UserRow, 'status' | 'last_login_at'>>
        Update: Partial<UserRow>
        Relationships: []
      }
      audit_logs: {
        Row: AuditLogRow
        Insert: Omit<AuditLogRow, 'id' | 'changed_at'> &
          Partial<Pick<AuditLogRow, 'changed_at'>>
        Update: Partial<AuditLogRow>
        Relationships: []
      }
      vendors: {
        Row: VendorRow
        Insert: Omit<VendorRow, 'id' | 'created_at' | 'updated_at' | 'status'> &
          Partial<Pick<VendorRow, 'id' | 'status'>>
        Update: Partial<VendorRow>
        Relationships: []
      }
    }
    Views: Record<string, never>
    Functions: Record<string, never>
    Enums: {
      record_status: RecordStatus
      permission_scope: PermissionScope
      app_module: AppModule
      app_action: AppAction
      spk_status: SpkStatus
      audit_action: AuditAction
    }
    CompositeTypes: Record<string, never>
  }
}
