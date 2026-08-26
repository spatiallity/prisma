-- ============================================================================
-- 0012 — Row Level Security (Section 6, 30, 31)
--
-- Access is enforced at database level, not only in the frontend. Every policy
-- routes through has_perm()/perm_scope() so the Section 6 matrix stays data,
-- not code. Vendor accounts are additionally narrowed to their assigned SPK.
--
-- Section 4.4 — no hard delete: DELETE is revoked outright and no table has a
-- DELETE policy. Corrections happen through status changes plus audit history.
-- ============================================================================

do $do$
declare
  t text;
begin
  for t in
    select tablename from pg_tables where schemaname = 'public'
  loop
    execute format('alter table %I enable row level security', t);
    execute format('revoke all on %I from anon, authenticated', t);
    execute format('grant select, insert, update on %I to authenticated', t);
  end loop;
end;
$do$;

-- audit_logs uses a bigserial; the sequence needs a grant of its own.
grant usage, select on sequence audit_logs_id_seq to authenticated;

-- Views inherit the caller's RLS (security_invoker), so a plain select grant
-- is safe here.
do $do$
declare
  v text;
begin
  for v in
    select viewname from pg_views where schemaname = 'public'
  loop
    execute format('grant select on %I to authenticated', v);
  end loop;
end;
$do$;

-- ---------------------------------------------------------------------------
-- RBAC tables
-- ---------------------------------------------------------------------------
create policy roles_select on roles
  for select to authenticated using (true);

create policy roles_write on roles
  for insert to authenticated with check (has_perm('user_management', 'edit'));
create policy roles_update on roles
  for update to authenticated using (has_perm('user_management', 'edit'))
  with check (has_perm('user_management', 'edit'));

create policy permissions_select on permissions
  for select to authenticated using (true);

create policy role_permissions_select on role_permissions
  for select to authenticated using (true);
create policy role_permissions_insert on role_permissions
  for insert to authenticated with check (has_perm('user_management', 'edit'));
create policy role_permissions_update on role_permissions
  for update to authenticated using (has_perm('user_management', 'edit'))
  with check (has_perm('user_management', 'edit'));

-- Users may always read their own profile; the rest needs the permission.
create policy users_select on users
  for select to authenticated
  using (id = auth.uid() or has_perm('user_management', 'view'));

create policy users_insert on users
  for insert to authenticated
  with check (has_perm('user_management', 'edit'));

create policy users_update on users
  for update to authenticated
  using (has_perm('user_management', 'edit'))
  with check (has_perm('user_management', 'edit'));

-- ---------------------------------------------------------------------------
-- Vendor master (Section 5.7 — a vendor sees only itself)
-- ---------------------------------------------------------------------------
create policy vendors_select on vendors
  for select to authenticated
  using (
    has_perm('vendor', 'view')
    and (current_vendor_id() is null or id = current_vendor_id())
  );

create policy vendors_insert on vendors
  for insert to authenticated
  with check (has_perm('vendor', 'edit') and current_vendor_id() is null);

create policy vendors_update on vendors
  for update to authenticated
  using (has_perm('vendor', 'edit') and current_vendor_id() is null)
  with check (has_perm('vendor', 'edit') and current_vendor_id() is null);

create policy vendor_teams_select on vendor_teams
  for select to authenticated
  using (
    has_perm('vendor', 'view')
    and (current_vendor_id() is null or vendor_id = current_vendor_id())
  );

create policy vendor_teams_insert on vendor_teams
  for insert to authenticated
  with check (
    has_perm('vendor', 'edit')
    and (current_vendor_id() is null or vendor_id = current_vendor_id())
  );

create policy vendor_teams_update on vendor_teams
  for update to authenticated
  using (
    has_perm('vendor', 'edit')
    and (current_vendor_id() is null or vendor_id = current_vendor_id())
  )
  with check (
    has_perm('vendor', 'edit')
    and (current_vendor_id() is null or vendor_id = current_vendor_id())
  );

create policy vendor_members_select on vendor_members
  for select to authenticated
  using (
    has_perm('vendor', 'view')
    and (
      current_vendor_id() is null
      or exists (
        select 1 from vendor_teams t
        where t.id = team_id and t.vendor_id = current_vendor_id()
      )
    )
  );

create policy vendor_members_insert on vendor_members
  for insert to authenticated
  with check (
    has_perm('vendor', 'edit')
    and (
      current_vendor_id() is null
      or exists (
        select 1 from vendor_teams t
        where t.id = team_id and t.vendor_id = current_vendor_id()
      )
    )
  );

