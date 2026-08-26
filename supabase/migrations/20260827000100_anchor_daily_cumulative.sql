-- ============================================================================
-- 0015 — Anchor the Daily Progress cumulative to the last manual entry
--
-- Section 16 lets progress be typed on the Progress tab; Section 18/44 lets it
-- arrive as daily increments. Both write to the same activity, and the
-- original recompute_activity_cumulative() summed ONLY daily_progress. So an
-- activity carrying 6,03 Ha of manually recorded progress dropped to 1,4 Ha
-- the moment the first Daily Progress row landed: the derived row was newer,
-- so refresh_spk_activity_current() adopted it and the manual figure vanished.
--
-- That is exactly the Section 42 migration path — Excel history enters as
-- manual entries, then the field switches to Daily Progress — so it would have
-- discarded every pre-system figure on the first day of real use.
--
-- The cumulative is now: the most recent manual reading at or before the date,
-- plus every daily increment recorded strictly after that reading. A manual
-- entry therefore states the cumulative as of its own date and supersedes any
-- daily rows sharing it, which is what "correcting the number by hand" means.
-- ============================================================================

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
  v_measure    measurement_type;
  v_base_value numeric;
  v_base_date  date;
  v_cum        numeric;
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

  -- The manual reading that anchors everything after it.
  select ap.actual_value, ap.progress_date
  into v_base_value, v_base_date
  from activity_progress ap
  where ap.spk_activity_id = p_activity
    and ap.source = 'manual'
    and ap.progress_date <= p_date
  order by ap.progress_date desc, ap.created_at desc
  limit 1;

  select coalesce(v_base_value, 0) + coalesce(sum(dp.actual_value), 0)
  into v_cum
  from daily_progress dp
  where dp.spk_activity_id = p_activity
    and dp.progress_date <= p_date
    and dp.status = 'Active'
    and (v_base_date is null or dp.progress_date > v_base_date);

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

  -- Later derived rows re-accumulate against their own anchor, which may be a
  -- different manual entry than the one used above.
  update activity_progress ap
  set actual_value = (
        select coalesce(
                 (select b.actual_value
                  from activity_progress b
                  where b.spk_activity_id = p_activity
                    and b.source = 'manual'
                    and b.progress_date <= ap.progress_date
                  order by b.progress_date desc, b.created_at desc
                  limit 1),
                 0
               )
             + coalesce((
                 select sum(dp.actual_value)
                 from daily_progress dp
                 where dp.spk_activity_id = p_activity
                   and dp.progress_date <= ap.progress_date
                   and dp.status = 'Active'
                   and dp.progress_date > coalesce(
                         (select b2.progress_date
                          from activity_progress b2
                          where b2.spk_activity_id = p_activity
                            and b2.source = 'manual'
                            and b2.progress_date <= ap.progress_date
                          order by b2.progress_date desc, b2.created_at desc
                          limit 1),
                         '-infinity'::date)
               ), 0)
      ),
      updated_at = now()
  where ap.spk_activity_id = p_activity
    and ap.source = 'daily_progress'
    and ap.progress_date > p_date;
end;
$fn$;

comment on function recompute_activity_cumulative(uuid, date, uuid) is
  'Rebuilds the derived cumulative activity_progress row, anchored to the most recent manual reading (Section 16 + 18).';

revoke all on function recompute_activity_cumulative(uuid, date, uuid)
  from public, anon, authenticated;

-- ---------------------------------------------------------------------------
-- Repair rows written by the previous version.
-- ---------------------------------------------------------------------------
do $do$
declare
  r record;
begin
  for r in
    select distinct spk_activity_id, progress_date
    from activity_progress
    where source = 'daily_progress'
    order by spk_activity_id, progress_date
  loop
    perform recompute_activity_cumulative(r.spk_activity_id, r.progress_date, null);
  end loop;
end;
$do$;
