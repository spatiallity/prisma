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
export type NotificationSeverity = 'info' | 'warning' | 'critical'
export type FinancialDocStatus =
  | 'Draft'
  | 'Submitted'
  | 'Approved'
  | 'Rejected'
  | 'Cancelled'
/** migrations/20260830000100 — Excel-tab origin of a finance_transactions row. */
export type FinanceCategory =
  | 'umk'
  | 'sppd'
  | 'ppbj_barang'
  | 'ppbj_jasa'
  | 'gaji_ptt'
  | 'mcu'

/** Whether a UMK cash advance has been reconciled yet. */
export type PerjabStatus = 'Belum' | 'Sudah'
export const PERJAB_STATUSES: PerjabStatus[] = ['Belum', 'Sudah']

export const FINANCIAL_DOC_STATUSES: FinancialDocStatus[] = [
  'Draft',
  'Submitted',
  'Approved',
  'Rejected',
  'Cancelled',
]
export const FINANCE_CATEGORIES: FinanceCategory[] = [
  'umk',
  'sppd',
  'ppbj_barang',
  'ppbj_jasa',
  'gaji_ptt',
  'mcu',
]
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
  // Desain Siteplan
  | 'Pembuatan Desain Awal'
  | 'Review Desain Awal'
  | 'Revisi Desain Awal'
  | 'Pembuatan Peta Inventaris dan Stake Out'
  | 'Finalisasi'
  | 'Finish'
  | 'Opname'
  // Finalisasi Desain
  | 'Pembuatan Finalisasi Desain'
  | 'Review Internal'
  | 'Sinkronisasi Hasil Finalisasi'
  | 'Review PIC Pertamina'
  | 'Acc PIC Pertamina'

