-- ============================================================================
-- spk_activities holds both "structural" facts an SPK manager sets up
-- (weight, target_value, measurement — e.g. how many patok a Stake Out job
-- has) and "progress" facts a vendor records day to day. Gating writes on
-- progress:edit alone meant a role with spk:edit but not progress:edit
-- (e.g. Administration) could open the SPK edit form, submit a target, and
-- have it silently refused by RLS. Structural edits now also pass via plain
-- spk_editable(spk_id, 'spk') — unaffected by the vendor design cutoff,
-- since only internal roles ever hold spk:edit.
-- ============================================================================

drop policy spk_activities_insert on spk_activities;
create policy spk_activities_insert on spk_activities
  for insert to authenticated
  with check (spk_progress_editable(spk_id) or spk_editable(spk_id, 'spk'));

drop policy spk_activities_update on spk_activities;
create policy spk_activities_update on spk_activities
  for update to authenticated
  using (spk_progress_editable(spk_id) or spk_editable(spk_id, 'spk'))
  with check (spk_progress_editable(spk_id) or spk_editable(spk_id, 'spk'));
