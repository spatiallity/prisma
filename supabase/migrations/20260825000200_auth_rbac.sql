-- ============================================================================
-- 0002 — Users, roles, permissions (Section 5, 6, 30)
-- ============================================================================

-- Access scope for a granted permission (Section 6 matrix legend):
--   all      → every record in the project
--   own      → only records belonging to the user / their vendor
--   limited  → reduced field set (e.g. "View terbatas", vendor dashboard)
create type permission_scope as enum ('all', 'own', 'limited');

-- Modules mirror the Section 6 permission matrix and the Section 7 menu.
create type app_module as enum (
  'dashboard',
  'spk',
  'vendor',
  'schedule',
  'daily_plan',
  'daily_progress',
  'progress',
  'design',
  'routing',
  'contract',
  'opname',
  'pad',
  'invoice',
  'payment',
  'spending',
  'margin',
  'report',
  'master_data',
  'user_management',
  'audit_log'
);

create type app_action as enum ('view', 'create', 'edit');

-- ---------------------------------------------------------------------------
-- roles
-- ---------------------------------------------------------------------------
create table roles (
  id          uuid primary key default gen_random_uuid(),
  code        text not null unique,
  name        text not null,
  description text,
  status      record_status not null default 'Active',
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

comment on table roles is 'Section 5 — seven project roles.';

create trigger roles_set_updated_at
  before update on roles
  for each row execute function set_updated_at();

-- ---------------------------------------------------------------------------
-- permissions
-- ---------------------------------------------------------------------------
create table permissions (
  id          uuid primary key default gen_random_uuid(),
  module      app_module not null,
  action      app_action not null,
  description text,
  created_at  timestamptz not null default now(),
  unique (module, action)
);

comment on table permissions is 'Section 6 — module × action catalogue.';

-- ---------------------------------------------------------------------------
-- role_permissions
-- ---------------------------------------------------------------------------
create table role_permissions (
  role_id       uuid not null references roles(id) on update cascade,
  permission_id uuid not null references permissions(id) on update cascade,
  scope         permission_scope not null default 'all',
  created_at    timestamptz not null default now(),
  primary key (role_id, permission_id)
);

comment on column role_permissions.scope is
  'all = every record, own = own/vendor records only, limited = reduced field set.';

create index role_permissions_permission_idx on role_permissions(permission_id);

-- ---------------------------------------------------------------------------
-- users — application profile mirroring auth.users (Section 30)
-- ---------------------------------------------------------------------------
create table users (
  id            uuid primary key references auth.users(id) on delete restrict,
  email         text not null unique,
  full_name     text not null,
  phone         text,
  role_id       uuid not null references roles(id),
  -- vendor_id is added in migration 0003, after the vendors table exists.
  status        record_status not null default 'Active',
  last_login_at timestamptz,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);

comment on table users is
  'Application profile. Authentication itself lives in auth.users (Supabase Auth).';

create index users_role_idx on users(role_id);
create index users_status_idx on users(status);

create trigger users_set_updated_at
  before update on users
  for each row execute function set_updated_at();

-- ---------------------------------------------------------------------------
-- Authorization helper functions
--
-- SECURITY DEFINER so RLS policies can read roles/permissions without the
-- policy re-entering RLS on the same tables (infinite recursion). search_path
-- is pinned to keep the definer context from resolving objects elsewhere.
-- ---------------------------------------------------------------------------

create or replace function current_role_code()
returns text
language sql
stable
security definer
set search_path = public, pg_catalog
as $$
  select r.code
  from users u
  join roles r on r.id = u.role_id
  where u.id = auth.uid()
    and u.status = 'Active';
$$;

comment on function current_role_code() is
  'Role code of the authenticated user, NULL if unauthenticated or inactive.';

create or replace function has_perm(p_module app_module, p_action app_action)
returns boolean
language sql
stable
security definer
set search_path = public, pg_catalog
as $$
  select exists (
    select 1
    from users u
    join role_permissions rp on rp.role_id = u.role_id
    join permissions p on p.id = rp.permission_id
    where u.id = auth.uid()
      and u.status = 'Active'
      and p.module = p_module
      and p.action = p_action
  );
$$;

comment on function has_perm(app_module, app_action) is
  'True when the authenticated user role holds module/action (any scope).';

create or replace function perm_scope(p_module app_module, p_action app_action)
returns permission_scope
language sql
stable
security definer
set search_path = public, pg_catalog
as $$
  select rp.scope
  from users u
  join role_permissions rp on rp.role_id = u.role_id
  join permissions p on p.id = rp.permission_id
  where u.id = auth.uid()
    and u.status = 'Active'
    and p.module = p_module
    and p.action = p_action;
$$;

comment on function perm_scope(app_module, app_action) is
  'Scope granted for module/action, NULL when the permission is not granted.';

-- Convenience: does the user see every record of this module, or only "own"?
create or replace function has_perm_all(p_module app_module, p_action app_action)
returns boolean
language sql
stable
security definer
set search_path = public, pg_catalog
as $$
  select coalesce(perm_scope(p_module, p_action) in ('all', 'limited'), false);
$$;

grant execute on function current_role_code()                to authenticated;
grant execute on function has_perm(app_module, app_action)   to authenticated;
grant execute on function perm_scope(app_module, app_action) to authenticated;
grant execute on function has_perm_all(app_module, app_action) to authenticated;