export const DESIGN_STAGES: DesignStage[] = [
  'Pembuatan Desain Awal',
  'Review Desain Awal',
  'Revisi Desain Awal',
  'Pembuatan Peta Inventaris dan Stake Out',
  'Finalisasi',
  'Finish',
  'Opname',
  'Pembuatan Finalisasi Desain',
  'Review Internal',
  'Sinkronisasi Hasil Finalisasi',
  'Review PIC Pertamina',
  'Acc PIC Pertamina',
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
  /** Set once opname is done — usually after Desain Awal. Just a mark, no document. */
  opname_marked_at: string | null
  opname_marked_by: string | null
  opname_value: number | null
  /** Set once PAD is made — after opname is marked done. */
  pad_marked_at: string | null
  pad_marked_by: string | null
  pad_value: number | null
  /** Set once terrain survey (Survei Pendahuluan..Pengolahan Data Topo, shown as one stage) is done. */
  terrain_survey_completed_at: string | null
  terrain_survey_marked_by: string | null
  /** Pengecekan Bersama execution date — the stage kept from the old field-survey checklist. */
  joint_check_date: string | null
  /** Jumlah patok, only meaningful when work_type is 'Stake Out'. */
  stake_out_patok: number | null
  /** 'Lokasi Bor' or 'Fasilitas Produksi'. */
  location_type: string | null
  /** Contract penalty, if any — read live in Financial Report same as opname_value/pad_value. */
  denda_value: number | null
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

/** migration 0020 — a design never crosses phases; reaching Finish auto-opens
 *  a separate finalisasi record instead. */
export type DesignPhase = 'siteplan' | 'finalisasi'

export type DesignRow = Timestamps & {
  id: string
  spk_id: string
  title: string | null
  phase: DesignPhase
  /** Maintained by the trigger in migration 0006/0020 from the newest revision. */
  current_stage: DesignStage
  pic_id: string | null
  target_date: string | null
  approved_at: string | null
  approved_by: string | null
  /** When the field survey's topographic data actually arrived — the design
   *  team's own tracking, separate from the spk_activities ledger. */
  topo_data_received_at: string | null
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
  /** Who reviews this stage on the Pertamina side — free text. */
  pic_pertamina: string | null
  status: RecordStatus
  created_by: string | null
}

export type DesignStageRevisionRow = {
  id: string
  design_revision_id: string
  note: string
  resubmit_at: string
  created_by: string | null
  created_at: string
}

/** A design PIC — a named staff member, not a login. */
export type DesignPicRow = {
  id: string
  full_name: string
  created_at: string
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
  /** Only meaningful on the Invoiced step. */
  invoice_number: string | null
  invoice_value: number | null
  invoice_date: string | null
  created_by: string | null
}

export type RoutingStepRevisionRow = {
  id: string
  routing_history_id: string
  note: string
  resubmit_at: string
  created_by: string | null
  created_at: string
}

// --- Revenue side (Section 25.1-25.5) ---------------------------------------

export type ContractRow = Timestamps & {
  id: string
  spk_id: string
  contract_number: string
  contract_value: number
  contract_date: string | null
  amendment_no: number
  parent_contract_id: string | null
  /** Contract penalty, if any — replaces Payment in the Financial Report now
   *  that Payment is hidden project-wide. */
  denda_value: number | null
  status: FinancialDocStatus
  notes: string | null
  created_by: string | null
}

export type OpnameRow = Timestamps & {
  id: string
  spk_id: string
  opname_number: string | null
  opname_value: number
  opname_date: string | null
  period_start: string | null
  period_end: string | null
  status: FinancialDocStatus
  notes: string | null
  created_by: string | null
}

export type PadRow = Timestamps & {
  id: string
  spk_id: string
  opname_id: string | null
  pad_number: string | null
  pad_value: number
  pad_date: string | null
  status: FinancialDocStatus
  notes: string | null
  created_by: string | null
}

export type InvoiceRow = Timestamps & {
  id: string
  spk_id: string
  pad_id: string | null
  invoice_number: string | null
  invoice_value: number
  invoice_date: string | null
  due_date: string | null
  status: FinancialDocStatus
  notes: string | null
  created_by: string | null
}

export type PaymentRow = Timestamps & {
  id: string
  spk_id: string
  invoice_id: string | null
  payment_value: number
  payment_date: string | null
  reference: string | null
  status: FinancialDocStatus
  notes: string | null
  created_by: string | null
}

export type PersonnelRow = Timestamps & {
  id: string
  code: string | null
  full_name: string
  position: string | null
  user_id: string | null
  join_date: string | null
  status: RecordStatus
  notes: string | null
}

// --- Finance / RAB monitoring (migration 20260830000100) --------------------

export type ChartOfAccountRow = Timestamps & {
  kode_akun: string
  kode_gl: number | null
  level: number | null
  kategori_roman: string | null
  kategori_roman_label: string | null
  uraian: string
  anggaran_rp: number | null
  status: RecordStatus
}

export type FinanceTransactionRow = Timestamps & {
  id: string
  kategori: FinanceCategory
  kode_akun: string
  tanggal: string | null
  /** First-of-month bucket, e.g. '2025-08-01' for Agustus 2025. */
  bulan: string
  jumlah: number
  deskripsi: string | null
  no_bukti: string | null
  personnel_id: string | null
  personil_nama: string | null
  /** 'Upah' | 'Tunjangan' for kategori 'gaji_ptt'; null otherwise. */
  jenis_detail: string | null
  /** Who withdrew the money — 'umk' kategori only. Different person from
   *  personil_nama, who the money was spent on/for. */
  pj_nama: string | null
  /** Whether the cash advance has been reconciled — 'umk' kategori only. */
  perjab: PerjabStatus | null
  spk_id: string | null
  meta: Json | null
  file_id: string | null
  status: RecordStatus
  created_by: string | null
}

/** migrations/20260825001100 — tunable thresholds (Section 9). */
export type AppSettingRow = {
  key: string
  value: string
  value_type: 'number' | 'text' | 'boolean'
  description: string | null
  updated_by: string | null
  updated_at: string
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

/** migrations/20260825001100 — Section 8.1, the six headline counts. */
export type DashboardKpiView = {
  total_spk: number
  spk_on_going: number
  spk_selesai: number
  spk_routing: number
  spk_pad: number
  spk_invoice: number
  spk_payment: number
}

/** migrations/20260825001100 — Section 9, every bottleneck condition. */
export type BottleneckView = {
  area: string
  reason: string
  spk_id: string | null
  spk_number: string | null
  severity: NotificationSeverity
  /** The number that triggered it — days late, rupiah short, and so on. */
  metric: number | null
  site_code: string | null
}

/** migrations/20260825001100 — Section 26.1, revenue reconciliation per SPK. */
export type SpkFinancialView = {
  spk_id: string
  spk_number: string
  spk_contract_value: number | null
  contract_total: number
  opname_total: number
  pad_total: number
  invoice_total: number
  payment_total: number
  contract_vs_opname: number
  opname_vs_invoice: number
  /** contract_total - invoice_total — Payment is out of this reconciliation
   *  now that the Payment column/module is hidden project-wide. */
  outstanding_payment: number
  denda_total: number
}

/** migrations/20260830000100 — RAB monitoring: realisasi per kode_akun per bulan. */
export type FinanceRealisasiBulananView = {
  kode_akun: string
  uraian: string
  kategori_roman: string | null
  bulan: string
  realisasi: number
}

/** migrations/20260830000100 — Anggaran vs Realisasi vs Selisih per kode_akun, all-time. */
export type FinanceAkunSummaryView = {
  kode_akun: string
  kode_gl: number | null
  uraian: string
  kategori_roman: string | null
  kategori_roman_label: string | null
  level: number | null
  anggaran_rp: number | null
  realisasi_total: number
  selisih: number | null
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
        | 'opname_marked_at'
        | 'opname_marked_by'
        | 'opname_value'
        | 'pad_marked_at'
        | 'pad_marked_by'
        | 'pad_value'
        | 'terrain_survey_completed_at'
        | 'terrain_survey_marked_by'
        | 'joint_check_date'
        | 'stake_out_patok'
        | 'location_type'
        | 'denda_value'
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
      app_settings: Table<
        AppSettingRow,
        'updated_at' | 'value_type' | 'description' | 'updated_by'
      >
      contracts: Table<
        ContractRow,
        | 'id' | 'created_at' | 'updated_at' | 'status' | 'amendment_no'
        | 'contract_date' | 'parent_contract_id' | 'denda_value' | 'notes' | 'created_by'
      >
      opnames: Table<
        OpnameRow,
        | 'id' | 'created_at' | 'updated_at' | 'status' | 'opname_number'
        | 'opname_date' | 'period_start' | 'period_end' | 'notes' | 'created_by'
      >
      pad: Table<
        PadRow,
        | 'id' | 'created_at' | 'updated_at' | 'status' | 'opname_id'
        | 'pad_number' | 'pad_date' | 'notes' | 'created_by'
      >
      invoices: Table<
        InvoiceRow,
        | 'id' | 'created_at' | 'updated_at' | 'status' | 'pad_id'
        | 'invoice_number' | 'invoice_date' | 'due_date' | 'notes' | 'created_by'
      >
      payments: Table<
        PaymentRow,
        | 'id' | 'created_at' | 'updated_at' | 'status' | 'invoice_id'
        | 'payment_date' | 'reference' | 'notes' | 'created_by'
      >
      personnel: Table<
        PersonnelRow,
        | 'id' | 'created_at' | 'updated_at' | 'status' | 'code' | 'position'
        | 'user_id' | 'join_date' | 'notes'
      >
      chart_of_accounts: Table<
        ChartOfAccountRow,
        | 'created_at' | 'updated_at' | 'status' | 'kode_gl' | 'level'
        | 'kategori_roman' | 'kategori_roman_label' | 'anggaran_rp'
      >
      finance_transactions: Table<
        FinanceTransactionRow,
        | 'id' | 'created_at' | 'updated_at' | 'status' | 'tanggal' | 'deskripsi'
        | 'no_bukti' | 'personnel_id' | 'personil_nama' | 'jenis_detail' | 'pj_nama' | 'perjab'
        | 'spk_id' | 'meta' | 'file_id' | 'created_by'
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
        | 'invoice_number'
        | 'invoice_value'
        | 'invoice_date'
        | 'created_by'
      >
      routing_step_revisions: Table<RoutingStepRevisionRow, 'id' | 'created_at' | 'created_by'>
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
        | 'phase'
        | 'current_stage'
        | 'title'
        | 'pic_id'
        | 'target_date'
        | 'approved_at'
        | 'approved_by'
        | 'topo_data_received_at'
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
        | 'pic_pertamina'
        | 'created_by'
      >
      design_stage_revisions: Table<DesignStageRevisionRow, 'id' | 'created_at' | 'created_by'>
      design_pics: Table<DesignPicRow, 'id' | 'created_at' | 'created_by'>
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
      v_dashboard_kpi: { Row: DashboardKpiView; Relationships: [] }
      v_bottleneck: { Row: BottleneckView; Relationships: [] }
      v_spk_financial: { Row: SpkFinancialView; Relationships: [] }
      v_finance_realisasi_bulanan: { Row: FinanceRealisasiBulananView; Relationships: [] }
      v_finance_akun_summary: { Row: FinanceAkunSummaryView; Relationships: [] }
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
      financial_doc_status: FinancialDocStatus
      finance_category: FinanceCategory
      notification_severity: NotificationSeverity
    }
    CompositeTypes: Record<string, never>
  }
}
