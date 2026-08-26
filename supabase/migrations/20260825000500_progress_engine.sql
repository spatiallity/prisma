-- ============================================================================
-- 0005 — Progress engine and schedule (Section 13-18, 20)
-- ============================================================================

-- ---------------------------------------------------------------------------
-- spk_activities — template instantiated onto one SPK (Section 17)
-- ---------------------------------------------------------------------------
create table spk_activities (
  id               uuid primary key default gen_random_uuid(),
  spk_id           uuid not null references spks(id),
  template_item_id uuid references activity_template_items(id),
  name             text not null,
  weight           numeric(6,3) not null check (weight > 0 and weight <= 100),
  measurement      measurement_type not null,
  unit             text,
  sequence         int not null,
  target_value     numeric(14,2) check (target_value is null or target_value >= 0),
  -- Latest reported figure. Maintained by trigger from activity_progress —
  -- never written by hand (Section 4.3 / 15).
  current_value    numeric(14,2) not null default 0,
  current_stage    stage_status not null default 'Belum Mulai',
  progress_percent numeric(6,2) generated always as (
    case measurement
      when 'percentage' then least(greatest(coalesce(current_value, 0), 0), 100)
      when 'stage'      then stage_to_percent(current_stage)
      else ratio_to_percent(current_value, target_value)
    end
  ) stored,
  notes            text,
  created_at       timestamptz not null default now(),
  updated_at       timestamptz not null default now(),
  unique (spk_id, sequence),
  unique (spk_id, name)
);

comment on table spk_activities is
  'Section 13 — per-SPK activity list with weight and measurement type.';
comment on column spk_activities.progress_percent is
  'Section 14/15 — derived from measurement type. Never entered manually.';

create index spk_activities_spk_idx on spk_activities(spk_id);

create trigger spk_activities_set_updated_at
  before update on spk_activities
  for each row execute function set_updated_at();

-- Per-SPK weights may not exceed 100% either.
create or replace function assert_spk_activity_weight_total()
returns trigger
language plpgsql
as $fn$
declare
  v_spk   uuid;
  v_total numeric;
begin
  -- NEW is unassigned on DELETE, so pick the record explicitly.
  if tg_op = 'DELETE' then
    v_spk := old.spk_id;
  else
    v_spk := new.spk_id;
  end if;

  select coalesce(sum(weight), 0) into v_total
  from spk_activities
  where spk_id = v_spk;

  if v_total > 100 then
    raise exception 'Total bobot aktivitas SPK % = %, melebihi 100', v_spk, v_total;
  end if;

  return null;
end;
$fn$;

create constraint trigger spk_activities_weight_guard
  after insert or update or delete on spk_activities
  deferrable initially deferred
  for each row execute function assert_spk_activity_weight_total();

-- ---------------------------------------------------------------------------
-- activity_progress — progress history (Section 16)
-- ---------------------------------------------------------------------------
create table activity_progress (
  id              uuid primary key default gen_random_uuid(),
  spk_activity_id uuid not null references spk_activities(id),
  progress_date   date not null default current_date,
  -- Cumulative figure as of progress_date for area/quantity, absolute percent
  -- for percentage activities, ignored for stage activities.
  actual_value    numeric(14,2),
  stage           stage_status,
  notes           text,
  -- 'manual' when typed on the Progress tab, 'daily_progress' when derived
  -- from a Daily Progress entry (Section 44 cascade).
  source          text not null default 'manual'
                  check (source in ('manual', 'daily_progress')),
  recorded_by     uuid references users(id),
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now()
);

comment on table activity_progress is
  'Section 16 — one row per progress update, feeding trend / plan-vs-actual / delay detection.';

create index activity_progress_activity_idx on activity_progress(spk_activity_id, progress_date desc);

-- One derived row per activity per day; manual corrections stay separate rows.
create unique index activity_progress_daily_unique
  on activity_progress(spk_activity_id, progress_date)
  where source = 'daily_progress';

create trigger activity_progress_set_updated_at
  before update on activity_progress
  for each row execute function set_updated_at();

-- Roll the latest history row up onto spk_activities.
create or replace function refresh_spk_activity_current()
returns trigger
language plpgsql
security definer
set search_path = public, pg_catalog
as $fn$
declare
  v_activity uuid;
  v_value    numeric;
  v_stage    stage_status;
begin
  if tg_op = 'DELETE' then
    v_activity := old.spk_activity_id;
  else
    v_activity := new.spk_activity_id;
  end if;

  select ap.actual_value, ap.stage
  into v_value, v_stage
  from activity_progress ap
  where ap.spk_activity_id = v_activity
  order by ap.progress_date desc, ap.created_at desc
  limit 1;

  update spk_activities
  set current_value = coalesce(v_value, 0),
      current_stage = coalesce(v_stage, 'Belum Mulai'),
      updated_at    = now()
  where id = v_activity;

  return null;
end;
$fn$;

create trigger activity_progress_refresh_current
  after insert or update or delete on activity_progress
  for each row execute function refresh_spk_activity_current();

