-- ============================================================================
-- 0016 — Replace SPK-margin spending (0009) with project-wide RAB monitoring
--
-- Margin per SPK never got used, so the cost model it depended on — cash_ledger
-- (kas kecil), personnel_costs, vendor_payments/vendor_payment_terms — is
-- retired here rather than left dead in the schema. It is replaced by the
-- model the source data (project RAB / Chart of Accounts) actually follows:
-- a fixed budget line (`chart_of_accounts`, one row per kode_akun from
-- Monitoring RAB) and every actual expense against it (`finance_transactions`,
-- covering UMK, SPPD, PPBJ Barang, PPBJ Jasa, Gaji PTT Project, MCU). Realisasi
-- is never stored — it is SUM(finance_transactions.jumlah) grouped by
-- kode_akun, the same relationship Monitoring RAB expressed with per-column
-- SUMIF formulas keyed on "bulan & kode_akun".
--
-- `personnel` (master data, 0003) is untouched — Gaji PTT/SPPD/MCU still
-- reference people, just not through personnel_costs any more.
-- ============================================================================

-- ---------------------------------------------------------------------------
-- Drop views that read the old cost tables, deepest dependency first.
-- v_bottleneck is recreated below without its two spending-based conditions.
-- ---------------------------------------------------------------------------
drop view if exists v_bottleneck;
drop view if exists v_project_overhead_monthly;
drop view if exists v_spk_margin;
drop view if exists v_spk_cost;
drop view if exists v_cash_balance;
drop view if exists v_cash_ledger;

-- ---------------------------------------------------------------------------
-- Drop the old cost tables (RLS policies, audit triggers and updated_at
-- triggers all live on the table and are dropped along with it).
-- ---------------------------------------------------------------------------
drop table if exists vendor_payment_terms;
drop table if exists vendor_payments;
drop table if exists personnel_costs;
drop table if exists cash_ledger;
drop table if exists cash_ledger_categories;

drop function if exists refresh_vendor_payment_paid();
drop function if exists set_vendor_payment_status();

drop type if exists vendor_payment_term_type;
drop type if exists vendor_payment_status;
drop type if exists personnel_cost_type;

-- ---------------------------------------------------------------------------
-- chart_of_accounts — one row per kode_akun in Monitoring RAB, group nodes
-- (e.g. '1.2.', '1.2.1') included alongside leaves so anggaran rolls up at
-- every level, matching the source workbook's tree.
-- ---------------------------------------------------------------------------
create table chart_of_accounts (
  kode_akun             text primary key,
  kode_gl               int,
  level                 int,
  kategori_roman        text,
  kategori_roman_label  text,
  uraian                text not null,
  anggaran_rp           numeric(18,2),
  status                record_status not null default 'Active',
  created_at            timestamptz not null default now(),
  updated_at            timestamptz not null default now()
);

comment on table chart_of_accounts is
  'Project RAB / Chart of Accounts imported from Monitoring RAB. anggaran_rp is the budgeted amount for that line; realisasi is never stored here, see v_finance_akun_summary.';

create trigger chart_of_accounts_set_updated_at
  before update on chart_of_accounts
  for each row execute function set_updated_at();

-- ---------------------------------------------------------------------------
-- finance_transactions — every actual expense, one unified table across the
-- six Excel categories. `kategori` is the discriminator column.
-- ---------------------------------------------------------------------------
create type finance_category as enum (
  'umk', 'sppd', 'ppbj_barang', 'ppbj_jasa', 'gaji_ptt', 'mcu'
);

comment on type finance_category is
  'Excel-tab origin of the expense. umk/ppbj_barang/ppbj_jasa carry a freely
   chosen kode_akun; gaji_ptt/sppd/mcu carry a fixed one (1.7.1 or 1.7.3 by
   jenis_detail, 3.1.2, 1.6.1 respectively) set by the app, not the user.';

