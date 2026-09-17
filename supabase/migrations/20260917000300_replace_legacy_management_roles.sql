-- Replace legacy Dukbis and Kabid BIU roles with the reviewed Management role.
-- Existing users are retained and moved to Management before the legacy roles
-- are made unavailable for new assignments.
insert into roles (code, name, description)
values ('management', 'Management', 'Monitoring project dan pengelolaan pengeluaran.')
on conflict (code) do update
  set name = excluded.name,
      description = excluded.description,
      status = 'Active';

update users
set role_id = management_role.id
from roles legacy_role
join roles management_role on management_role.code = 'management'
where users.role_id = legacy_role.id
  and legacy_role.code in ('dukbis', 'kabid_biu');

delete from role_permissions rp
using roles r
where rp.role_id = r.id
  and r.code in ('dukbis', 'kabid_biu', 'management');

with grants(module, action, scope) as (
  values
    ('dashboard', 'view', 'all'),
    ('spk', 'view', 'all'),
    ('progress', 'view', 'all'),
    ('design', 'view', 'all'),
    ('routing', 'view', 'all'),
    ('contract', 'view', 'all'),
    ('opname', 'view', 'all'),
    ('pad', 'view', 'all'),
    ('invoice', 'view', 'all'),
    ('payment', 'view', 'all'),
    ('spending', 'view', 'all'),
    ('spending', 'create', 'all'),
    ('spending', 'edit', 'all'),
    ('rab_monitoring', 'view', 'all'),
    ('rab_monitoring', 'create', 'all'),
    ('rab_monitoring', 'edit', 'all')
)
insert into role_permissions (role_id, permission_id, scope)
select r.id, p.id, grants.scope::permission_scope
from grants
join roles r on r.code = 'management'
join permissions p on p.module = grants.module::app_module and p.action = grants.action::app_action;

update roles
set status = 'Inactive'
where code in ('dukbis', 'kabid_biu');
