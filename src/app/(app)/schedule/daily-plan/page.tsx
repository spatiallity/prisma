import type { Metadata } from 'next'
import Link from 'next/link'
import { PageHeader, EmptyState } from '@/components/ui/page-header'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Table, Td, Th, Tr } from '@/components/ui/table'
import { Badge, StatusBadge } from '@/components/ui/badge'
import { requirePermission } from '@/lib/auth/session'
import { createClient } from '@/lib/supabase/server'
import { can } from '@/lib/auth/permissions'
import { formatDate } from '@/lib/utils'
import { achievementTone, formatAchievement } from '@/lib/schedule'
import { DailyPlanForm, ScheduleStatusToggle } from '../forms'
import { loadScheduleOptions } from '../options'

export const metadata: Metadata = { title: 'Daily Plan' }

const PAGE_SIZE = 60

export default async function DailyPlanPage() {
  const user = await requirePermission('daily_plan', 'view')
  const mayEdit = can(user.permissions, 'daily_plan', 'edit')

  const supabase = await createClient()
  const [{ data: plans }, { data: achievement }, options] = await Promise.all([
    supabase
      .from('daily_plans')
      .select('*')
      .order('plan_date', { ascending: false })
      .limit(PAGE_SIZE),
    supabase.from('v_plan_vs_actual').select('*'),
    loadScheduleOptions(supabase),
  ])

  const spkIds = [...new Set((plans ?? []).map((p) => p.spk_id))]
  const activityIds = [
    ...new Set((plans ?? []).map((p) => p.spk_activity_id).filter(Boolean)),
  ] as string[]
  const teamIds = [...new Set((plans ?? []).map((p) => p.team_id).filter(Boolean))] as string[]

  const [{ data: spks }, { data: activities }, { data: teams }] = await Promise.all([
    spkIds.length
      ? supabase.from('spks').select('id, spk_number, site_code').in('id', spkIds)
      : Promise.resolve({ data: [] }),
    activityIds.length
      ? supabase.from('spk_activities').select('id, name').in('id', activityIds)
      : Promise.resolve({ data: [] }),
    teamIds.length
      ? supabase.from('vendor_teams').select('id, name').in('id', teamIds)
      : Promise.resolve({ data: [] }),
  ])

  const spkById = new Map((spks ?? []).map((s) => [s.id, s]))
  const activityName = new Map((activities ?? []).map((a) => [a.id, a.name]))
  const teamName = new Map((teams ?? []).map((t) => [t.id, t.name]))
  const achievementByPlan = new Map(
    (achievement ?? []).map((a) => [a.daily_plan_id, a]),
  )

  return (
    <>
      <PageHeader
        title="Daily Plan"
        description="Rencana pekerjaan per hari, per team, per aktivitas (Section 18)."
      />

      {mayEdit && (
        <Card className="mb-5">
          <CardHeader>
            <div>
              <CardTitle>Rencana baru</CardTitle>
              <CardDescription>
                Target di sini yang nanti dibandingkan dengan hasil aktual.
              </CardDescription>
            </div>
          </CardHeader>
          <CardContent>
            <DailyPlanForm options={options} />
          </CardContent>
        </Card>
      )}

      <Card className="overflow-hidden">
        {plans && plans.length > 0 ? (
          <Table>
            <thead>
              <tr>
                <Th>Tanggal</Th>
                <Th>SPK</Th>
                <Th>Aktivitas</Th>
                <Th>Team</Th>
                <Th className="text-right">Target</Th>
                <Th className="text-right">Aktual</Th>
                <Th className="text-right">Achievement</Th>
                <Th>Status</Th>
                {mayEdit && <Th className="text-right">Aksi</Th>}
              </tr>
            </thead>
            <tbody>
              {plans.map((plan) => {
                const spk = spkById.get(plan.spk_id)
                const stat = achievementByPlan.get(plan.id)
                const percent = stat ? Number(stat.achievement_percent) : null

                return (
                  <Tr key={plan.id}>
                    <Td className="tnum whitespace-nowrap font-semibold">
                      {formatDate(plan.plan_date)}
                    </Td>
                    <Td>
                      <Link
                        href={`/spk/${plan.spk_id}`}
                        className="font-bold text-primary hover:underline"
                      >
                        {spk?.site_code ?? spk?.spk_number ?? 'SPK'}
                      </Link>
                    </Td>
                    <Td className="text-muted-foreground">
                      {plan.spk_activity_id
                        ? (activityName.get(plan.spk_activity_id) ?? '—')
                        : '—'}
                    </Td>
                    <Td className="text-muted-foreground">
                      {plan.team_id ? (teamName.get(plan.team_id) ?? '—') : '—'}
                    </Td>
                    <Td className="tnum text-right">
                      {plan.target_value !== null
                        ? `${plan.target_value}${plan.unit ? ` ${plan.unit}` : ''}`
                        : '—'}
                    </Td>
                    <Td className="tnum text-right">
                      {stat ? `${stat.actual_value}${plan.unit ? ` ${plan.unit}` : ''}` : '—'}
                    </Td>
                    <Td className="text-right">
                      {percent === null || plan.target_value === null ? (
                        '—'
                      ) : (
                        <Badge tone={achievementTone(percent)}>
                          {formatAchievement(percent)}
                        </Badge>
                      )}
                    </Td>
                    <Td>
                      <StatusBadge status={plan.status} />
                    </Td>
                    {mayEdit && (
                      <Td className="text-right">
                        <ScheduleStatusToggle kind="plan" id={plan.id} status={plan.status} />
                      </Td>
                    )}
                  </Tr>
                )
              })}
            </tbody>
          </Table>
        ) : (
          <EmptyState
            title="Belum ada rencana"
            description="Buat Daily Plan agar target harian tim bisa dibandingkan dengan hasil aktual."
          />
        )}
      </Card>
    </>
  )
}
