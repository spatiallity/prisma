-- ============================================================================
-- 0017 — Hard delete, everywhere an "Add" exists
--
-- Migration 0012 deliberately revoked DELETE and shipped no DELETE policy
-- anywhere (Section 4.4: corrections go through status, not removal). The
-- project has since decided every addable record needs a real delete action
-- too — explicit direction, overriding that original decision.
--
-- Two things had to change to make that safe:
--
-- 1. audit_row_change() could never log a DELETE on `spks` itself: the AFTER
--    trigger tried to insert an audit_logs row whose spk_id pointed at the
--    row that had just been removed, and audit_logs.spk_id → spks is a FK,
--    so the insert failed every time. Fixed by only setting spk_id on
--    spks INSERT/UPDATE, not DELETE (record_id already names which spk
--    row it was).
--
-- 2. spk_id foreign keys were all NO ACTION, so deleting one SPK meant
--    manually deleting ~15 dependent tables in FK order first. Composition
--    children (activities, progress, schedule, design, routing, revenue
--    docs — nothing that makes sense to keep once the SPK is gone) now
--    CASCADE. Cross-cutting/historical tables (audit_logs, notifications,
--    files, finance_transactions — rows that stay meaningful on their own)
--    now SET NULL instead, same as the manual SPK wipe done just before
--    this migration.
-- ============================================================================

-- ---------------------------------------------------------------------------
-- 1. Fix the self-reference bug in audit_row_change()
-- ---------------------------------------------------------------------------
create or replace function audit_row_change()
returns trigger
language plpgsql
security definer
set search_path = public, pg_catalog
as $fn$
declare
  v_before  jsonb;
  v_after   jsonb;
  v_fields  text[];
  v_record  uuid;
  v_spk     uuid;
  v_action  audit_action;
begin
  if tg_op = 'INSERT' then
    v_action := 'INSERT';
    v_after  := to_jsonb(new);
  elsif tg_op = 'UPDATE' then
    v_action := 'UPDATE';
    v_before := to_jsonb(old);
    v_after  := to_jsonb(new);
  else
    v_action := 'DELETE';
    v_before := to_jsonb(old);
  end if;

  if tg_op = 'UPDATE' then
    select array_agg(key)
    into v_fields
    from jsonb_each(v_after) a(key, value)
    where a.value is distinct from (v_before -> a.key)
      and a.key not in ('updated_at');

    -- Nothing of substance changed; skip the row.
    if v_fields is null then
      return null;
    end if;
  end if;

  v_record := nullif(coalesce(v_after, v_before) ->> 'id', '')::uuid;

  if tg_table_name = 'spks' then
    -- Deleting a spks row means v_record no longer exists in spks, so
    -- pointing spk_id at it would violate audit_logs' own FK. record_id
    -- already says which SPK this is; spk_id is redundant there anyway.
    v_spk := case when tg_op = 'DELETE' then null else v_record end;
  else
    v_spk := nullif(coalesce(v_after, v_before) ->> 'spk_id', '')::uuid;
  end if;

  insert into audit_logs (
    table_name, record_id, spk_id, action, changed_by,
    changed_fields, before_data, after_data
  )
  values (
    tg_table_name, v_record, v_spk, v_action, auth.uid(),
    v_fields, v_before, v_after
  );

  return null;
end;
$fn$;

-- ---------------------------------------------------------------------------
-- 2. Re-point FKs: composition children CASCADE, cross-cutting tables
--    SET NULL. Only spk_id / direct-parent FKs are touched — the revenue
--    chain (opname→pad→invoice→payment) and contract amendments keep their
--    original NO ACTION so deleting a mid-chain document still requires
--    clearing what depends on it first.
-- ---------------------------------------------------------------------------
alter table contracts          drop constraint contracts_spk_id_fkey,
  add constraint contracts_spk_id_fkey          foreign key (spk_id) references spks(id) on delete cascade;
alter table opnames            drop constraint opnames_spk_id_fkey,
  add constraint opnames_spk_id_fkey            foreign key (spk_id) references spks(id) on delete cascade;
alter table pad                drop constraint pad_spk_id_fkey,
  add constraint pad_spk_id_fkey                foreign key (spk_id) references spks(id) on delete cascade;
