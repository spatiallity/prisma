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
export type StageStatus = 'Belum Mulai' | 'Dalam Pengerjaan' | 'Selesai'
export type ProgressSource = 'manual' | 'daily_progress'
export type RoutingStatus =
  | 'Pending'
  | 'In Progress'
  | 'Completed'
  | 'Returned'
  | 'Rejected'

export const ROUTING_STATUSES: RoutingStatus[] = [
  'Pending',
  'In Progress',
  'Completed',
  'Returned',
  'Rejected',
]
export type DesignStage =
  | 'Desain Awal'
  | 'Review'
  | 'Pemaparan'
  | 'Revisi'
  | 'Finalisasi'
  | 'Approved'

export const DESIGN_STAGES: DesignStage[] = [
  'Desain Awal',
  'Review',
  'Pemaparan',
  'Revisi',
  'Finalisasi',
  'Approved',
]
export type DailyUpdateStatus =
  | 'Updated Today'
  | 'Belum Update'
  | 'Terlambat Update'
  | 'Completed'

export const MEASUREMENTS: MeasurementType[] = ['percentage', 'area', 'quantity', 'stage']
export const STAGE_STATUSES: StageStatus[] = ['Belum Mulai', 'Dalam Pengerjaan', 'Selesai']

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

export type ActivityTemplateItemRow = Timestamps & {
  id: string
  template_id: string
  name: string
  weight: number
  measurement: MeasurementType
  unit: string | null
  sequence: number
  target_from_spk_area: boolean
  default_target: number | null
  notes: string | null
}

export type SpkActivityRow = Timestamps & {
  id: string
  spk_id: string
  template_item_id: string | null
  name: string
  weight: number
  measurement: MeasurementType
  unit: string | null
  sequence: number
  target_value: number | null
  current_value: number
  current_stage: StageStatus
  /** Generated column (migration 0005) — read-only. */
  progress_percent: number
  notes: string | null
}

export type ActivityProgressRow = Timestamps & {
  id: string
  spk_activity_id: string
  progress_date: string
  actual_value: number | null
  stage: StageStatus | null
  notes: string | null
  source: ProgressSource
  recorded_by: string | null
}

export type DailyPlanRow = Timestamps & {
  id: string
  spk_id: string
  spk_activity_id: string | null
  plan_date: string
  vendor_id: string | null
  team_id: string | null
  target_value: number | null
  unit: string | null
  notes: string | null
  status: RecordStatus
  created_by: string | null
}

export type DailyProgressRow = Timestamps & {
  id: string
  daily_plan_id: string | null
  spk_id: string
  spk_activity_id: string | null
  progress_date: string
  vendor_id: string | null
  team_id: string | null
  /** Section 18 — the increment achieved that day, not a cumulative figure. */
  actual_value: number
  unit: string | null
  notes: string | null
  update_status: DailyUpdateStatus
  status: RecordStatus
  submitted_by: string | null
  submitted_at: string
}

export type DesignRow = Timestamps & {
  id: string
  spk_id: string
  title: string | null
  /** Maintained by the trigger in migration 0006 from the newest revision. */
  current_stage: DesignStage
  pic_id: string | null
  target_date: string | null
  approved_at: string | null
  approved_by: string | null
  status: RecordStatus
  notes: string | null
  created_by: string | null
}

export type DesignRevisionRow = Timestamps & {
  id: string
  design_id: string
  revision_no: number
  stage: DesignStage
  pic_id: string | null
  started_at: string | null
  completed_at: string | null
  notes: string | null
  status: RecordStatus
  created_by: string | null
}

export type RoutingTemplateStepRow = Timestamps & {
  id: string
  template_id: string
  name: string
  sequence: number
  default_pic_role: string | null
  /** Section 24 — days above which the stage counts as a bottleneck. */
  sla_days: number | null
  requires_approval: boolean
  notes: string | null
}

export type SpkRoutingRow = Timestamps & {
  id: string
  spk_id: string
  template_id: string | null
  document_type: string
  document_number: string | null
  /** Rolled up from routing_history by the trigger in migration 0007. */
  status: RoutingStatus
  started_at: string | null
  completed_at: string | null
  notes: string | null
  created_by: string | null
}

