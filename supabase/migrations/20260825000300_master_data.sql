-- ============================================================================
-- 0003 — Master data (Section 7 "Administration", 17, 19, 25.6)
-- ============================================================================

-- ---------------------------------------------------------------------------
-- vendors — Vendor Jasa Survey (Section 19)
-- ---------------------------------------------------------------------------
create table vendors (
  id             uuid primary key default gen_random_uuid(),
  code           text not null unique,
  name           text not null,
  contact_person text,
  phone          text,
  email          text,
  address        text,
  notes          text,
  status         record_status not null default 'Active',
  created_by     uuid references users(id),
  created_at     timestamptz not null default now(),
  updated_at     timestamptz not null default now()
);

comment on table vendors is 'Section 19 — Vendor Jasa Survey master (e.g. KJSB Syahrial).';

create trigger vendors_set_updated_at
  before update on vendors
  for each row execute function set_updated_at();

-- Vendor users are scoped to their own vendor (Section 5.7 / 31).
alter table users
  add column vendor_id uuid references vendors(id);

comment on column users.vendor_id is
  'Set for Vendor Jasa Survey accounts. NULL for internal roles.';

create index users_vendor_idx on users(vendor_id);

create or replace function current_vendor_id()
returns uuid
language sql
stable
security definer
set search_path = public, pg_catalog
as $fn$
  select u.vendor_id
  from users u
  where u.id = auth.uid()
    and u.status = 'Active';
$fn$;

comment on function current_vendor_id() is
  'Vendor of the authenticated user, NULL for internal roles.';

grant execute on function current_vendor_id() to authenticated;

-- ---------------------------------------------------------------------------
-- vendor_teams / vendor_members (Section 19)
-- ---------------------------------------------------------------------------
create table vendor_teams (
  id         uuid primary key default gen_random_uuid(),
  vendor_id  uuid not null references vendors(id),
  name       text not null,
  notes      text,
  status     record_status not null default 'Active',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (vendor_id, name)
);

comment on table vendor_teams is
  'One vendor may run several teams (Team A / B / C), each assignable to a different SPK.';

create index vendor_teams_vendor_idx on vendor_teams(vendor_id);

create trigger vendor_teams_set_updated_at
  before update on vendor_teams
  for each row execute function set_updated_at();

create table vendor_members (
  id         uuid primary key default gen_random_uuid(),
  team_id    uuid not null references vendor_teams(id),
  full_name  text not null,
  position   text,
  phone      text,
  user_id    uuid references users(id),
  status     record_status not null default 'Active',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

comment on column vendor_members.user_id is
  'Optional link to a login account when the member fills Daily Progress themselves.';

create index vendor_members_team_idx on vendor_members(team_id);

create trigger vendor_members_set_updated_at
  before update on vendor_members
  for each row execute function set_updated_at();

-- ---------------------------------------------------------------------------
-- personnel — internal project team master (Section 25.6.2)
-- ---------------------------------------------------------------------------
create table personnel (
  id          uuid primary key default gen_random_uuid(),
  code        text unique,
  full_name   text not null,
  position    text,
  user_id     uuid references users(id),
  join_date   date,
  status      record_status not null default 'Active',
  notes       text,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

comment on table personnel is 'Section 25.6.2 — internal personnel carrying salary/MCU/honor cost.';

create trigger personnel_set_updated_at
  before update on personnel
  for each row execute function set_updated_at();

-- ---------------------------------------------------------------------------
-- cash_ledger_categories (Section 28, 42)
-- ---------------------------------------------------------------------------
create table cash_ledger_categories (
  id          uuid primary key default gen_random_uuid(),
  code        text not null unique,
  name        text not null,
  description text,
  sort_order  int not null default 0,
  status      record_status not null default 'Active',
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

comment on table cash_ledger_categories is
  'Section 42 — free-text Excel needs ("BBM TERIOS", "BBM MOTOR") map onto these fixed categories.';

create trigger cash_ledger_categories_set_updated_at
  before update on cash_ledger_categories
  for each row execute function set_updated_at();

-- ---------------------------------------------------------------------------
-- activity_templates — the "Progress Template" of Section 17
-- ---------------------------------------------------------------------------
create table activity_templates (
  id          uuid primary key default gen_random_uuid(),
  code        text not null unique,
  name        text not null,
  description text,
  status      record_status not null default 'Active',
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

comment on table activity_templates is
  'Section 17 — Template A (SPK dengan Siteplan), Template B (tanpa Siteplan), extensible.';

create trigger activity_templates_set_updated_at
  before update on activity_templates
  for each row execute function set_updated_at();

create table activity_template_items (
  id                   uuid primary key default gen_random_uuid(),
  template_id          uuid not null references activity_templates(id),
  name                 text not null,
  weight               numeric(6,3) not null check (weight > 0 and weight <= 100),
  measurement          measurement_type not null,
  unit                 text,
  sequence             int not null,
  -- When true the target is copied from the SPK itself (Section 4.2 — e.g. luas
  -- 12,06 Ha becomes the terrestrial measurement target automatically).
  target_from_spk_area boolean not null default false,
  default_target       numeric(14,2),
  notes                text,
  created_at           timestamptz not null default now(),
  updated_at           timestamptz not null default now(),
  unique (template_id, sequence),
  unique (template_id, name)
);

comment on table activity_template_items is
  'Section 13 — activity, weight and measurement type per template. Weights must total 100.';

create index activity_template_items_template_idx on activity_template_items(template_id);

create trigger activity_template_items_set_updated_at
  before update on activity_template_items
  for each row execute function set_updated_at();

-- Weights of a template may never exceed 100% (Section 13).
create or replace function assert_template_weight_total()
returns trigger
language plpgsql
as $fn$
declare
  v_template uuid;
  v_total    numeric;
begin
  -- NEW is unassigned on DELETE, so pick the record explicitly.
  if tg_op = 'DELETE' then
    v_template := old.template_id;
  else
    v_template := new.template_id;
  end if;

  select coalesce(sum(weight), 0) into v_total
  from activity_template_items
  where template_id = v_template;

  if v_total > 100 then
    raise exception 'Total bobot template % = %, melebihi 100', v_template, v_total;
  end if;

  return null;
end;
$fn$;

create constraint trigger activity_template_items_weight_guard
  after insert or update or delete on activity_template_items
  deferrable initially deferred
  for each row execute function assert_template_weight_total();

-- ---------------------------------------------------------------------------
-- routing_templates / routing_template_steps (Section 23)
-- ---------------------------------------------------------------------------
create table routing_templates (
  id          uuid primary key default gen_random_uuid(),
  code        text not null unique,
  name        text not null,
  description text,
  status      record_status not null default 'Active',
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

comment on table routing_templates is
  'Section 23 — e.g. the Pertamina routing chain Document Control -> ... -> Finance.';

create trigger routing_templates_set_updated_at
  before update on routing_templates
  for each row execute function set_updated_at();

create table routing_template_steps (
  id                uuid primary key default gen_random_uuid(),
  template_id       uuid not null references routing_templates(id),
  name              text not null,
  sequence          int not null,
  default_pic_role  text,
  -- Section 24 — lead time above this many days is flagged as bottleneck.
  sla_days          numeric(6,2),
  requires_approval boolean not null default true,
  notes             text,
  created_at        timestamptz not null default now(),
  updated_at        timestamptz not null default now(),
  unique (template_id, sequence)
);

create index routing_template_steps_template_idx on routing_template_steps(template_id);

create trigger routing_template_steps_set_updated_at
  before update on routing_template_steps
  for each row execute function set_updated_at();
