-- Financial Report uses the report module for both navigation and page access.
insert into public.role_permissions (role_id, permission_id, scope)
select r.id, p.id, 'all'::public.permission_scope
from public.roles r
join public.permissions p on p.module = 'report'::public.app_module and p.action = 'view'::public.app_action
where r.code = 'administration'
on conflict (role_id, permission_id) do update set scope = excluded.scope;
