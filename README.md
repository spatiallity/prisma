# PRISMA

**P**roject **R**eporting, **I**ntegration, **S**tatus Monitoring & **A**nalytics —
the project control system for PT SUCOFINDO (Persero), Survei Topografi Lokasi Bor
dan Fasilitas Produksi, Pertamina EP Zona 4 Prabumulih.

The product name lives in `src/lib/brand.ts`; nothing hardcodes it.

Requirement of record: [`requirement-v1.1-prisma.md`](./requirement-v1.1-prisma.md).
Every module in the code cites the section it implements.

## Stack

Next.js 16 (App Router) · React 19 · Tailwind CSS v4 · Supabase (Postgres, Auth,
Storage) · Vercel — as specified in Section 35.

## Getting started

```bash
pnpm install
cp .env.example .env.local     # then fill in the Supabase keys
pnpm dev
```

Without Supabase keys every route redirects to `/setup`, which lists the
remaining steps. Database setup lives in [`supabase/README.md`](./supabase/README.md).

## What exists today

**Phase 1 Foundation**, **Phase 2 Core SPK**, and **Phase 3 Progress Engine** of
Section 37.

| Route | Purpose |
|---|---|
| `/login` | Supabase Auth sign-in |
| `/setup` | Shown while the project is not wired to Supabase |
| `/dashboard` | Landing page: own permission matrix, system counts, roadmap |
| `/admin/users` | User list, create (Auth account + profile), edit, deactivate, reset password |
| `/admin/roles` | Roles, and the Section 6 permission matrix per role |
| `/admin/audit-log` | Last 50 recorded changes (Section 33) |
| `/spk` | Searchable SPK list with status filters |
| `/spk/[id]` | Detail SPK — Overview and Progress tabs (Section 12) |
| `/spk/[id]/progress/[activityId]` | Progress history per activity (Section 16) |
| `/vendor`, `/vendor/[id]`, `/vendor/team`, `/vendor/assignment` | Vendor master, teams, members, assignment |
| `/admin/activity-templates` | Progress Template master (Section 17) |
| `/no-profile`, `/inactive`, `/forbidden` | The three ways access can be refused |

The sidebar renders the complete Section 7 menu. Items the signed-in role has no
permission for are omitted; items whose module is not built yet are greyed out
and tagged with their Section 37 phase.

## Theme

Palette, typography and shell layout follow
[spatiallity/tenderhub-lsi](https://github.com/spatiallity/tenderhub-lsi) so both
SUCOFINDO apps read as one product: Plus Jakarta Sans, `#2563eb` primary, a white
collapsible 240px/68px rail with `rounded-xl` active pills, slate-100 page
background, and cards with a 2px slate border. The reference has no dark theme,
so this app is light-only — the tokens live in `src/app/globals.css` if that
changes.

## Layout

```text
src/
├── app/
│   ├── (auth)/          login, setup, no-profile, inactive
│   ├── (app)/           everything behind a session — dashboard, admin
│   └── auth/signout/
├── components/
│   ├── app-shell/       sidebar, topbar, mobile drawer, theme toggle
│   └── ui/              button, field, card, badge, table, alert
├── lib/
│   ├── auth/            session resolution and the permission helpers
│   ├── supabase/        browser / server / service-role clients, types
│   └── nav.ts           Section 7 menu definition
└── proxy.ts             session refresh + public-route guard
```

## Authorization

`src/lib/auth/permissions.ts` mirrors the database `has_perm()` function so the
UI knows what to offer. It is **not** the enforcement point — RLS is (Section 31).
Every page still calls `requirePermission(module, action)` so a user never lands
on a screen that would render nothing but permission errors.

Permissions are data: they live in `role_permissions` and are edited at
`/admin/roles`, never in code.

## Commands

```bash
pnpm dev            # dev server
pnpm build          # production build (runs tsc)
pnpm lint           # eslint
pnpm exec tsc --noEmit
```

After the schema is applied, regenerate the typed client — `src/lib/supabase/types.ts`
is currently a hand-written subset covering only the Phase 1 tables:

```bash
pnpm dlx supabase gen types typescript --project-id <ref> > src/lib/supabase/types.ts
```
