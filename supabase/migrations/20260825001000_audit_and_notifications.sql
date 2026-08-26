-- ============================================================================
-- 0010 — Audit log and notifications (Section 33, 34)
-- ============================================================================

create table audit_logs (
  id             bigserial primary key,
  table_name     text not null,
  record_id      uuid,
  spk_id         uuid references spks(id),
  action         audit_action not null,
  changed_by     uuid references users(id),
  changed_at     timestamptz not null default now(),
  changed_fields text[],
  before_data    jsonb,
  after_data     jsonb
);

comment on table audit_logs is
  'Section 33 — who changed what, when, from which value to which value.';

create index audit_logs_table_record_idx on audit_logs(table_name, record_id);
create index audit_logs_spk_idx on audit_logs(spk_id);
create index audit_logs_changed_at_idx on audit_logs(changed_at desc);
create index audit_logs_user_idx on audit_logs(changed_by);

-- ---------------------------------------------------------------------------
-- Generic audit trigger
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
    v_spk := v_record;
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

comment on function audit_row_change() is
  'Attach as AFTER INSERT/UPDATE/DELETE FOR EACH ROW on any audited table.';

-- Attach to every table whose history matters (Section 33 / 4.4).
do $do$
declare
  t text;
  audited text[] := array[
    'users', 'roles', 'role_permissions',
    'vendors', 'vendor_teams', 'vendor_members',
    'personnel', 'cash_ledger_categories',
    'activity_templates', 'activity_template_items',
    'routing_templates', 'routing_template_steps',
    'spks', 'spk_assignments',
    'spk_activities', 'activity_progress',
    'daily_plans', 'daily_progress',
    'files', 'spk_spatial_layers',
    'designs', 'design_revisions',
    'spk_routing', 'routing_history',
    'contracts', 'opnames', 'pad', 'invoices', 'payments',
    'cash_ledger', 'personnel_costs',
    'vendor_payments', 'vendor_payment_terms'
  ];
begin
  foreach t in array audited loop
    execute format(
      'create trigger %I after insert or update or delete on %I
         for each row execute function audit_row_change()',
      t || '_audit', t
    );
  end loop;
end;
$do$;

-- ---------------------------------------------------------------------------
-- notifications (Section 34)
-- ---------------------------------------------------------------------------
create type notification_severity as enum ('info', 'warning', 'critical');

create table notifications (
  id         uuid primary key default gen_random_uuid(),
  -- Target either one user or a whole role; at least one must be set.
  user_id    uuid references users(id),
  role_id    uuid references roles(id),
  spk_id     uuid references spks(id),
  category   text not null,
  title      text not null,
  message    text,
  severity   notification_severity not null default 'info',
  link_url   text,
  is_read    boolean not null default false,
  read_at    timestamptz,
  created_at timestamptz not null default now(),
  constraint notifications_target check (user_id is not null or role_id is not null)
);

comment on table notifications is
  'Section 34 — in-app notifications first; email/WhatsApp comes later.';

create index notifications_user_idx on notifications(user_id) where is_read = false;
create index notifications_role_idx on notifications(role_id) where is_read = false;
create index notifications_spk_idx on notifications(spk_id);
