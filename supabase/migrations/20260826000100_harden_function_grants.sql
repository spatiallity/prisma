-- ============================================================================
-- 0014 — Function hardening (Supabase security advisor 0011 / 0028 / 0029)
--
-- Two separate problems, both raised by the linter after 0013 was applied:
--
-- 1. Every function in `public` is exposed as a PostgREST RPC endpoint and
--    carries the implicit EXECUTE grant to PUBLIC. For SECURITY DEFINER
--    functions that means an unauthenticated caller runs them as the owner.
--    recompute_activity_cumulative() is the one that actually writes — it
--    could insert/update activity_progress rows straight past RLS. It is only
--    ever meant to be called from the daily_progress trigger, so no client
--    role needs EXECUTE at all.
--
--    The authorization helpers (has_perm, spk_visible, …) must KEEP their
--    grant to `authenticated`: RLS policy expressions are evaluated as the
--    querying role, so revoking EXECUTE there would break every policy.
--    Only `anon` and PUBLIC lose access.
--
--    Trigger functions lose EXECUTE entirely — PostgreSQL checks that
--    privilege when CREATE TRIGGER runs, not on each firing.
--
-- 2. Functions without a pinned search_path resolve unqualified names through
--    whatever the caller's search_path happens to be.
-- ============================================================================

-- --- 1a. Trigger-only functions: no client role may call these -------------
do $do$
declare
  fn text;
  trigger_fns text[] := array[
    'set_updated_at()',
    'audit_row_change()',
    'assert_template_weight_total()',
    'assert_spk_activity_weight_total()',
    'set_vendor_payment_status()',
    'refresh_spk_activity_current()',
    'refresh_design_current_stage()',
    'refresh_routing_status()',
    'refresh_vendor_payment_paid()',
    'sync_activity_progress_from_daily()',
    'recompute_activity_cumulative(uuid, date, uuid)'
  ];
begin
  foreach fn in array trigger_fns loop
    execute format('revoke all on function %s from public, anon, authenticated', fn);
  end loop;
end;
$do$;

-- --- 1b. Authorization helpers: keep `authenticated`, drop the rest --------
do $do$
declare
  fn text;
  helper_fns text[] := array[
    'current_role_code()',
    'current_vendor_id()',
    'has_perm(app_module, app_action)',
    'has_perm_all(app_module, app_action)',
    'perm_scope(app_module, app_action)',
    'spk_visible(uuid)',
    'spk_editable(uuid, app_module)',
    'file_module_visible(file_module)',
    'setting_number(text, numeric)',
    'stage_to_percent(stage_status)',
    'ratio_to_percent(numeric, numeric)'
  ];
begin
  foreach fn in array helper_fns loop
    execute format('revoke all on function %s from public, anon', fn);
    execute format('grant execute on function %s to authenticated', fn);
  end loop;
end;
$do$;

-- --- 2. Pin search_path on the functions the linter flagged ----------------
alter function set_updated_at()                     set search_path = public, pg_catalog;
alter function stage_to_percent(stage_status)       set search_path = public, pg_catalog;
alter function ratio_to_percent(numeric, numeric)   set search_path = public, pg_catalog;
alter function assert_template_weight_total()       set search_path = public, pg_catalog;
alter function assert_spk_activity_weight_total()   set search_path = public, pg_catalog;
alter function set_vendor_payment_status()          set search_path = public, pg_catalog;