create policy vendor_members_update on vendor_members
  for update to authenticated
  using (has_perm('vendor', 'edit'))
  with check (has_perm('vendor', 'edit'));

-- ---------------------------------------------------------------------------
-- Master data — internal roles only
-- ---------------------------------------------------------------------------
do $do$
declare
  t text;
  masters text[] := array[
    'personnel', 'cash_ledger_categories',
    'activity_templates', 'activity_template_items',
    'routing_templates', 'routing_template_steps',
    'app_settings'
  ];
begin
  foreach t in array masters loop
    execute format(
      'create policy %I on %I for select to authenticated
         using (has_perm(''master_data'', ''view'') and current_vendor_id() is null)',
      t || '_select', t);
    execute format(
      'create policy %I on %I for insert to authenticated
         with check (has_perm(''master_data'', ''edit'') and current_vendor_id() is null)',
      t || '_insert', t);
    execute format(
      'create policy %I on %I for update to authenticated
         using (has_perm(''master_data'', ''edit'') and current_vendor_id() is null)
         with check (has_perm(''master_data'', ''edit'') and current_vendor_id() is null)',
      t || '_update', t);
  end loop;
end;
$do$;

-- ---------------------------------------------------------------------------
-- SPK
-- ---------------------------------------------------------------------------
create policy spks_select on spks
  for select to authenticated using (spk_visible(id));

create policy spks_insert on spks
  for insert to authenticated
  with check (has_perm('spk', 'create') and current_vendor_id() is null);

create policy spks_update on spks
  for update to authenticated
  using (has_perm('spk', 'edit') and current_vendor_id() is null)
  with check (has_perm('spk', 'edit') and current_vendor_id() is null);

create policy spk_assignments_select on spk_assignments
  for select to authenticated using (spk_visible(spk_id));

create policy spk_assignments_insert on spk_assignments
  for insert to authenticated
  with check (has_perm('vendor', 'edit') and current_vendor_id() is null);

create policy spk_assignments_update on spk_assignments
  for update to authenticated
  using (has_perm('vendor', 'edit') and current_vendor_id() is null)
  with check (has_perm('vendor', 'edit') and current_vendor_id() is null);

-- ---------------------------------------------------------------------------
-- Progress engine
-- ---------------------------------------------------------------------------
create policy spk_activities_select on spk_activities
  for select to authenticated
  using (has_perm('progress', 'view') and spk_visible(spk_id));

create policy spk_activities_insert on spk_activities
  for insert to authenticated
  with check (spk_editable(spk_id, 'progress'));

create policy spk_activities_update on spk_activities
  for update to authenticated
  using (spk_editable(spk_id, 'progress'))
  with check (spk_editable(spk_id, 'progress'));

create policy activity_progress_select on activity_progress
  for select to authenticated
  using (
    has_perm('progress', 'view')
    and exists (
      select 1 from spk_activities a
      where a.id = spk_activity_id and spk_visible(a.spk_id)
    )
  );

create policy activity_progress_insert on activity_progress
  for insert to authenticated
  with check (
    exists (
      select 1 from spk_activities a
      where a.id = spk_activity_id and spk_editable(a.spk_id, 'progress')
    )
  );

create policy activity_progress_update on activity_progress
  for update to authenticated
  using (
    exists (
      select 1 from spk_activities a
      where a.id = spk_activity_id and spk_editable(a.spk_id, 'progress')
    )
  )
  with check (
    exists (
      select 1 from spk_activities a
      where a.id = spk_activity_id and spk_editable(a.spk_id, 'progress')
    )
  );

-- ---------------------------------------------------------------------------
-- Schedule — vendors edit their own rows (Section 6 "Own")
-- ---------------------------------------------------------------------------
create policy daily_plans_select on daily_plans
  for select to authenticated
  using (has_perm('daily_plan', 'view') and spk_visible(spk_id));

create policy daily_plans_insert on daily_plans
  for insert to authenticated
  with check (
    spk_editable(spk_id, 'daily_plan')
    and (current_vendor_id() is null or vendor_id = current_vendor_id())
  );

create policy daily_plans_update on daily_plans
  for update to authenticated
  using (
    spk_editable(spk_id, 'daily_plan')
    and (current_vendor_id() is null or vendor_id = current_vendor_id())
  )
  with check (
    spk_editable(spk_id, 'daily_plan')
    and (current_vendor_id() is null or vendor_id = current_vendor_id())
  );