create table finance_transactions (
  id             uuid primary key default gen_random_uuid(),
  kategori       finance_category not null,
  kode_akun      text not null references chart_of_accounts(kode_akun),
  tanggal        date,
  bulan          date not null,
  jumlah         numeric(18,2) not null check (jumlah > 0),
  deskripsi      text,
  no_bukti       text,
  personnel_id   uuid references personnel(id),
  personil_nama  text,
  jenis_detail   text,
  spk_id         uuid references spks(id),
  meta           jsonb,
  file_id        uuid references files(id),
  status         record_status not null default 'Active',
  created_by     uuid references users(id),
  created_at     timestamptz not null default now(),
  updated_at     timestamptz not null default now()
);

comment on table finance_transactions is
  'Unified expense ledger across UMK, SPPD, PPBJ Barang, PPBJ Jasa, Gaji PTT Project, MCU. spk_id is nullable — this data is project-wide RAB monitoring, not per-SPK cost.';
comment on column finance_transactions.bulan is
  'First-of-month bucket the expense counts against, e.g. 2025-08-01 for Agustus 2025. Mirrors the month column of the Monitoring RAB SUMIF key.';
comment on column finance_transactions.personnel_id is
  'Nullable FK to personnel — not backfilled from the Excel import (names were free text, incl. MCU''s multi-person lists in personil_nama); link case by case.';

create index finance_transactions_kode_akun_idx on finance_transactions(kode_akun);
create index finance_transactions_kategori_idx on finance_transactions(kategori);
create index finance_transactions_bulan_idx on finance_transactions(bulan);
create index finance_transactions_spk_idx on finance_transactions(spk_id);

create trigger finance_transactions_set_updated_at
  before update on finance_transactions
  for each row execute function set_updated_at();

-- ---------------------------------------------------------------------------
-- Audit trail (same generic trigger as every other tracked table, 0010).
-- ---------------------------------------------------------------------------
create trigger chart_of_accounts_audit
  after insert or update or delete on chart_of_accounts
  for each row execute function audit_row_change();

create trigger finance_transactions_audit
  after insert or update or delete on finance_transactions
  for each row execute function audit_row_change();

-- ---------------------------------------------------------------------------
-- RLS — reuses the existing 'spending' permission module (0002/0012), so the
-- Section 6 role matrix in seed.sql needs no change.
-- ---------------------------------------------------------------------------
alter table chart_of_accounts enable row level security;
alter table finance_transactions enable row level security;

create policy chart_of_accounts_select on chart_of_accounts
  for select to authenticated
  using (has_perm('spending', 'view') and current_vendor_id() is null);

create policy chart_of_accounts_insert on chart_of_accounts
  for insert to authenticated
  with check (has_perm('spending', 'edit') and current_vendor_id() is null);

create policy chart_of_accounts_update on chart_of_accounts
  for update to authenticated
  using (has_perm('spending', 'edit') and current_vendor_id() is null)
  with check (has_perm('spending', 'edit') and current_vendor_id() is null);

create policy finance_transactions_select on finance_transactions
  for select to authenticated
  using (has_perm('spending', 'view') and current_vendor_id() is null);

create policy finance_transactions_insert on finance_transactions
  for insert to authenticated
  with check (has_perm('spending', 'edit') and current_vendor_id() is null);

create policy finance_transactions_update on finance_transactions
  for update to authenticated
  using (has_perm('spending', 'edit') and current_vendor_id() is null)
  with check (has_perm('spending', 'edit') and current_vendor_id() is null);

-- ---------------------------------------------------------------------------
-- Derived: Anggaran vs Realisasi — replaces every per-month SUMIF column in
-- Monitoring RAB. Never stored; recomputed on read.
-- ---------------------------------------------------------------------------
create view v_finance_realisasi_bulanan
with (security_invoker = true) as
select
  coa.kode_akun,
  coa.uraian,
  coa.kategori_roman,
  ft.bulan,
  sum(ft.jumlah) as realisasi
from chart_of_accounts coa
join finance_transactions ft
  on ft.kode_akun = coa.kode_akun and ft.status = 'Active'
group by coa.kode_akun, coa.uraian, coa.kategori_roman, ft.bulan;

comment on view v_finance_realisasi_bulanan is
  'Realisasi per kode_akun per bulan — same key Monitoring RAB used for its SUMIF(bulan & kode_akun) columns.';

