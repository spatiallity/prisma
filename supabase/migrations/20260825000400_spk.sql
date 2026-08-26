-- ============================================================================
-- 0004 — SPK, the central object (Section 4.1, 11, 12)
-- ============================================================================

create table spks (
  id                  uuid primary key default gen_random_uuid(),
  spk_number          text not null unique,
  -- Short site/location code shown in the Detail SPK header, e.g. BNG-A03.
  site_code           text,
  work_name           text not null,
  work_type           text,
  location            text,
  kabupaten           text,
  provinsi            text,
  area_ha             numeric(14,2) check (area_ha is null or area_ha >= 0),
  contract_value      numeric(18,2) check (contract_value is null or contract_value >= 0),
  start_date          date,
  end_date            date,
  vendor_id           uuid references vendors(id),
  project_manager_id  uuid references users(id),
  activity_template_id uuid references activity_templates(id),
  routing_template_id uuid references routing_templates(id),
  status              spk_status not null default 'Draft',
  notes               text,
  created_by          uuid references users(id),
  updated_by          uuid references users(id),
  created_at          timestamptz not null default now(),
  updated_at          timestamptz not null default now(),
  constraint spks_date_order check (
    start_date is null or end_date is null or end_date >= start_date
  )
);

comment on table spks is
  'Section 11 — every operational, administrative and financial record traces back here.';
comment on column spks.area_ha is
  'Section 4.2 — reused as the default target for area-measured activities.';
comment on column spks.status is
  'Section 4.4 — SPK is never hard deleted; use Archived / Cancelled instead.';

create index spks_status_idx on spks(status);
create index spks_vendor_idx on spks(vendor_id);
create index spks_pm_idx on spks(project_manager_id);
create index spks_dates_idx on spks(start_date, end_date);

create trigger spks_set_updated_at
  before update on spks
  for each row execute function set_updated_at();

-- ---------------------------------------------------------------------------
-- spk_assignments — which vendor team works which SPK (Section 19)
-- ---------------------------------------------------------------------------
create table spk_assignments (
  id           uuid primary key default gen_random_uuid(),
  spk_id       uuid not null references spks(id),
  vendor_id    uuid not null references vendors(id),
  team_id      uuid references vendor_teams(id),
  assigned_from date,
  assigned_to   date,
  status       record_status not null default 'Active',
  notes        text,
  created_by   uuid references users(id),
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now(),
  constraint spk_assignments_date_order check (
    assigned_from is null or assigned_to is null or assigned_to >= assigned_from
  )
);

comment on table spk_assignments is
  'Section 19 — a vendor team is assigned to an SPK for a period. Drives vendor RLS scope.';

create unique index spk_assignments_unique_active
  on spk_assignments(spk_id, vendor_id, (coalesce(team_id, '00000000-0000-0000-0000-000000000000'::uuid)))
  where status = 'Active';

create index spk_assignments_spk_idx on spk_assignments(spk_id);
create index spk_assignments_vendor_idx on spk_assignments(vendor_id);
create index spk_assignments_team_idx on spk_assignments(team_id);

create trigger spk_assignments_set_updated_at
  before update on spk_assignments
  for each row execute function set_updated_at();

-- ---------------------------------------------------------------------------
-- SPK visibility helper (Section 31)
--
-- Internal roles see every SPK they hold the 'spk view' permission for.
-- Vendor accounts see only the SPK assigned to their vendor.
-- ---------------------------------------------------------------------------
create or replace function spk_visible(p_spk_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public, pg_catalog
as $fn$
  select case
    when not has_perm('spk', 'view') then false
    when current_vendor_id() is null then true
    else exists (
      select 1
      from spk_assignments a
      where a.spk_id = p_spk_id
        and a.vendor_id = current_vendor_id()
        and a.status = 'Active'
    )
    or exists (
      select 1
      from spks s
      where s.id = p_spk_id
        and s.vendor_id = current_vendor_id()
    )
  end;
$fn$;

comment on function spk_visible(uuid) is
  'Section 31 — row-level SPK visibility. Vendors are limited to assigned SPK.';

grant execute on function spk_visible(uuid) to authenticated;

-- ---------------------------------------------------------------------------
-- SPK edit helper — used by every child table that a vendor may write to.
-- ---------------------------------------------------------------------------
create or replace function spk_editable(p_spk_id uuid, p_module app_module)
returns boolean
language sql
stable
security definer
set search_path = public, pg_catalog
as $fn$
  select has_perm(p_module, 'edit') and spk_visible(p_spk_id);
$fn$;

grant execute on function spk_editable(uuid, app_module) to authenticated;
