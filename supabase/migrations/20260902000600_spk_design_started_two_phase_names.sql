-- ============================================================================
-- spk_design_started() only ever checked one activity row named "Desain
-- Siteplan". After the two-phase restructure (see
-- 20260902000500_tpl_a_two_phase_design_activities.sql) new SPKs no longer
-- get that row — they get 4 granular sub-activities instead — so the vendor
-- progress-edit cutoff would never fire for any SPK created after this
-- point. Widened to also match the 4 new sub-activity names; the old name is
-- kept for SPKs created before the restructure, which still carry it.
-- ============================================================================

create or replace function public.spk_design_started(p_spk_id uuid)
returns boolean
language sql
stable security definer
set search_path to 'public', 'pg_catalog'
as $function$
  select exists (
    select 1 from spk_activities
    where spk_id = p_spk_id
      and name in (
        'Desain Siteplan',
        'Pembuatan Desain Awal',
        'Review Desain Awal',
        'Revisi Desain Awal',
        'Pembuatan Peta Inventaris dan Stake Out'
      )
      and current_stage <> 'Belum Mulai'
  );
$function$;
