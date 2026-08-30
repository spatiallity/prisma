# Database Schema V1 — PRISMA

Deliverable 1 of `requirement-v1.1-prisma.md` (Section 45). Every table, enum, derived
view and RLS policy traces to a section of that document; section numbers are quoted in
the SQL comments.

## Layout

| File | Contents |
|---|---|
| `migrations/20260825000100_extensions_and_helpers.sql` | Extensions, shared enums, `set_updated_at`, progress math (Section 14/15) |
| `migrations/20260825000200_auth_rbac.sql` | `roles`, `permissions`, `role_permissions`, `users`, `has_perm()` / `perm_scope()` (Section 5, 6, 30) |
| `migrations/20260825000300_master_data.sql` | Vendors, teams, members, personnel, cash categories, activity & routing templates (Section 17, 19) |
| `migrations/20260825000400_spk.sql` | `spks`, `spk_assignments`, `spk_visible()` (Section 11, 12) |
| `migrations/20260825000500_progress_engine.sql` | `spk_activities`, `activity_progress`, `daily_plans`, `daily_progress` (Section 13–18) |
| `migrations/20260825000600_files_and_design.sql` | `files`, `spk_spatial_layers`, `designs`, `design_revisions` (Section 21, 22, 27, 32) |
| `migrations/20260825000700_routing.sql` | `spk_routing`, `routing_history` with computed lead time (Section 23, 24) |
| `migrations/20260825000800_financial_revenue.sql` | `contracts`, `opnames`, `pad`, `invoices`, `payments` (Section 25.1–25.5) |
| `migrations/20260825000900_spending.sql` | ~~`cash_ledger`, `personnel_costs`, `vendor_payments`, `vendor_payment_terms`~~ — retired by migration 0016, kept for history |
| `migrations/20260825001000_audit_and_notifications.sql` | Generic audit trigger + `notifications` (Section 33, 34) |
| `migrations/20260825001100_derived_views.sql` | Every computed figure: balance, progress, productivity, lead time, margin, overhead, KPI, bottleneck |
| `migrations/20260825001200_rls_policies.sql` | RLS on every table, Section 6 matrix enforced in the database |
| `migrations/20260825001300_role_permission_revoke.sql` | DELETE on `role_permissions` so the Section 6 matrix can be narrowed, not only widened |
| `migrations/20260826000100_harden_function_grants.sql` | Revokes RPC access to trigger-only functions, pins search_path (advisor 0011/0028/0029) |
| `migrations/20260827000100_anchor_daily_cumulative.sql` | Daily progress cumulative anchor fix |
| `migrations/20260830000100_finance_rab_module.sql` | Drops the unused margin-per-SPK cost model (0009); adds `chart_of_accounts` + `finance_transactions` — project-wide RAB monitoring (Anggaran vs Realisasi) sourced from the Monitoring Project Topografi Excel: UMK, SPPD, PPBJ Barang, PPBJ Jasa, Gaji PTT Project, MCU |
| `seed/seed.sql` | Roles, permissions, the Section 6 matrix, Chart of Accounts, Template A/B, Pertamina routing, thresholds |
| `seed/finance_transactions_import.sql` | One-time historical import of the 986 cleaned transactions from the source workbook (not idempotent — inserts once, guarded) |

## Applying

```bash
# Cloud project (no Docker needed)
supabase link --project-ref <YOUR-PROJECT-REF>
supabase db push
psql "$SUPABASE_DB_URL" -f supabase/seed/seed.sql

# or paste each migration, in filename order, into the Supabase SQL editor,
# then seed/seed.sql last.
```

Afterwards regenerate the typed client:

```bash
pnpm dlx supabase gen types typescript --project-id <ref> > src/lib/supabase/types.ts
```

Then create the first login in **Authentication → Users** and link it with the snippet
at the bottom of `seed/seed.sql`.

## Applied state

Applied to project `ovwpkxeylntshromcoks` on 2026-08-26, seed included:
37 tables · 15 views · 107 RLS policies · 7 roles · 60 permissions · 167 grants.
The first administrator profile is linked and login was verified end to end
(auth token → own profile → RLS-scoped reads).

Two findings from the Supabase security advisor were fixed in migration 0014.
The one that mattered: `recompute_activity_cumulative()` is SECURITY DEFINER and
every `public` function is exposed as a PostgREST RPC, so an unauthenticated
caller could have written `activity_progress` rows straight past RLS. EXECUTE is
now revoked from `public` and `anon` on every trigger-only function.

## Design decisions worth reviewing

**Nothing derived is ever stored as user input (Section 4.3).**
`cash_ledger` has no `balance` column — a stored running balance goes wrong the moment
someone back-dates a row, which is exactly the Excel failure Section 42 describes.
Same reasoning for overall SPK progress (`v_spk_progress`), RAB realisasi
(`v_finance_akun_summary` — sums `finance_transactions`, migration 0016) and every
dashboard KPI.
`vendor_payments.vendor_payable` and `routing_history.duration_days` *are* stored, as
generated columns — they depend only on their own row.

**No hard delete (Section 4.4).** `DELETE` is revoked from `authenticated` and no table
has a DELETE policy. Corrections go through `status` (`Active` / `Inactive` / `Archived`)
plus the audit trail.

**RLS is data, not code (Section 6, 31).** Policies call `has_perm(module, action)`,
which reads `role_permissions`. Changing who may do what is a seed/data change, not a
migration. Vendor accounts carry `users.vendor_id` and `spk_visible()` narrows them to
assigned SPK; spending tables additionally refuse any vendor account outright.

**Views are `security_invoker`.** Without it a view would run as its owner and hand
vendor accounts the financial data Section 31 forbids. Keep this on any view added later.

**Daily Progress cascades (Section 44).** A `daily_progress` row is a daily *increment*.
For area/quantity activities a trigger rebuilds the cumulative `activity_progress` row,
which updates `spk_activities.current_value`, which recomputes `progress_percent`, which
feeds `v_spk_progress` and the dashboard. Percentage and stage activities are updated
directly on the Progress tab.

**One exception to "no delete": `role_permissions`.** Migration 0013 grants
DELETE on that one table. Section 4.4 protects *records* — SPK, progress,
financial rows. `role_permissions` is not a record, it is the Section 6 matrix
itself, and without DELETE a permission could only ever be added, never revoked.
The audit trigger still captures each revocation.

**Notifications and audit rows are written by the backend**, not by clients — both are
insert-revoked for `authenticated`. Use the service-role key or a `SECURITY DEFINER`
function when Phase 8 wires up notification generation.

## Open questions for the project (assumptions currently baked in)

1. **Template B weights.** Section 17 requires it but gives no numbers. Seeded by dropping
   the two design activities (17% + 8%) and scaling the remaining nine proportionally to
   100%. Confirm before go-live.
2. **Stage measurement midpoint.** Section 14.4 only fixes *Selesai = 100%*. `stage_to_percent()`
   currently returns 50% for *Dalam Pengerjaan*. Change the one function if the project
   wants 0% until completion.
3. **Routing SLA.** Section 24 shows actual durations, not agreed limits. Placeholder
   `sla_days` (2–5 days per stage) are seeded so bottleneck detection has a threshold.
4. **Bottleneck thresholds** live in `app_settings`: `cash_balance_threshold` (Rp 5.000.000),
   `vendor_update_late_days` (2), `design_stage_max_days` (7). All editable as master data.
5. **Leaked password protection is off.** Supabase Auth can reject passwords found in
   HaveIBeenPwned. Enable it under Authentication → Policies before real accounts exist.
