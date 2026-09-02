-- ============================================================================
-- Vendor accounts may record progress on their own assigned SPK, but only
-- up to the point "Desain Siteplan" starts — after that the design team
-- takes over and the vendor's edit window on that SPK closes. Internal
-- roles (current_vendor_id() is null) are never affected by this gate.
-- ============================================================================

create or replace function spk_design_started(p_spk_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public, pg_catalog
as $fn$
  select exists (
    select 1 from spk_activities
    where spk_id = p_spk_id
      and name = 'Desain Siteplan'
      and current_stage <> 'Belum Mulai'
  );
$fn$;

comment on function spk_design_started(uuid) is
  'True once the "Desain Siteplan" activity has left Belum Mulai. Gates
   vendor progress-edit access — irrelevant to internal roles.';

grant execute on function spk_design_started(uuid) to authenticated;

create or replace function spk_progress_editable(p_spk_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public, pg_catalog
as $fn$
  select spk_editable(p_spk_id, 'progress')
    and (current_vendor_id() is null or not spk_design_started(p_spk_id));
$fn$;

comment on function spk_progress_editable(uuid) is
  'spk_editable(progress) plus the vendor design-stage cutoff — internal
   roles are unaffected since current_vendor_id() is null for them.';

grant execute on function spk_progress_editable(uuid) to authenticated;

drop policy spk_activities_insert on spk_activities;
create policy spk_activities_insert on spk_activities
  for insert to authenticated
  with check (spk_progress_editable(spk_id));

drop policy spk_activities_update on spk_activities;
create policy spk_activities_update on spk_activities
  for update to authenticated
  using (spk_progress_editable(spk_id))
  with check (spk_progress_editable(spk_id));

drop policy activity_progress_insert on activity_progress;
create policy activity_progress_insert on activity_progress
  for insert to authenticated
  with check (
    exists (
      select 1 from spk_activities a
      where a.id = spk_activity_id and spk_progress_editable(a.spk_id)
    )
  );

drop policy activity_progress_update on activity_progress;
create policy activity_progress_update on activity_progress
  for update to authenticated
  using (
    exists (
      select 1 from spk_activities a
      where a.id = spk_activity_id and spk_progress_editable(a.spk_id)
    )
  )
  with check (
    exists (
      select 1 from spk_activities a
      where a.id = spk_activity_id and spk_progress_editable(a.spk_id)
    )
  );