export type RoutingHistoryRow = Timestamps & {
  id: string
  spk_routing_id: string
  template_step_id: string | null
  step_name: string
  sequence: number
  pic_id: string | null
  pic_name: string | null
  status: RoutingStatus
  started_at: string | null
  completed_at: string | null
  /** Generated column (migration 0007) — read-only. */
  duration_days: number | null
  sla_days: number | null
  note: string | null
  created_by: string | null
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

/** migrations/20260825001100 — Section 20, productivity per team. */
export type ProductivityView = {
  spk_id: string
  vendor_id: string | null
  team_id: string | null
  spk_activity_id: string | null
  activity_name: string | null
  unit: string | null
  working_days: number
  total_actual: number
  per_day: number | null
}

/** migrations/20260825001100 — Section 18, plan versus actual per day. */
export type PlanVsActualView = {
  daily_plan_id: string
  spk_id: string
  plan_date: string
  vendor_id: string | null
  team_id: string | null
  spk_activity_id: string | null
  target_value: number | null
  actual_value: number
  achievement_percent: number
}

/** migrations/20260825001100 — Section 10, Today's Schedule. */
export type TodayScheduleView = {
  daily_plan_id: string
  spk_id: string
  spk_number: string
  site_code: string | null
  vendor_id: string | null
  vendor_name: string | null
  team_id: string | null
  team_name: string | null
  spk_activity_id: string | null
  activity_name: string | null
  target_value: number | null
  unit: string | null
  update_status: DailyUpdateStatus
}

/** migrations/20260825001100 — Section 24, lead time per routing stage. */
export type RoutingLeadTimeView = {
  routing_history_id: string
  spk_id: string
  spk_routing_id: string
  document_type: string
  step_name: string
  sequence: number
  status: RoutingStatus
  started_at: string | null
  completed_at: string | null
  duration_days: number | null
  sla_days: number | null
  /** Counts up while the stage is still open. */
  elapsed_days: number | null
  is_overdue: boolean
}

/** migrations/20260825001100 — Section 24, average per stage across documents. */
export type RoutingStageAverageView = {
  step_name: string
  completed_count: number
  avg_duration_days: number | null
  max_duration_days: number | null
}

/** migrations/20260825001100 — Activity Contribution (Section 15). */
export type SpkActivityProgressView = {
  spk_activity_id: string
  spk_id: string
  name: string
  sequence: number
  measurement: MeasurementType
  unit: string | null
  weight: number
  target_value: number | null
  current_value: number
  current_stage: StageStatus
  progress_percent: number
  contribution_percent: number
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
      activity_template_items: Table<
        ActivityTemplateItemRow,
        | 'id'
        | 'created_at'
        | 'updated_at'
        | 'unit'
        | 'target_from_spk_area'
        | 'default_target'
        | 'notes'
      >
      spk_activities: Table<
        SpkActivityRow,
        | 'id'
        | 'created_at'
        | 'updated_at'
        | 'progress_percent'
        | 'current_value'
        | 'current_stage'
        | 'template_item_id'
        | 'unit'
        | 'target_value'
        | 'notes'
      >
      daily_plans: Table<
        DailyPlanRow,
        | 'id'
        | 'created_at'
        | 'updated_at'
        | 'status'
        | 'spk_activity_id'
        | 'vendor_id'
        | 'team_id'
        | 'target_value'
        | 'unit'
        | 'notes'
        | 'created_by'
      >
      daily_progress: Table<
        DailyProgressRow,
        | 'id'
        | 'created_at'
        | 'updated_at'
        | 'status'
        | 'update_status'
        | 'submitted_at'
        | 'daily_plan_id'
        | 'spk_activity_id'
        | 'vendor_id'
        | 'team_id'
        | 'actual_value'
        | 'unit'
        | 'notes'
        | 'submitted_by'
      >
      spk_routing: Table<
        SpkRoutingRow,
        | 'id'
        | 'created_at'
        | 'updated_at'
        | 'status'
        | 'template_id'
        | 'document_number'
        | 'started_at'
        | 'completed_at'
        | 'notes'
        | 'created_by'
      >
      routing_history: Table<
        RoutingHistoryRow,
        | 'id'
        | 'created_at'
        | 'updated_at'
        | 'status'
        | 'duration_days'
        | 'template_step_id'
        | 'pic_id'
        | 'pic_name'
        | 'started_at'
        | 'completed_at'
        | 'sla_days'
        | 'note'
        | 'created_by'
      >
      routing_template_steps: Table<
        RoutingTemplateStepRow,
        | 'id'
        | 'created_at'
        | 'updated_at'
        | 'default_pic_role'
        | 'sla_days'
        | 'requires_approval'
        | 'notes'
      >
      designs: Table<
        DesignRow,
        | 'id'
        | 'created_at'
        | 'updated_at'
        | 'status'
        | 'current_stage'
        | 'title'
        | 'pic_id'
        | 'target_date'
        | 'approved_at'
        | 'approved_by'
        | 'notes'
        | 'created_by'
      >
      design_revisions: Table<
        DesignRevisionRow,
        | 'id'
        | 'created_at'
        | 'updated_at'
        | 'status'
        | 'pic_id'
        | 'started_at'
        | 'completed_at'
        | 'notes'
        | 'created_by'
      >
      activity_progress: Table<
        ActivityProgressRow,
        | 'id'
        | 'created_at'
        | 'updated_at'
        | 'progress_date'
        | 'actual_value'
        | 'stage'
        | 'notes'
        | 'source'
        | 'recorded_by'
      >
    }
    Views: {
      v_spk_progress: { Row: SpkProgressView; Relationships: [] }
      v_spk_activity_progress: { Row: SpkActivityProgressView; Relationships: [] }
      v_productivity: { Row: ProductivityView; Relationships: [] }
      v_routing_lead_time: { Row: RoutingLeadTimeView; Relationships: [] }
      v_routing_stage_average: { Row: RoutingStageAverageView; Relationships: [] }
      v_plan_vs_actual: { Row: PlanVsActualView; Relationships: [] }
      v_today_schedule: { Row: TodayScheduleView; Relationships: [] }
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
      stage_status: StageStatus
      daily_update_status: DailyUpdateStatus
      design_stage: DesignStage
      routing_status: RoutingStatus
    }
    CompositeTypes: Record<string, never>
  }
}
