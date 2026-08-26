-- ============================================================================
-- 0001 — Extensions, shared enums, and helper functions
-- Web Monitoring SPK · PT SUCOFINDO — Requirement V1.1
-- ============================================================================

create extension if not exists "pgcrypto";

-- ---------------------------------------------------------------------------
-- Shared enums
-- ---------------------------------------------------------------------------

-- Lifecycle status used by master/reference rows (Section 4.4 — no hard delete)
create type record_status as enum ('Active', 'Inactive', 'Archived');

-- SPK lifecycle (Section 7 menu: On Going / Selesai)
create type spk_status as enum (
  'Draft',
  'On Going',
  'Selesai',
  'Archived',
  'Cancelled'
);

-- Section 14 — jenis pengukuran progress
create type measurement_type as enum ('percentage', 'area', 'quantity', 'stage');

-- Section 14.4 — stage measurement only allows these three states
create type stage_status as enum ('Belum Mulai', 'Dalam Pengerjaan', 'Selesai');

-- Section 21 — design workflow
create type design_stage as enum (
  'Desain Awal',
  'Review',
  'Pemaparan',
  'Revisi',
  'Finalisasi',
  'Approved'
);

-- Section 23 — routing step status
create type routing_status as enum (
  'Pending',
  'In Progress',
  'Completed',
  'Returned',
  'Rejected'
);

-- Section 25 — revenue-side document status
create type financial_doc_status as enum (
  'Draft',
  'Submitted',
  'Approved',
  'Rejected',
  'Cancelled'
);

-- Section 25.6.2
create type personnel_cost_type as enum ('Gaji', 'MCU', 'Honor & Operasional');

-- Section 25.6.3
create type vendor_payment_status as enum ('Belum Dibayar', 'Sebagian', 'Lunas');
create type vendor_payment_term_type as enum ('DP', 'Progress', 'Final');

-- Section 10 — Today's Schedule status
create type daily_update_status as enum (
  'Updated Today',
  'Belum Update',
  'Terlambat Update',
  'Completed'
);

-- Section 33
create type audit_action as enum ('INSERT', 'UPDATE', 'DELETE');

-- ---------------------------------------------------------------------------
-- updated_at maintenance
-- ---------------------------------------------------------------------------

create or replace function set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

comment on function set_updated_at() is
  'Generic BEFORE UPDATE trigger keeping updated_at in sync.';

-- ---------------------------------------------------------------------------
-- Progress math (Section 14 / 15)
-- ---------------------------------------------------------------------------

-- Section 14.4: stage measurement has no free percentage input.
-- "Selesai" grants the activity its full weight. The intermediate value is
-- centralised here so it can be changed in one place.
create or replace function stage_to_percent(p_stage stage_status)
returns numeric
language sql
immutable
as $$
  select case p_stage
    when 'Selesai'         then 100::numeric
    when 'Dalam Pengerjaan' then 50::numeric
    else 0::numeric
  end;
$$;

comment on function stage_to_percent(stage_status) is
  'Section 14.4 — maps stage status to percentage. Selesai = 100%.';

-- Section 14.2 / 14.3: actual vs target, capped at 100%.
create or replace function ratio_to_percent(p_actual numeric, p_target numeric)
returns numeric
language sql
immutable
as $$
  select case
    when p_target is null or p_target = 0 then 0::numeric
    else least(round(coalesce(p_actual, 0) / p_target * 100, 2), 100::numeric)
  end;
$$;

comment on function ratio_to_percent(numeric, numeric) is
  'Section 14.2/14.3 — actual/target progress in percent, capped at 100.';
