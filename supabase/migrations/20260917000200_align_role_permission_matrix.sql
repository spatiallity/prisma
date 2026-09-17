-- Align role grants with the reviewed 2026-09-17 privilege matrix.
-- Vendor has no app access; Super Admin retains its full existing catalogue.
delete from role_permissions rp
using roles r
where rp.role_id = r.id
  and r.code in (
    'administration', 'drafter', 'dukbis', 'kabid_biu',
    'operational', 'project_manager', 'tester', 'vendor'
  );

insert into permissions (module, action)
select module::app_module, action::app_action
from (values
  ('rab_monitoring', 'view'),
  ('rab_monitoring', 'create'),
  ('rab_monitoring', 'edit')
) as requested(module, action)
on conflict (module, action) do nothing;

with grants(role_code, module, action, scope) as (
  values
    -- Administration
    ('administration', 'dashboard', 'view', 'all'),
    ('administration', 'spk', 'view', 'all'), ('administration', 'spk', 'create', 'all'), ('administration', 'spk', 'edit', 'all'),
    ('administration', 'progress', 'view', 'all'), ('administration', 'progress', 'create', 'all'), ('administration', 'progress', 'edit', 'all'),
    ('administration', 'design', 'view', 'all'),
    ('administration', 'routing', 'view', 'all'), ('administration', 'routing', 'create', 'all'), ('administration', 'routing', 'edit', 'all'),
    ('administration', 'contract', 'view', 'all'), ('administration', 'contract', 'create', 'all'), ('administration', 'contract', 'edit', 'all'),
    ('administration', 'opname', 'view', 'all'), ('administration', 'opname', 'create', 'all'), ('administration', 'opname', 'edit', 'all'),
    ('administration', 'pad', 'view', 'all'), ('administration', 'pad', 'create', 'all'), ('administration', 'pad', 'edit', 'all'),
    ('administration', 'invoice', 'view', 'all'), ('administration', 'invoice', 'create', 'all'), ('administration', 'invoice', 'edit', 'all'),
    ('administration', 'payment', 'view', 'all'), ('administration', 'payment', 'create', 'all'), ('administration', 'payment', 'edit', 'all'),
    ('administration', 'spending', 'view', 'all'), ('administration', 'spending', 'create', 'all'), ('administration', 'spending', 'edit', 'all'),

    -- Drafter
    ('drafter', 'dashboard', 'view', 'all'),
    ('drafter', 'spk', 'view', 'all'), ('drafter', 'spk', 'create', 'all'), ('drafter', 'spk', 'edit', 'all'),
    ('drafter', 'progress', 'view', 'all'), ('drafter', 'progress', 'create', 'all'), ('drafter', 'progress', 'edit', 'all'),
    ('drafter', 'design', 'view', 'all'), ('drafter', 'design', 'create', 'all'), ('drafter', 'design', 'edit', 'all'),
    ('drafter', 'routing', 'view', 'all'), ('drafter', 'contract', 'view', 'all'), ('drafter', 'opname', 'view', 'all'),
    ('drafter', 'pad', 'view', 'all'), ('drafter', 'invoice', 'view', 'all'), ('drafter', 'payment', 'view', 'all'),

    -- Dukbis and Kabid BIU: review only, except Dukbis manages expense entries.
    ('dukbis', 'dashboard', 'view', 'all'), ('dukbis', 'spk', 'view', 'all'), ('dukbis', 'progress', 'view', 'all'),
    ('dukbis', 'design', 'view', 'all'), ('dukbis', 'routing', 'view', 'all'), ('dukbis', 'contract', 'view', 'all'),
    ('dukbis', 'opname', 'view', 'all'), ('dukbis', 'pad', 'view', 'all'), ('dukbis', 'invoice', 'view', 'all'), ('dukbis', 'payment', 'view', 'all'),
    ('dukbis', 'spending', 'view', 'all'), ('dukbis', 'spending', 'create', 'all'), ('dukbis', 'spending', 'edit', 'all'),
    ('dukbis', 'rab_monitoring', 'view', 'all'), ('dukbis', 'rab_monitoring', 'create', 'all'), ('dukbis', 'rab_monitoring', 'edit', 'all'),
    ('kabid_biu', 'dashboard', 'view', 'all'), ('kabid_biu', 'spk', 'view', 'all'), ('kabid_biu', 'progress', 'view', 'all'),
    ('kabid_biu', 'design', 'view', 'all'), ('kabid_biu', 'routing', 'view', 'all'), ('kabid_biu', 'contract', 'view', 'all'),
    ('kabid_biu', 'opname', 'view', 'all'), ('kabid_biu', 'pad', 'view', 'all'), ('kabid_biu', 'invoice', 'view', 'all'), ('kabid_biu', 'payment', 'view', 'all'),
    ('kabid_biu', 'spending', 'view', 'all'), ('kabid_biu', 'rab_monitoring', 'view', 'all'),

    -- Operational
    ('operational', 'dashboard', 'view', 'all'),
    ('operational', 'spk', 'view', 'all'), ('operational', 'spk', 'create', 'all'), ('operational', 'spk', 'edit', 'all'),
    ('operational', 'progress', 'view', 'all'), ('operational', 'progress', 'create', 'all'), ('operational', 'progress', 'edit', 'all'),
    ('operational', 'design', 'view', 'all'), ('operational', 'routing', 'view', 'all'), ('operational', 'contract', 'view', 'all'),
    ('operational', 'opname', 'view', 'all'), ('operational', 'pad', 'view', 'all'), ('operational', 'invoice', 'view', 'all'), ('operational', 'payment', 'view', 'all'),
    ('operational', 'spending', 'view', 'all'), ('operational', 'rab_monitoring', 'view', 'all'),

    -- Project Manager: full operational control, including User & Role.
    ('project_manager', 'dashboard', 'view', 'all'), ('project_manager', 'dashboard', 'create', 'all'), ('project_manager', 'dashboard', 'edit', 'all'),
    ('project_manager', 'spk', 'view', 'all'), ('project_manager', 'spk', 'create', 'all'), ('project_manager', 'spk', 'edit', 'all'),
    ('project_manager', 'progress', 'view', 'all'), ('project_manager', 'progress', 'create', 'all'), ('project_manager', 'progress', 'edit', 'all'),
    ('project_manager', 'design', 'view', 'all'), ('project_manager', 'design', 'create', 'all'), ('project_manager', 'design', 'edit', 'all'),
    ('project_manager', 'routing', 'view', 'all'), ('project_manager', 'routing', 'create', 'all'), ('project_manager', 'routing', 'edit', 'all'),
    ('project_manager', 'contract', 'view', 'all'), ('project_manager', 'contract', 'create', 'all'), ('project_manager', 'contract', 'edit', 'all'),
    ('project_manager', 'opname', 'view', 'all'), ('project_manager', 'opname', 'create', 'all'), ('project_manager', 'opname', 'edit', 'all'),
    ('project_manager', 'pad', 'view', 'all'), ('project_manager', 'pad', 'create', 'all'), ('project_manager', 'pad', 'edit', 'all'),
    ('project_manager', 'invoice', 'view', 'all'), ('project_manager', 'invoice', 'create', 'all'), ('project_manager', 'invoice', 'edit', 'all'),
    ('project_manager', 'payment', 'view', 'all'), ('project_manager', 'payment', 'create', 'all'), ('project_manager', 'payment', 'edit', 'all'),
    ('project_manager', 'spending', 'view', 'all'), ('project_manager', 'spending', 'create', 'all'), ('project_manager', 'spending', 'edit', 'all'),
    ('project_manager', 'rab_monitoring', 'view', 'all'), ('project_manager', 'rab_monitoring', 'create', 'all'), ('project_manager', 'rab_monitoring', 'edit', 'all'),
    ('project_manager', 'user_management', 'view', 'all'), ('project_manager', 'user_management', 'create', 'all'), ('project_manager', 'user_management', 'edit', 'all'),

    -- Tester: read-only access, with RAB monitoring deliberately excluded.
    ('tester', 'dashboard', 'view', 'all'), ('tester', 'spk', 'view', 'all'), ('tester', 'progress', 'view', 'all'),
    ('tester', 'design', 'view', 'all'), ('tester', 'routing', 'view', 'all'), ('tester', 'contract', 'view', 'all'),
    ('tester', 'opname', 'view', 'all'), ('tester', 'pad', 'view', 'all'), ('tester', 'invoice', 'view', 'all'), ('tester', 'payment', 'view', 'all'),
    ('tester', 'spending', 'view', 'all')
)
insert into role_permissions (role_id, permission_id, scope)
select r.id, p.id, grants.scope::permission_scope
from grants
join roles r on r.code = grants.role_code
join permissions p on p.module = grants.module::app_module and p.action = grants.action::app_action;

-- Super Admin receives the newly introduced RAB-monitoring grants.
insert into role_permissions (role_id, permission_id, scope)
select r.id, p.id, 'all'::permission_scope
from roles r
join permissions p on p.module = 'rab_monitoring'::app_module
where r.code = 'super_admin'
on conflict (role_id, permission_id) do update set scope = excluded.scope;
