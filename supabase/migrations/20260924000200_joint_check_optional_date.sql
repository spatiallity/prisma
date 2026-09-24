-- A completed Pengecekan Bersama may have no recorded execution date. Keep
-- completion as its own marker so an empty optional date does not make the
-- workflow appear unfinished.
alter table public.spks
  add column if not exists joint_check_completed_at timestamptz;

update public.spks
set joint_check_completed_at = coalesce(joint_check_completed_at, joint_check_date::timestamptz)
where joint_check_date is not null
  and joint_check_completed_at is null;

comment on column public.spks.joint_check_completed_at is
  'Pengecekan Bersama completion marker, independent from the optional execution date.';
