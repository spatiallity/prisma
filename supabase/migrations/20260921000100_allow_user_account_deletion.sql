-- Allow an account to be removed without deleting its historical project data.
-- Author/PIC references become NULL, while the profile is removed together
-- with its Supabase Auth account.

alter table users
  drop constraint users_id_fkey,
  add constraint users_id_fkey
    foreign key (id) references auth.users(id) on delete cascade;

do $migration$
declare
  fk record;
begin
  for fk in
    select tc.table_name, kcu.column_name, tc.constraint_name
    from information_schema.table_constraints tc
    join information_schema.key_column_usage kcu
      on tc.constraint_catalog = kcu.constraint_catalog
      and tc.constraint_schema = kcu.constraint_schema
      and tc.constraint_name = kcu.constraint_name
    join information_schema.referential_constraints rc
      on tc.constraint_catalog = rc.constraint_catalog
      and tc.constraint_schema = rc.constraint_schema
      and tc.constraint_name = rc.constraint_name
    where tc.constraint_type = 'FOREIGN KEY'
      and tc.constraint_schema = 'public'
      and rc.unique_constraint_schema = 'public'
      and rc.unique_constraint_name in (
        select constraint_name
        from information_schema.table_constraints
        where table_schema = 'public'
          and table_name = 'users'
          and constraint_type in ('PRIMARY KEY', 'UNIQUE')
      )
  loop
    execute format('alter table public.%I drop constraint %I', fk.table_name, fk.constraint_name);
    execute format(
      'alter table public.%I add constraint %I foreign key (%I) references public.users(id) on delete set null',
      fk.table_name,
      fk.constraint_name,
      fk.column_name
    );
  end loop;
end
$migration$;