create policy daily_progress_select on daily_progress
  for select to authenticated
  using (has_perm('daily_progress', 'view') and spk_visible(spk_id));

create policy daily_progress_insert on daily_progress
  for insert to authenticated
  with check (
    spk_editable(spk_id, 'daily_progress')
    and (current_vendor_id() is null or vendor_id = current_vendor_id())
  );

create policy daily_progress_update on daily_progress
  for update to authenticated
  using (
    spk_editable(spk_id, 'daily_progress')
    and (current_vendor_id() is null or vendor_id = current_vendor_id())
  )
  with check (
    spk_editable(spk_id, 'daily_progress')
    and (current_vendor_id() is null or vendor_id = current_vendor_id())
  );

-- ---------------------------------------------------------------------------
-- Files and spatial layers — gated by the module the file belongs to
-- ---------------------------------------------------------------------------
create or replace function file_module_visible(p_module file_module)
returns boolean
language sql
stable
security definer
set search_path = public, pg_catalog
as $fn$
  select case p_module
    when 'design'    then has_perm('design', 'view')
    when 'routing'   then has_perm('routing', 'view')
    when 'financial' then has_perm('contract', 'view')
    else has_perm('spk', 'view')
  end;
$fn$;

grant execute on function file_module_visible(file_module) to authenticated;

create policy files_select on files
  for select to authenticated
  using (
    file_module_visible(module)
    and (spk_id is null or spk_visible(spk_id))
  );

create policy files_insert on files
  for insert to authenticated
  with check (
    file_module_visible(module)
    and (spk_id is null or spk_visible(spk_id))
  );

create policy files_update on files
  for update to authenticated
  using (file_module_visible(module) and (spk_id is null or spk_visible(spk_id)))
  with check (file_module_visible(module) and (spk_id is null or spk_visible(spk_id)));

create policy spk_spatial_layers_select on spk_spatial_layers
  for select to authenticated using (spk_visible(spk_id));

create policy spk_spatial_layers_insert on spk_spatial_layers
  for insert to authenticated with check (spk_editable(spk_id, 'spk'));

create policy spk_spatial_layers_update on spk_spatial_layers
  for update to authenticated
  using (spk_editable(spk_id, 'spk'))
  with check (spk_editable(spk_id, 'spk'));

-- ---------------------------------------------------------------------------
-- Design (vendors hold no design permission at all)
-- ---------------------------------------------------------------------------
create policy designs_select on designs
  for select to authenticated
  using (has_perm('design', 'view') and spk_visible(spk_id));

create policy designs_insert on designs
  for insert to authenticated with check (spk_editable(spk_id, 'design'));

create policy designs_update on designs
  for update to authenticated
  using (spk_editable(spk_id, 'design'))
  with check (spk_editable(spk_id, 'design'));

create policy design_revisions_select on design_revisions
  for select to authenticated
  using (
    has_perm('design', 'view')
    and exists (select 1 from designs d where d.id = design_id and spk_visible(d.spk_id))
  );

create policy design_revisions_insert on design_revisions
  for insert to authenticated
  with check (
    exists (select 1 from designs d where d.id = design_id and spk_editable(d.spk_id, 'design'))
  );

create policy design_revisions_update on design_revisions
  for update to authenticated
  using (
    exists (select 1 from designs d where d.id = design_id and spk_editable(d.spk_id, 'design'))
  )
  with check (
    exists (select 1 from designs d where d.id = design_id and spk_editable(d.spk_id, 'design'))
  );

-- ---------------------------------------------------------------------------
-- Routing
-- ---------------------------------------------------------------------------
create policy spk_routing_select on spk_routing
  for select to authenticated
  using (has_perm('routing', 'view') and spk_visible(spk_id));

create policy spk_routing_insert on spk_routing
  for insert to authenticated with check (spk_editable(spk_id, 'routing'));

create policy spk_routing_update on spk_routing
  for update to authenticated
  using (spk_editable(spk_id, 'routing'))
  with check (spk_editable(spk_id, 'routing'));

create policy routing_history_select on routing_history
  for select to authenticated
  using (
    has_perm('routing', 'view')
    and exists (select 1 from spk_routing r where r.id = spk_routing_id and spk_visible(r.spk_id))
  );

create policy routing_history_insert on routing_history
  for insert to authenticated
  with check (
    exists (select 1 from spk_routing r where r.id = spk_routing_id and spk_editable(r.spk_id, 'routing'))
  );