alter table invoices           drop constraint invoices_spk_id_fkey,
  add constraint invoices_spk_id_fkey           foreign key (spk_id) references spks(id) on delete cascade;
alter table payments           drop constraint payments_spk_id_fkey,
  add constraint payments_spk_id_fkey           foreign key (spk_id) references spks(id) on delete cascade;

alter table spk_activities     drop constraint spk_activities_spk_id_fkey,
  add constraint spk_activities_spk_id_fkey     foreign key (spk_id) references spks(id) on delete cascade;
alter table spk_assignments    drop constraint spk_assignments_spk_id_fkey,
  add constraint spk_assignments_spk_id_fkey    foreign key (spk_id) references spks(id) on delete cascade;
alter table spk_routing        drop constraint spk_routing_spk_id_fkey,
  add constraint spk_routing_spk_id_fkey        foreign key (spk_id) references spks(id) on delete cascade;
alter table spk_spatial_layers drop constraint spk_spatial_layers_spk_id_fkey,
  add constraint spk_spatial_layers_spk_id_fkey foreign key (spk_id) references spks(id) on delete cascade;
alter table designs            drop constraint designs_spk_id_fkey,
  add constraint designs_spk_id_fkey            foreign key (spk_id) references spks(id) on delete cascade;
alter table daily_plans        drop constraint daily_plans_spk_id_fkey,
  add constraint daily_plans_spk_id_fkey        foreign key (spk_id) references spks(id) on delete cascade;
alter table daily_progress     drop constraint daily_progress_spk_id_fkey,
  add constraint daily_progress_spk_id_fkey     foreign key (spk_id) references spks(id) on delete cascade;

alter table activity_progress  drop constraint activity_progress_spk_activity_id_fkey,
  add constraint activity_progress_spk_activity_id_fkey foreign key (spk_activity_id) references spk_activities(id) on delete cascade;
alter table daily_plans        drop constraint daily_plans_spk_activity_id_fkey,
  add constraint daily_plans_spk_activity_id_fkey        foreign key (spk_activity_id) references spk_activities(id) on delete cascade;
alter table daily_progress     drop constraint daily_progress_spk_activity_id_fkey,
  add constraint daily_progress_spk_activity_id_fkey     foreign key (spk_activity_id) references spk_activities(id) on delete cascade;
alter table daily_progress     drop constraint daily_progress_daily_plan_id_fkey,
  add constraint daily_progress_daily_plan_id_fkey       foreign key (daily_plan_id) references daily_plans(id) on delete cascade;
alter table design_revisions   drop constraint design_revisions_design_id_fkey,
  add constraint design_revisions_design_id_fkey         foreign key (design_id) references designs(id) on delete cascade;
alter table routing_history    drop constraint routing_history_spk_routing_id_fkey,
  add constraint routing_history_spk_routing_id_fkey     foreign key (spk_routing_id) references spk_routing(id) on delete cascade;

alter table audit_logs           drop constraint audit_logs_spk_id_fkey,
  add constraint audit_logs_spk_id_fkey           foreign key (spk_id) references spks(id) on delete set null;
alter table notifications        drop constraint notifications_spk_id_fkey,
  add constraint notifications_spk_id_fkey        foreign key (spk_id) references spks(id) on delete set null;
alter table files                drop constraint files_spk_id_fkey,
  add constraint files_spk_id_fkey                foreign key (spk_id) references spks(id) on delete set null;
alter table finance_transactions drop constraint finance_transactions_spk_id_fkey,
  add constraint finance_transactions_spk_id_fkey foreign key (spk_id) references spks(id) on delete set null;

-- ---------------------------------------------------------------------------
-- 3. Grant DELETE + a policy per table, mirroring that table's existing
--    UPDATE predicate exactly (same permission, same visibility rule).
-- ---------------------------------------------------------------------------
create policy roles_delete on roles
  for delete to authenticated using (has_perm('user_management', 'edit'));

create policy users_delete on users
  for delete to authenticated using (has_perm('user_management', 'edit'));

create policy vendors_delete on vendors
  for delete to authenticated
  using (has_perm('vendor', 'edit') and current_vendor_id() is null);

create policy vendor_teams_delete on vendor_teams
  for delete to authenticated
  using (
    has_perm('vendor', 'edit')
    and (current_vendor_id() is null or vendor_id = current_vendor_id())
  );

