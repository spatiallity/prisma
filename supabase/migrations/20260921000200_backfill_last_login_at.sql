-- Existing profiles missed the previous app-side update because normal users
-- cannot update public.users under RLS. Seed the display column from Auth.
update public.users profile
set last_login_at = auth_user.last_sign_in_at
from auth.users auth_user
where auth_user.id = profile.id
  and auth_user.last_sign_in_at is not null
  and (
    profile.last_login_at is null
    or profile.last_login_at < auth_user.last_sign_in_at
  );
