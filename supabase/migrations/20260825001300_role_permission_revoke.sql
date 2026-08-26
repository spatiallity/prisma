-- ============================================================================
-- 0013 — Allow a permission grant to be revoked (Section 6)
--
-- Migration 0012 revokes DELETE from `authenticated` on every table, because
-- Section 4.4 forbids hard-deleting *records* — SPK, progress, financial rows.
-- role_permissions is not a record: it is the Section 6 matrix itself. With no
-- DELETE the matrix can only ever be widened, never narrowed, which turns a
-- mis-click in User Management into a permanent privilege grant.
--
-- The row change is still captured by the audit trigger attached in 0010, so
-- revoking remains fully traceable.
-- ============================================================================

grant delete on role_permissions to authenticated;

create policy role_permissions_delete on role_permissions
  for delete to authenticated
  using (has_perm('user_management', 'edit'));
