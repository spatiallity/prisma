import type { Metadata } from 'next'
import { linkButtonClass } from '@/components/ui/button'
import Link from 'next/link'
import { CheckCircle2, Circle, CircleDot } from 'lucide-react'
import { PageHeader } from '@/components/ui/page-header'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { requirePermission } from '@/lib/auth/session'
import { createClient } from '@/lib/supabase/server'
import {
  ACTION_LABEL,
  ALL_ACTIONS,
  ALL_MODULES,
  MODULE_LABEL,
  SCOPE_LABEL,
  can,
  scopeOf,
} from '@/lib/auth/permissions'
import { cn, formatDateTime } from '@/lib/utils'

export const metadata: Metadata = { title: 'Dashboard' }

/** Section 37 — development phases, so the shell states what exists today. */
const PHASES = [
  { n: 1, name: 'Foundation', detail: 'Auth, role, permission, RLS, deployment', done: true },
  { n: 2, name: 'Core SPK', detail: 'SPK CRUD, vendor, team, assignment, audit log' },
  { n: 3, name: 'Progress Engine', detail: 'Activity template, weighted progress' },
  { n: 4, name: 'Schedule & Vendor', detail: 'Daily Plan, Daily Progress, productivity' },
  { n: 5, name: 'Design', detail: 'Design queue sampai finalisasi, file versioning' },
  { n: 6, name: 'Routing', detail: 'Routing stage, approval, lead time' },
  { n: 7, name: 'Financial & Spending', detail: 'Contract sampai payment, margin per SPK' },
  { n: 8, name: 'Dashboard & Reporting', detail: 'KPI, bottleneck, Today’s Schedule' },
  { n: 9, name: 'Optimization', detail: 'Notifications, export, analytics' },
]

export default async function DashboardPage() {
  const user = await requirePermission('dashboard', 'view')
  const supabase = await createClient()

  const [{ count: activeUsers }, { count: roleCount }] = await Promise.all([
    supabase
      .from('users')
      .select('id', { count: 'exact', head: true })
      .eq('status', 'Active'),
    supabase
      .from('roles')
      .select('id', { count: 'exact', head: true })
      .eq('status', 'Active'),
  ])

  const grantedModules = ALL_MODULES.filter((module) =>
    ALL_ACTIONS.some((action) => can(user.permissions, module, action)),
  )

  return (
    <>
      <PageHeader
        title={`Selamat datang, ${user.fullName.split(' ')[0]}`}
        description={`Masuk sebagai ${user.role.name}. Terakhir login ${formatDateTime(user.lastLoginAt)}.`}
      />

      <div className="grid gap-5 lg:grid-cols-3">
        <Card className="lg:col-span-2">
          <CardHeader>
            <div>
              <CardTitle>Akses Anda</CardTitle>
              <CardDescription>
                Diambil langsung dari role_permissions — bukan dikodekan di frontend
                (Section 6).
              </CardDescription>
            </div>
            <Badge tone="primary">{grantedModules.length} modul</Badge>
          </CardHeader>
          <CardContent>
            <ul className="grid gap-2 sm:grid-cols-2">
              {grantedModules.map((module) => (
                <li
                  key={module}
                  className="flex items-center justify-between gap-3 rounded-md border border-border px-3 py-2"
                >
                  <span className="truncate text-sm text-slate-900">
                    {MODULE_LABEL[module]}
                  </span>
                  <span className="flex shrink-0 gap-1">
                    {ALL_ACTIONS.filter((action) =>
                      can(user.permissions, module, action),
                    ).map((action) => {
                      const scope = scopeOf(user.permissions, module, action)!
                      return (
                        <Badge
                          key={action}
                          tone={action === 'view' ? 'neutral' : 'success'}
                          title={SCOPE_LABEL[scope]}
                        >
                          {ACTION_LABEL[action]}
                          {scope !== 'all' && (
                            <span className="opacity-70">· {SCOPE_LABEL[scope]}</span>
                          )}
                        </Badge>
                      )
                    })}
                  </span>
                </li>
              ))}
            </ul>
          </CardContent>
        </Card>

        <div className="grid content-start gap-5">
          <Card>
            <CardHeader>
              <CardTitle>Status sistem</CardTitle>
            </CardHeader>
            <CardContent className="grid gap-3">
              <Stat label="User aktif" value={activeUsers ?? 0} />
              <Stat label="Role aktif" value={roleCount ?? 0} />
              <Stat label="Fase berjalan" value="Phase 1" />
              {can(user.permissions, 'user_management', 'edit') && (
                <Link
                  href="/admin/users"
                  className={cn(linkButtonClass, 'mt-1 w-full')}
                >
                  Kelola user
                </Link>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <div>
                <CardTitle>Roadmap</CardTitle>
                <CardDescription>Section 37</CardDescription>
              </div>
            </CardHeader>
            <CardContent className="grid gap-2">
              {PHASES.map((phase) => (
                <div key={phase.n} className="flex items-start gap-2.5">
                  {phase.done ? (
                    <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-success" aria-hidden />
                  ) : phase.n === 2 ? (
                    <CircleDot className="mt-0.5 h-4 w-4 shrink-0 text-primary" aria-hidden />
                  ) : (
                    <Circle className="mt-0.5 h-4 w-4 shrink-0 text-muted-foreground/50" aria-hidden />
                  )}
                  <div className="min-w-0">
                    <p className="text-sm font-medium text-slate-900">
                      {phase.n}. {phase.name}
                    </p>
                    <p className="text-xs text-muted-foreground">{phase.detail}</p>
                  </div>
                </div>
              ))}
            </CardContent>
          </Card>
        </div>
      </div>

      <p className="mt-6 text-xs text-muted-foreground">
        KPI SPK, bottleneck dan Today&apos;s Schedule (Section 8–10) mulai terisi
        pada Phase 8, setelah data SPK dan progress tersedia.
      </p>
    </>
  )
}

function Stat({ label, value }: { label: string; value: string | number }) {
  return (
    <div className="flex items-baseline justify-between gap-3">
      <span className="text-sm text-muted-foreground">{label}</span>
      <span className="tnum text-lg font-semibold text-slate-900">{value}</span>
    </div>
  )
}
