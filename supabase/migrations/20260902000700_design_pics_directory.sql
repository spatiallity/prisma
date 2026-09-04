-- ============================================================================
-- Lightweight PIC directory for the design module — decoupled from `users`,
-- which requires a real auth.users login (users.id references auth.users).
-- Design PICs are just named staff being tracked for lead-time reporting,
-- not accounts, so adding one must not require creating a login.
-- ============================================================================

create table design_pics (
  id uuid primary key default gen_random_uuid(),
  full_name text not null,
  created_at timestamptz not null default now(),
  created_by uuid references users(id)
);

create unique index design_pics_full_name_key on design_pics (lower(full_name));

alter table design_pics enable row level security;

create policy design_pics_select on design_pics
  for select using (has_perm('design'::app_module, 'view'::app_action));

create policy design_pics_insert on design_pics
  for insert with check (has_perm('design'::app_module, 'edit'::app_action));

-- Seed from whichever `users` were already used as a design PIC, so no
-- existing designs/design_revisions row loses its PIC label.
insert into design_pics (full_name)
select distinct u.full_name
from users u
where u.id in (
  select pic_id from designs where pic_id is not null
  union
  select pic_id from design_revisions where pic_id is not null
);

insert into design_pics (full_name) values
  ('Hari Susmoro'), ('Annisa Tria Sagita'), ('Bayu Santana')
on conflict ((lower(full_name))) do nothing;

-- Point designs.pic_id / design_revisions.pic_id at design_pics instead of
-- users, matching existing values across by name.
alter table designs add column pic_id_new uuid references design_pics(id);
update designs d
set pic_id_new = dp.id
from users u join design_pics dp on dp.full_name = u.full_name
where d.pic_id = u.id;
alter table designs drop constraint designs_pic_id_fkey;
alter table designs drop column pic_id;
alter table designs rename column pic_id_new to pic_id;

alter table design_revisions add column pic_id_new uuid references design_pics(id);
update design_revisions dr
set pic_id_new = dp.id
from users u join design_pics dp on dp.full_name = u.full_name
where dr.pic_id = u.id;
alter table design_revisions drop constraint design_revisions_pic_id_fkey;
alter table design_revisions drop column pic_id;
alter table design_revisions rename column pic_id_new to pic_id;
