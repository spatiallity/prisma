// Hand-written subset covering the tables Phase 1 and Phase 2 actually touch.
//
// Regenerate the full file once Phase 3 needs the progress engine:
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
export type AuditAction = 'INSERT' | 'UPDATE' | 'DELETE'
export type MeasurementType = 'percentage' | 'area' | 'quantity' | 'stage'

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

export type SpkStatus = 'Draft' | 'On Going' | 'Selesai' | 'Archived' | 'Cancelled'

export const SPK_STATUSES: SpkStatus[] = [
  'Draft',
  'On Going',
  'Selesai',
  'Archived',
  'Cancelled',
]

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

export type VendorTeamRow = Timestamps & {
  id: string
  vendor_id: string
  name: string
  notes: string | null
  status: RecordStatus
}

export type VendorMemberRow = Timestamps & {
  id: string
  team_id: string
  full_name: string
  position: string | null
  phone: string | null
  user_id: string | null
  status: RecordStatus
}

export type SpkRow = Timestamps & {
  id: string
  spk_number: string
  site_code: string | null
  work_name: string
  work_type: string | null
  location: string | null
  kabupaten: string | null
  provinsi: string | null
  area_ha: number | null
  contract_value: number | null
  start_date: string | null
  end_date: string | null
  vendor_id: string | null
  project_manager_id: string | null
  activity_template_id: string | null
  routing_template_id: string | null
  status: SpkStatus
  notes: string | null
  created_by: string | null
  updated_by: string | null
}

export type SpkAssignmentRow = Timestamps & {
  id: string
  spk_id: string
  vendor_id: string
  team_id: string | null
  assigned_from: string | null
  assigned_to: string | null
  status: RecordStatus
  notes: string | null
  created_by: string | null
}

export type TemplateRow = Timestamps & {
  id: string
  code: string
  name: string
  description: string | null
  status: RecordStatus
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

// --- View shapes ------------------------------------------------------------

/** migrations/20260825001100 — Overall Progress, computed (Section 15). */
export type SpkProgressView = {
  spk_id: string
  spk_number: string
  site_code: string | null
  work_name: string
  status: SpkStatus
  start_date: string | null
  end_date: string | null
  overall_progress: number
  total_weight: number
  activity_count: number
  activity_completed: number
}

type Table<Row, Generated extends keyof Row = never> = {
  Row: Row
  Insert: Omit<Row, Generated> & Partial<Pick<Row, Generated & keyof Row>>
  Update: Partial<Row>
  Relationships: []
}

export type Database = {
  public: {
    Tables: {
      roles: Table<RoleRow, 'id' | 'created_at' | 'updated_at' | 'status' | 'description'>
      permissions: Table<PermissionRow, 'id' | 'created_at' | 'description'>
      role_permissions: Table<RolePermissionRow, 'created_at' | 'scope'>
      users: Table<UserRow, 'created_at' | 'updated_at' | 'status' | 'last_login_at' | 'vendor_id' | 'phone'>
      vendors: Table<
        VendorRow,
        | 'id'
        | 'created_at'
        | 'updated_at'
        | 'status'
        | 'contact_person'
        | 'phone'
        | 'email'
        | 'address'
        | 'notes'
        | 'created_by'
      >
      vendor_teams: Table<VendorTeamRow, 'id' | 'created_at' | 'updated_at' | 'status' | 'notes'>
      vendor_members: Table<
        VendorMemberRow,
        'id' | 'created_at' | 'updated_at' | 'status' | 'position' | 'phone' | 'user_id'
      >
      spks: Table<
        SpkRow,
        | 'id'
        | 'created_at'
        | 'updated_at'
        | 'status'
        | 'site_code'
        | 'work_type'
        | 'location'
        | 'kabupaten'
        | 'provinsi'
        | 'area_ha'
        | 'contract_value'
        | 'start_date'
        | 'end_date'
        | 'vendor_id'
        | 'project_manager_id'
        | 'activity_template_id'
        | 'routing_template_id'
        | 'notes'
        | 'created_by'
        | 'updated_by'
      >
      spk_assignments: Table<
        SpkAssignmentRow,
        | 'id'
        | 'created_at'
        | 'updated_at'
        | 'status'
        | 'team_id'
        | 'assigned_from'
        | 'assigned_to'
        | 'notes'
        | 'created_by'
      >
      activity_templates: Table<TemplateRow, 'id' | 'created_at' | 'updated_at' | 'status' | 'description'>
      routing_templates: Table<TemplateRow, 'id' | 'created_at' | 'updated_at' | 'status' | 'description'>
      audit_logs: Table<AuditLogRow, 'id' | 'changed_at'>
    }
    Views: {
      v_spk_progress: { Row: SpkProgressView; Relationships: [] }
    }
    Functions: Record<string, never>
    Enums: {
      record_status: RecordStatus
      permission_scope: PermissionScope
      app_module: AppModule
      app_action: AppAction
      spk_status: SpkStatus
      audit_action: AuditAction
      measurement_type: MeasurementType
    }
    CompositeTypes: Record<string, never>
  }
}
