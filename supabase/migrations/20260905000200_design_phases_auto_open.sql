-- ============================================================================
-- 0020 — Design Queue splits into two independent records per SPK, one per
--        phase, instead of one row whose stage silently crosses from Desain
--        Siteplan into Finalisasi Desain. Each phase now opens itself:
--        Desain Siteplan the moment Pengolahan Data Topo hits 100%, and
--        Finalisasi Desain the moment Desain Siteplan reaches Finish. A row
--        with no design_revisions yet is a Draft — visible in the queue,
--        waiting for someone to mark it started (see startDesign action).
-- ============================================================================

create type design_phase as enum ('siteplan', 'finalisasi');

alter table designs add column phase design_phase not null default 'siteplan';

comment on column designs.phase is
  'Which of the two design-team phases this record tracks. A design never
   crosses phases itself -- reaching Finish auto-opens a separate finalisasi
   record instead.';

-- ---------------------------------------------------------------------------
-- Split any design whose history already crossed into Finalisasi Desain
-- stages under the old one-record model onto its own new record, so the
-- historical shape matches what the auto-open trigger would have produced
-- from the start.
-- ---------------------------------------------------------------------------
with to_split as (
  select distinct d.id as old_id, d.spk_id, d.pic_id, d.created_by, d.approved_at, d.approved_by
  from designs d
  join design_revisions dr on dr.design_id = d.id and dr.status = 'Active'
  where dr.stage in ('Pembuatan', 'Review internal', 'Sinkronisasi', 'Submit Peta')
),
inserted as (
  insert into designs (spk_id, phase, current_stage, pic_id, created_by, approved_at, approved_by)
  select spk_id, 'finalisasi', 'Pembuatan', pic_id, created_by, approved_at, approved_by
  from to_split
  returning id, spk_id
)
update design_revisions dr
set design_id = inserted.id
from to_split
join inserted on inserted.spk_id = to_split.spk_id
where dr.design_id = to_split.old_id
  and dr.stage in ('Pembuatan', 'Review internal', 'Sinkronisasi', 'Submit Peta');

-- Approval belongs to whichever record actually reached Submit Peta -- the
-- new finalisasi record already copied it above, so clear the stale copy
-- left on the old (now siteplan-only) record.
update designs d
set approved_at = null, approved_by = null
where d.phase = 'siteplan'
  and d.approved_at is not null
  and not exists (
    select 1 from design_revisions dr
    where dr.design_id = d.id and dr.stage = 'Submit Peta'
  );

-- Recompute current_stage on every design from its (now phase-consistent)
-- revision history -- the same rule refresh_design_current_stage applies.
update designs d
set current_stage = coalesce(
  (
    select dr.stage from design_revisions dr
    where dr.design_id = d.id and dr.status = 'Active'
    order by dr.revision_no desc, dr.created_at desc
    limit 1
  ),
  case d.phase
    when 'siteplan' then 'Pembuatan Desain Awal'::design_stage
    else 'Pembuatan'::design_stage
  end
);

-- At most one active record per SPK per phase -- the same invariant the
-- auto-open triggers below rely on to stay idempotent.
create unique index designs_spk_phase_active_idx
  on designs (spk_id, phase)
  where status = 'Active';

-- ---------------------------------------------------------------------------
-- refresh_design_current_stage's fallback only made sense when every design
-- started at the same stage. A finalisasi record with no revisions yet
-- (freshly auto-opened) needs its own phase's first stage instead.
-- ---------------------------------------------------------------------------
create or replace function refresh_design_current_stage()
returns trigger
language plpgsql
security definer
set search_path = public, pg_catalog
as $fn$
declare
  v_design uuid;
  v_phase  design_phase;
  v_stage  design_stage;
begin
  if tg_op = 'DELETE' then
    v_design := old.design_id;
  else
    v_design := new.design_id;
  end if;

  select d.phase into v_phase from designs d where d.id = v_design;

  select dr.stage into v_stage
  from design_revisions dr
  where dr.design_id = v_design
    and dr.status = 'Active'
  order by dr.revision_no desc, dr.created_at desc
  limit 1;

  update designs
  set current_stage = coalesce(
        v_stage,
        case v_phase
          when 'siteplan' then 'Pembuatan Desain Awal'::design_stage
          else 'Pembuatan'::design_stage
        end
      ),
      updated_at = now()
  where id = v_design;

  return null;
end;
$fn$;

-- ---------------------------------------------------------------------------
-- Auto-open Desain Siteplan the moment field work's data-processing stage
-- (Pengolahan Data Topo) reaches 100% -- no manual "Buka record desain"
-- needed on the common path. Guarded to SPKs whose activity template
-- actually carries a design phase (TPL-A); TPL-B/TPL-C never match because
-- they have no 'Pembuatan Desain Awal' item to check against.
-- ---------------------------------------------------------------------------
create or replace function auto_open_design_siteplan()
returns trigger
language plpgsql
security definer
set search_path = public, pg_catalog
as $fn$
begin
  if new.name = 'Pengolahan Data Topo'
     and new.measurement = 'percentage'
     and new.progress_percent >= 100 then
    insert into designs (spk_id, phase, current_stage)
    select new.spk_id, 'siteplan', 'Pembuatan Desain Awal'
    where exists (
      select 1 from spk_activities sa
      where sa.spk_id = new.spk_id and sa.name = 'Pembuatan Desain Awal'
    )
    on conflict (spk_id, phase) where status = 'Active' do nothing;
  end if;
  return new;
end;
$fn$;

create trigger spk_activities_auto_open_design
  after update of current_value on spk_activities
  for each row execute function auto_open_design_siteplan();

-- One-time backfill: SPKs whose Pengolahan Data Topo is already at 100% but
-- predate this trigger get their Draft Desain Siteplan record now too.
insert into designs (spk_id, phase, current_stage)
select sa.spk_id, 'siteplan', 'Pembuatan Desain Awal'
from spk_activities sa
where sa.name = 'Pengolahan Data Topo'
  and sa.measurement = 'percentage'
  and sa.progress_percent >= 100
  and exists (
    select 1 from spk_activities sa2
    where sa2.spk_id = sa.spk_id and sa2.name = 'Pembuatan Desain Awal'
  )
on conflict (spk_id, phase) where status = 'Active' do nothing;

-- ---------------------------------------------------------------------------
-- Auto-open Finalisasi Desain the moment Desain Siteplan reaches Finish.
-- ---------------------------------------------------------------------------
create or replace function auto_open_design_finalisasi()
returns trigger
language plpgsql
security definer
set search_path = public, pg_catalog
as $fn$
begin
  if new.phase = 'siteplan' and new.current_stage = 'Finish' then
    insert into designs (spk_id, phase, current_stage, pic_id)
    select new.spk_id, 'finalisasi', 'Pembuatan', new.pic_id
    on conflict (spk_id, phase) where status = 'Active' do nothing;
  end if;
  return new;
end;
$fn$;

create trigger designs_auto_open_finalisasi
  after update of current_stage on designs
  for each row execute function auto_open_design_finalisasi();
