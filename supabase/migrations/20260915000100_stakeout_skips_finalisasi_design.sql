-- ============================================================================
-- 0025 — Stake out work stops before Finalisasi Desain
-- ============================================================================

-- Stake out deliverables do not need the separate Finalisasi Desain phase.
-- Keep historical siteplan/design records intact, but hide any active
-- finalisasi rows that were opened by the old trigger.
update designs d
set status = 'Archived'::record_status,
    updated_at = now()
from spks s
where d.spk_id = s.id
  and d.phase = 'finalisasi'::design_phase
  and d.status = 'Active'::record_status
  and (
    s.work_type ilike '%stake%'
    or s.work_name ilike '%stake out%'
    or s.work_name ilike '%stakeout%'
  );

-- Auto-open Finalisasi Desain only for non-stake-out work.
create or replace function auto_open_design_finalisasi()
returns trigger
language plpgsql
security definer
set search_path = public, pg_catalog
as $fn$
begin
  if new.phase = 'siteplan'
     and new.current_stage = 'Finish'
     and not exists (
       select 1
       from spks s
       where s.id = new.spk_id
         and (
           s.work_type ilike '%stake%'
           or s.work_name ilike '%stake out%'
           or s.work_name ilike '%stakeout%'
         )
     ) then
    insert into designs (spk_id, phase, current_stage)
    select new.spk_id, 'finalisasi', 'Pembuatan Finalisasi Desain'
    on conflict (spk_id, phase) where status = 'Active' do nothing;
  end if;
  return new;
end;
$fn$;