create policy vendor_members_delete on vendor_members
  for delete to authenticated using (has_perm('vendor', 'edit'));

do $do$
declare
  t text;
  masters text[] := array[
    'personnel', 'activity_templates', 'activity_template_items',
    'routing_templates', 'routing_template_steps', 'app_settings'
  ];
begin
  foreach t in array masters loop
    execute format(
      'create policy %I on %I for delete to authenticated
         using (has_perm(''master_data'', ''edit'') and current_vendor_id() is null)',
      t || '_delete', t);
  end loop;
end;
$do$;

create policy spks_delete on spks
  for delete to authenticated
  using (has_perm('spk', 'edit') and current_vendor_id() is null);

create policy spk_assignments_delete on spk_assignments
  for delete to authenticated
  using (has_perm('vendor', 'edit') and current_vendor_id() is null);

create policy spk_activities_delete on spk_activities
  for delete to authenticated using (spk_editable(spk_id, 'progress'));

create policy activity_progress_delete on activity_progress
  for delete to authenticated
  using (
    exists (
      select 1 from spk_activities a
      where a.id = spk_activity_id and spk_editable(a.spk_id, 'progress')
    )
  );

create policy daily_plans_delete on daily_plans
  for delete to authenticated
  using (
    spk_editable(spk_id, 'daily_plan')
    and (current_vendor_id() is null or vendor_id = current_vendor_id())
  );

create policy daily_progress_delete on daily_progress
  for delete to authenticated
  using (
    spk_editable(spk_id, 'daily_progress')
    and (current_vendor_id() is null or vendor_id = current_vendor_id())
  );

create policy files_delete on files
  for delete to authenticated
  using (file_module_visible(module) and (spk_id is null or spk_visible(spk_id)));

create policy spk_spatial_layers_delete on spk_spatial_layers
  for delete to authenticated using (spk_editable(spk_id, 'spk'));

create policy designs_delete on designs
  for delete to authenticated using (spk_editable(spk_id, 'design'));

create policy design_revisions_delete on design_revisions
  for delete to authenticated
  using (
    exists (select 1 from designs d where d.id = design_id and spk_editable(d.spk_id, 'design'))
  );

create policy spk_routing_delete on spk_routing
  for delete to authenticated using (spk_editable(spk_id, 'routing'));

create policy routing_history_delete on routing_history
  for delete to authenticated
  using (
    exists (select 1 from spk_routing r where r.id = spk_routing_id and spk_editable(r.spk_id, 'routing'))
  );

do $do$
declare
  fin_tables constant text[][] := array[
    array['contracts', 'contract'],
    array['opnames',   'opname'],
    array['pad',       'pad'],
    array['invoices',  'invoice'],
    array['payments',  'payment']
  ];
  i int;
  t text;
  m text;
begin
  for i in 1 .. array_length(fin_tables, 1) loop
    t := fin_tables[i][1];
    m := fin_tables[i][2];
    execute format(
      'create policy %I on %I for delete to authenticated
         using (has_perm(%L, ''edit'') and spk_visible(spk_id) and current_vendor_id() is null)',
      t || '_delete', t, m);
  end loop;
end;
$do$;

create policy chart_of_accounts_delete on chart_of_accounts
  for delete to authenticated
  using (has_perm('spending', 'edit') and current_vendor_id() is null);

create policy finance_transactions_delete on finance_transactions
  for delete to authenticated
  using (has_perm('spending', 'edit') and current_vendor_id() is null);

do $do$
declare
  t text;
  addable text[] := array[
    'roles', 'users', 'vendors', 'vendor_teams', 'vendor_members',
    'personnel', 'activity_templates', 'activity_template_items',
    'routing_templates', 'routing_template_steps', 'app_settings',
    'spks', 'spk_assignments', 'spk_activities', 'activity_progress',
    'daily_plans', 'daily_progress', 'files', 'spk_spatial_layers',
    'designs', 'design_revisions', 'spk_routing', 'routing_history',
    'contracts', 'opnames', 'pad', 'invoices', 'payments',
    'chart_of_accounts', 'finance_transactions'
  ];
begin
  foreach t in array addable loop
    execute format('grant delete on %I to authenticated', t);
  end loop;
end;
$do$;