create policy routing_history_update on routing_history
  for update to authenticated
  using (
    exists (select 1 from spk_routing r where r.id = spk_routing_id and spk_editable(r.spk_id, 'routing'))
  )
  with check (
    exists (select 1 from spk_routing r where r.id = spk_routing_id and spk_editable(r.spk_id, 'routing'))
  );

-- ---------------------------------------------------------------------------
-- Revenue-side financial — one module per table (Section 6)
-- ---------------------------------------------------------------------------
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
      'create policy %I on %I for select to authenticated
         using (has_perm(%L, ''view'') and spk_visible(spk_id))',
      t || '_select', t, m);

    execute format(
      'create policy %I on %I for insert to authenticated
         with check (has_perm(%L, ''edit'') and spk_visible(spk_id) and current_vendor_id() is null)',
      t || '_insert', t, m);

    execute format(
      'create policy %I on %I for update to authenticated
         using (has_perm(%L, ''edit'') and spk_visible(spk_id) and current_vendor_id() is null)
         with check (has_perm(%L, ''edit'') and spk_visible(spk_id) and current_vendor_id() is null)',
      t || '_update', t, m, m);
  end loop;
end;
$do$;

-- ---------------------------------------------------------------------------
-- Spending — never visible to vendors (Section 5.7 / 31)
-- ---------------------------------------------------------------------------
create policy cash_ledger_select on cash_ledger
  for select to authenticated
  using (has_perm('spending', 'view') and current_vendor_id() is null);

create policy cash_ledger_insert on cash_ledger
  for insert to authenticated
  with check (has_perm('spending', 'edit') and current_vendor_id() is null);

create policy cash_ledger_update on cash_ledger
  for update to authenticated
  using (has_perm('spending', 'edit') and current_vendor_id() is null)
  with check (has_perm('spending', 'edit') and current_vendor_id() is null);

create policy personnel_costs_select on personnel_costs
  for select to authenticated
  using (has_perm('spending', 'view') and current_vendor_id() is null);

create policy personnel_costs_insert on personnel_costs
  for insert to authenticated
  with check (has_perm('spending', 'edit') and current_vendor_id() is null);

create policy personnel_costs_update on personnel_costs
  for update to authenticated
  using (has_perm('spending', 'edit') and current_vendor_id() is null)
  with check (has_perm('spending', 'edit') and current_vendor_id() is null);

create policy vendor_payments_select on vendor_payments
  for select to authenticated
  using (has_perm('spending', 'view') and current_vendor_id() is null);

create policy vendor_payments_insert on vendor_payments
  for insert to authenticated
  with check (has_perm('spending', 'edit') and current_vendor_id() is null);

create policy vendor_payments_update on vendor_payments
  for update to authenticated
  using (has_perm('spending', 'edit') and current_vendor_id() is null)
  with check (has_perm('spending', 'edit') and current_vendor_id() is null);

create policy vendor_payment_terms_select on vendor_payment_terms
  for select to authenticated
  using (has_perm('spending', 'view') and current_vendor_id() is null);

create policy vendor_payment_terms_insert on vendor_payment_terms
  for insert to authenticated
  with check (has_perm('spending', 'edit') and current_vendor_id() is null);

create policy vendor_payment_terms_update on vendor_payment_terms
  for update to authenticated
  using (has_perm('spending', 'edit') and current_vendor_id() is null)
  with check (has_perm('spending', 'edit') and current_vendor_id() is null);

-- ---------------------------------------------------------------------------
-- Audit log — read only for everyone; vendors see only their own actions.
-- Rows are written by SECURITY DEFINER triggers, so no INSERT policy exists.
-- ---------------------------------------------------------------------------
create policy audit_logs_select on audit_logs
  for select to authenticated
  using (
    has_perm('audit_log', 'view')
    and (
      coalesce(perm_scope('audit_log', 'view'), 'all') <> 'own'
      or changed_by = auth.uid()
    )
    and (spk_id is null or spk_visible(spk_id))
  );

revoke insert, update on audit_logs from authenticated;

-- ---------------------------------------------------------------------------
-- Notifications — own inbox, or those addressed to the user role.
-- ---------------------------------------------------------------------------
create policy notifications_select on notifications
  for select to authenticated
  using (
    user_id = auth.uid()
    or role_id = (select role_id from users where id = auth.uid())
  );

create policy notifications_update on notifications
  for update to authenticated
  using (user_id = auth.uid())
  with check (user_id = auth.uid());

revoke insert on notifications from authenticated;