create view v_finance_akun_summary
with (security_invoker = true) as
select
  coa.kode_akun,
  coa.kode_gl,
  coa.uraian,
  coa.kategori_roman,
  coa.kategori_roman_label,
  coa.level,
  coa.anggaran_rp,
  coalesce(sum(ft.jumlah) filter (where ft.status = 'Active'), 0) as realisasi_total,
  coa.anggaran_rp - coalesce(sum(ft.jumlah) filter (where ft.status = 'Active'), 0)
    as selisih
from chart_of_accounts coa
left join finance_transactions ft on ft.kode_akun = coa.kode_akun
group by coa.kode_akun, coa.uraian, coa.kategori_roman, coa.kategori_roman_label,
         coa.level, coa.anggaran_rp;

comment on view v_finance_akun_summary is
  'Anggaran vs Realisasi vs Selisih per kode_akun, all-time. The RAB monitoring headline number.';

-- ---------------------------------------------------------------------------
-- Recreate v_bottleneck (0011) without the two spending-based conditions
-- ('Vendor payment jatuh tempo' and 'Saldo kas kecil di bawah threshold') —
-- everything else is unchanged from the original definition.
-- ---------------------------------------------------------------------------
create view v_bottleneck
with (security_invoker = true) as
-- Operational
select 'operational' as area, 'SPK belum memiliki jadwal' as reason,
       s.id as spk_id, s.spk_number, 'warning'::notification_severity as severity, null::numeric as metric
from spks s
where s.status = 'On Going'
  and not exists (select 1 from daily_plans p where p.spk_id = s.id and p.status = 'Active')
union all
select 'operational', 'SPK belum memiliki Vendor Jasa Survey',
       s.id, s.spk_number, 'warning', null
from spks s
where s.status = 'On Going'
  and s.vendor_id is null
  and not exists (select 1 from spk_assignments a where a.spk_id = s.id and a.status = 'Active')
union all
select 'operational', 'Vendor Jasa Survey terlambat update',
       s.id, s.spk_number, 'warning',
       current_date - max(dp.progress_date)
from spks s
join daily_progress dp on dp.spk_id = s.id and dp.status = 'Active'
where s.status = 'On Going'
group by s.id, s.spk_number
having current_date - max(dp.progress_date) > setting_number('vendor_update_late_days', 2)
union all
-- Design
select 'design', 'Design menunggu review/revisi terlalu lama',
       d.spk_id, s.spk_number, 'warning',
       round(extract(epoch from (now() - d.updated_at)) / 86400.0, 2)
from designs d
join spks s on s.id = d.spk_id
where d.status = 'Active'
  and d.current_stage in ('Review', 'Revisi', 'Finalisasi')
  and extract(epoch from (now() - d.updated_at)) / 86400.0
      > setting_number('design_stage_max_days', 7)
union all
-- Routing
select 'routing', 'Routing stage melewati lead time',
       lt.spk_id, s.spk_number, 'critical', lt.elapsed_days
from v_routing_lead_time lt
join spks s on s.id = lt.spk_id
where lt.is_overdue
  and lt.status in ('Pending', 'In Progress')
union all
-- Financial
select 'financial', 'Opname belum masuk', s.id, s.spk_number, 'warning', null
from spks s
where s.status in ('On Going', 'Selesai')
  and not exists (select 1 from opnames o where o.spk_id = s.id and o.status <> 'Cancelled')
union all
select 'financial', 'PAD belum dibuat', s.id, s.spk_number, 'warning', null
from spks s
join opnames o on o.spk_id = s.id and o.status <> 'Cancelled'
where not exists (select 1 from pad p where p.spk_id = s.id and p.status <> 'Cancelled')
group by s.id, s.spk_number
union all
select 'financial', 'Invoice belum dibuat', s.id, s.spk_number, 'warning', null
from spks s
join pad p on p.spk_id = s.id and p.status <> 'Cancelled'
where not exists (select 1 from invoices i where i.spk_id = s.id and i.status <> 'Cancelled')
group by s.id, s.spk_number
union all
select 'financial', 'Payment belum diterima', f.spk_id, f.spk_number, 'warning', f.outstanding_payment
from v_spk_financial f
where f.invoice_total > 0 and f.outstanding_payment > 0;

comment on view v_bottleneck is
  'Section 9 — every bottleneck condition in one place, thresholds from app_settings. Spending-based conditions removed with migration 0016.';
