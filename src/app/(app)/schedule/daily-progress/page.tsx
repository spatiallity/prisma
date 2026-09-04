import type { Metadata } from 'next'
import Link from 'next/link'
import { PageHeader, EmptyState } from '@/components/ui/page-header'
import { Card } from '@/components/ui/card'
import { Table, Td, Th, Tr } from '@/components/ui/table'
import { StatusBadge } from '@/components/ui/badge'
import { Alert } from '@/components/ui/alert'
import { requirePermission } from '@/lib/auth/session'
import { createClient } from '@/lib/supabase/server'
import { can } from '@/lib/auth/permissions'
import { formatDate, formatDateTime } from '@/lib/utils'
import { AddDailyProgressButton, EditDailyProgressButton, ScheduleStatusToggle } from '../forms'
import { loadScheduleOptions } from '../options'

export const metadata: Metadata = { title: 'Daily Progress' }

const PAGE_SIZE = 60

/** Section 18 / 44 — the entry that moves Overall Progress without anyone typing a percent. */
export default async function DailyProgressPage() {
  const user = await requirePermission('daily_progress', 'view')
  const mayEdit = can(user.permissions, 'daily_progress', 'edit')

  const supabase = await createClient()
  const [{ data: entries }, { data: openPlans }, options] = await Promise.all([
    supabase
      .from('daily_progress')
      .select('*')
      .order('progress_date', { ascending: false })
      .order('created_at', { ascending: false })
      .limit(PAGE_SIZE),
    supabase
      .from('daily_plans')
      .select('id, spk_id, plan_date, target_value, unit, spk_activity_id')
      .eq('status', 'Active')
      .order('plan_date', { ascending: false })
      .limit(80),
    loadScheduleOptions(supabase),
  ])

  const spkIds = [
    ...new Set([
      ...(entries ?? []).map((e) => e.spk_id),
      ...(openPlans ?? []).map((p) => p.spk_id),
    ]),
  ]
  const activityIds = [
    ...new Set((entries ?? []).map((e) => e.spk_activity_id).filter(Boolean)),
  ] as string[]
  const teamIds = [...new Set((entries ?? []).map((e) => e.team_id).filter(Boolean))] as string[]
  const actorIds = [
    ...new Set((entries ?? []).map((e) => e.submitted_by).filter(Boolean)),
  ] as string[]

  const [{ data: spks }, { data: activities }, { data: teams }, { data: actors }] =
    await Promise.all([
      spkIds.length
        ? supabase.from('spks').select('id, spk_number, site_code').in('id', spkIds)
        : Promise.resolve({ data: [] }),
      activityIds.length
        ? supabase.from('spk_activities').select('id, name').in('id', activityIds)
        : Promise.resolve({ data: [] }),
      teamIds.length
        ? supabase.from('vendor_teams').select('id, name').in('id', teamIds)
        : Promise.resolve({ data: [] }),
      actorIds.length
        ? supabase.from('users').select('id, full_name').in('id', actorIds)
        : Promise.resolve({ data: [] }),
    ])

  const spkById = new Map((spks ?? []).map((s) => [s.id, s]))
  const activityName = new Map((activities ?? []).map((a) => [a.id, a.name]))
  const teamName = new Map((teams ?? []).map((t) => [t.id, t.name]))
  const actorName = new Map((actors ?? []).map((a) => [a.id, a.full_name]))

  const planOptions = (openPlans ?? []).map((plan) => {
    const spk = spkById.get(plan.spk_id)
    const label = [
      formatDate(plan.plan_date),
      spk?.site_code ?? spk?.spk_number ?? '',
      plan.target_value !== null
        ? `target ${plan.target_value}${plan.unit ? ` ${plan.unit}` : ''}`
        : '',
    ]
      .filter(Boolean)
      .join(' · ')
    return { id: plan.id, spkId: plan.spk_id, label }
  })

  return (
    <>
      <PageHeader
        title="Daily Progress"
        description="Realisasi harian, diisi setelah personel kembali ke mess."
        actions={
          mayEdit && <AddDailyProgressButton options={options} plans={planOptions} />
        }
      />

      <Alert tone="info" className="mb-5">
        Entri di sini otomatis menaikkan progress aktivitas dan Overall Progress
        SPK-nya.
      </Alert>

      <Card className="overflow-hidden">
        {entries && entries.length > 0 ? (
          <Table>
            <thead>
              <tr>
                <Th>Tanggal</Th>
                <Th>SPK</Th>
                <Th>Aktivitas</Th>
                <Th>Team</Th>
                <Th className="text-right">Hasil</Th>
                <Th>Dilaporkan</Th>
                <Th>Status</Th>
                {mayEdit && <Th className="text-right">Aksi</Th>}
              </tr>
            </thead>
            <tbody>
              {entries.map((entry) => {
                const spk = spkById.get(entry.spk_id)
                return (
                  <Tr key={entry.id}>
                    <Td className="tnum whitespace-nowrap font-semibold">
                      {formatDate(entry.progress_date)}
                    </Td>
                    <Td>
                      <Link
                        href={`/spk/${entry.spk_id}`}
                        className="font-bold text-primary hover:underline"
                      >
                        {spk?.site_code ?? spk?.spk_number ?? 'SPK'}
                      </Link>
                    </Td>
                    <Td className="text-muted-foreground">
                      {entry.spk_activity_id
                        ? (activityName.get(entry.spk_activity_id) ?? '—')
                        : '—'}
                    </Td>
                    <Td className="text-muted-foreground">
                      {entry.team_id ? (teamName.get(entry.team_id) ?? '—') : '—'}
                    </Td>
                    <Td className="tnum text-right font-bold">
                      {entry.actual_value}
                      {entry.unit ? ` ${entry.unit}` : ''}
                    </Td>
                    <Td className="text-xs text-muted-foreground">
                      {entry.submitted_by
                        ? (actorName.get(entry.submitted_by) ?? 'Tidak dikenal')
                        : '—'}
                      <div>{formatDateTime(entry.submitted_at)}</div>
                    </Td>
                    <Td>
                      <StatusBadge status={entry.status} />
                    </Td>
                    {mayEdit && (
                      <Td className="text-right">
                        <div className="flex items-center justify-end gap-3">
                          <EditDailyProgressButton entry={entry} options={options} plans={planOptions} />
                          <ScheduleStatusToggle
                            kind="progress"
                            id={entry.id}
                            status={entry.status}
                          />
                        </div>
                      </Td>
                    )}
                  </Tr>
                )
              })}
            </tbody>
          </Table>
        ) : (
          <EmptyState
            title="Belum ada laporan"
            description="Isi Daily Progress pertama untuk menggerakkan progress SPK."
          />
        )}
      </Card>
    </>
  )
}