-- ---------------------------------------------------------------------------
-- daily_plans (Section 18)
-- ---------------------------------------------------------------------------
create table daily_plans (
  id              uuid primary key default gen_random_uuid(),
  spk_id          uuid not null references spks(id),
  spk_activity_id uuid references spk_activities(id),
  plan_date       date not null,
  vendor_id       uuid references vendors(id),
  team_id         uuid references vendor_teams(id),
  target_value    numeric(14,2) check (target_value is null or target_value >= 0),
  unit            text,
  notes           text,
  status          record_status not null default 'Active',
  created_by      uuid references users(id),
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now()
);

comment on table daily_plans is 'Section 18 — planned work per day, per team, per activity.';

create index daily_plans_spk_idx on daily_plans(spk_id);
create index daily_plans_date_idx on daily_plans(plan_date);
create index daily_plans_team_idx on daily_plans(team_id);

create trigger daily_plans_set_updated_at
  before update on daily_plans
  for each row execute function set_updated_at();

-- ---------------------------------------------------------------------------
-- daily_progress (Section 18, 10)
-- Filled at the mess after fieldwork — no offline/PWA requirement.
-- ---------------------------------------------------------------------------
create table daily_progress (
  id              uuid primary key default gen_random_uuid(),
  daily_plan_id   uuid references daily_plans(id),
  spk_id          uuid not null references spks(id),
  spk_activity_id uuid references spk_activities(id),
  progress_date   date not null,
  vendor_id       uuid references vendors(id),
  team_id         uuid references vendor_teams(id),
  -- Increment achieved on progress_date (not a cumulative figure).
  actual_value    numeric(14,2) not null default 0 check (actual_value >= 0),
  unit            text,
  notes           text,
  update_status   daily_update_status not null default 'Updated Today',
  status          record_status not null default 'Active',
  submitted_by    uuid references users(id),
  submitted_at    timestamptz not null default now(),
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now()
);

comment on table daily_progress is
  'Section 18 — actual realisation per day. actual_value is the daily increment.';

create index daily_progress_spk_idx on daily_progress(spk_id);
create index daily_progress_date_idx on daily_progress(progress_date);
create index daily_progress_team_idx on daily_progress(team_id);
create index daily_progress_activity_idx on daily_progress(spk_activity_id, progress_date);

create trigger daily_progress_set_updated_at
  before update on daily_progress
  for each row execute function set_updated_at();

-- Section 44 — a Daily Progress entry cascades into activity progress.
-- Only area/quantity activities accumulate; percentage and stage activities are
-- updated explicitly on the Progress tab.
create or replace function recompute_activity_cumulative(
  p_activity uuid,
  p_date     date,
  p_actor    uuid
)
returns void
language plpgsql
security definer
set search_path = public, pg_catalog
as $fn$
declare
  v_measure measurement_type;
  v_cum     numeric;
begin
  if p_activity is null or p_date is null then
    return;
  end if;

  select measurement into v_measure
  from spk_activities
  where id = p_activity;

  if v_measure is null or v_measure not in ('area', 'quantity') then
    return;
  end if;

  select coalesce(sum(dp.actual_value), 0) into v_cum
  from daily_progress dp
  where dp.spk_activity_id = p_activity
    and dp.progress_date <= p_date
    and dp.status = 'Active';

  insert into activity_progress (
    spk_activity_id, progress_date, actual_value, source, recorded_by, notes
  )
  values (
    p_activity, p_date, v_cum, 'daily_progress', p_actor, 'Auto dari Daily Progress'
  )
  on conflict (spk_activity_id, progress_date) where source = 'daily_progress'
  do update set actual_value = excluded.actual_value,
                recorded_by  = excluded.recorded_by,
                updated_at   = now();

  -- Later days must be re-accumulated when a back-dated entry changes.
  update activity_progress ap
  set actual_value = (
        select coalesce(sum(dp.actual_value), 0)
        from daily_progress dp
        where dp.spk_activity_id = p_activity
          and dp.progress_date <= ap.progress_date
          and dp.status = 'Active'
      ),
      updated_at = now()
  where ap.spk_activity_id = p_activity
    and ap.source = 'daily_progress'
    and ap.progress_date > p_date;
end;
$fn$;

comment on function recompute_activity_cumulative(uuid, date, uuid) is
  'Rebuilds the derived cumulative activity_progress row for one activity/date.';

create or replace function sync_activity_progress_from_daily()
returns trigger
language plpgsql
security definer
set search_path = public, pg_catalog
as $fn$
begin
  -- The edited row may have moved between activities or dates, so both the
  -- old and the new coordinates are recomputed.
  if tg_op in ('UPDATE', 'DELETE') then
    perform recompute_activity_cumulative(
      old.spk_activity_id, old.progress_date, old.submitted_by
    );
  end if;

  if tg_op in ('INSERT', 'UPDATE') then
    perform recompute_activity_cumulative(
      new.spk_activity_id, new.progress_date, new.submitted_by
    );
  end if;

  return null;
end;
$fn$;

create trigger daily_progress_sync_activity
  after insert or update or delete on daily_progress
  for each row execute function sync_activity_progress_from_daily();
