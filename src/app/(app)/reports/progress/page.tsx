import type { Metadata } from 'next'
import Link from 'next/link'
import { PageHeader, EmptyState } from '@/components/ui/page-header'
import { Card, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Table, Td, Th, Tr } from '@/components/ui/table'
import { Badge } from '@/components/ui/badge'
import { requirePermission } from '@/lib/auth/session'
import { createClient } from '@/lib/supabase/server'
import { cn } from '@/lib/utils'
import { formatPercent } from '@/lib/spk'
import { MEASUREMENT_LABEL } from '@/lib/progress'

export const metadata: Metadata = { title: 'Progress Report' }

const number = new Intl.NumberFormat('id-ID', { maximumFractionDigits: 2 })

/**
 * Section 15/20 — progress read across SPK rather than inside one: which
 * activity types are furthest behind, and which teams are producing what.
 */
export default async function ProgressReportPage() {
  await requirePermission('report', 'view')

  const supabase = await createClient()
  const [{ data: activities }, { data: spks }, { data: productivity }, { data: vendors }] =
    await Promise.all([
      supabase.from('v_spk_activity_progress').select('*'),
      supabase.from('spks').select('id, spk_number, site_code, status'),
      supabase.from('v_productivity').select('*'),
      supabase.from('vendors').select('id, name'),
    ])

  const spkById = new Map((spks ?? []).map((s) => [s.id, s]))
  const vendorName = new Map((vendors ?? []).map((v) => [v.id, v.name]))

  // Only activities on live SPK say anything about where the work stands.
  const live = (activities ?? []).filter((a) => {
    const spk = spkById.get(a.spk_id)
    return spk?.status === 'On Going' || spk?.status === 'Draft'
  })

  const byActivity = new Map<
    string,
    { count: number; weighted: number; weight: number; done: number }
  >()
  for (const activity of live) {
    const current = byActivity.get(activity.name) ?? {
      count: 0,
      weighted: 0,
      weight: 0,
      done: 0,
    }
    current.count += 1
    current.weighted += Number(activity.progress_percent) * Number(activity.weight)
    current.weight += Number(activity.weight)
    if (Number(activity.progress_percent) >= 100) current.done += 1
    byActivity.set(activity.name, current)
  }

  const rows = [...byActivity.entries()]
    .map(([name, stat]) => ({
      name,
      count: stat.count,
      done: stat.done,
      average: stat.weight > 0 ? stat.weighted / stat.weight : 0,
    }))
    .sort((a, b) => a.average - b.average)

  const prodRows = (productivity ?? [])
    .filter((p) => p.per_day !== null)
    .sort((a, b) => Number(b.per_day) - Number(a.per_day))

  return (
    <>
      <PageHeader
        title="Progress Report"
        description="Progress dibaca lintas SPK — aktivitas mana yang paling tertinggal, dan produktivitas tiap team."
      />

      <div className="grid gap-5 lg:grid-cols-3">
        <Card className="overflow-hidden lg:col-span-2">
          <CardHeader>
            <div>
              <CardTitle>Rata-rata per jenis aktivitas</CardTitle>
              <CardDescription>
                Ditimbang dengan bobot aktivitas, bukan rata-rata sederhana. Urut
                dari yang paling tertinggal.
              </CardDescription>
            </div>
          </CardHeader>

          {rows.length > 0 ? (
            <Table>
              <thead>
                <tr>
                  <Th>Aktivitas</Th>
                  <Th className="text-right">Dipakai SPK</Th>
                  <Th className="text-right">Selesai</Th>
                  <Th className="text-right">Rata-rata progress</Th>
                </tr>
              </thead>
              <tbody>
                {rows.map((row) => (
                  <Tr key={row.name}>
                    <Td className="font-bold text-slate-900">{row.name}</Td>
                    <Td className="tnum text-right">{row.count}</Td>
                    <Td className="tnum text-right text-muted-foreground">
                      {row.done}/{row.count}
                    </Td>
                    <Td className="text-right">
                      <div className="flex items-center justify-end gap-2">
                        <div className="h-1.5 w-20 overflow-hidden rounded-full bg-slate-100">
                          <div
                            className={cn(
                              'h-full rounded-full',
                              row.average < 30 ? 'bg-warning' : 'bg-primary',
                            )}
                            style={{ width: `${Math.min(row.average, 100)}%` }}
                          />
                        </div>
                        <span className="tnum w-14 text-right font-bold">
                          {formatPercent(row.average)}
                        </span>
                      </div>
                    </Td>
                  </Tr>
                ))}
              </tbody>
            </Table>
          ) : (
            <EmptyState
              title="Belum ada aktivitas pada SPK berjalan"
              description="Terapkan Progress Template pada SPK untuk mengisi laporan ini."
            />
          )}
        </Card>

        <Card className="overflow-hidden">
          <CardHeader>
            <div>
              <CardTitle>Produktivitas</CardTitle>
              <CardDescription>Section 20 — hasil per hari kerja.</CardDescription>
            </div>
          </CardHeader>

          {prodRows.length > 0 ? (
            <Table>
              <thead>
                <tr>
                  <Th>Team</Th>
                  <Th>Aktivitas</Th>
                  <Th className="text-right">Per hari</Th>
                </tr>
              </thead>
              <tbody>
                {prodRows.slice(0, 10).map((row, index) => (
                  <Tr key={`${row.spk_activity_id}-${row.team_id}-${index}`}>
                    <Td className="font-bold text-slate-900">
                      {row.vendor_id ? (vendorName.get(row.vendor_id) ?? '—') : '—'}
                    </Td>
                    <Td className="text-muted-foreground">{row.activity_name ?? '—'}</Td>
                    <Td className="tnum text-right font-bold">
                      {number.format(Number(row.per_day))}
                      {row.unit ? ` ${row.unit}` : ''}
                    </Td>
                  </Tr>
                ))}
              </tbody>
            </Table>
          ) : (
            <EmptyState title="Belum ada data produktivitas" />
          )}
        </Card>
      </div>

      <Card className="mt-5 overflow-hidden">
        <CardHeader>
          <div>
            <CardTitle>Aktivitas paling tertinggal</CardTitle>
            <CardDescription>
              Sepuluh aktivitas dengan progress terendah pada SPK berjalan.
            </CardDescription>
          </div>
        </CardHeader>

        {live.length > 0 ? (
          <Table>
            <thead>
              <tr>
                <Th>SPK</Th>
                <Th>Aktivitas</Th>
                <Th>Pengukuran</Th>
                <Th className="text-right">Bobot</Th>
                <Th className="text-right">Progress</Th>
                <Th className="text-right">Kontribusi</Th>
              </tr>
            </thead>
            <tbody>
              {[...live]
                .sort(
                  (a, b) => Number(a.progress_percent) - Number(b.progress_percent),
                )
                .slice(0, 10)
                .map((activity) => {
                  const spk = spkById.get(activity.spk_id)
                  return (
                    <Tr key={activity.spk_activity_id}>
                      <Td>
                        <Link
                          href={`/spk/${activity.spk_id}?tab=progress`}
                          className="font-bold text-primary hover:underline"
                        >
                          {spk?.site_code ?? spk?.spk_number ?? 'SPK'}
                        </Link>
                      </Td>
                      <Td className="font-bold text-slate-900">{activity.name}</Td>
                      <Td>
                        <Badge>{MEASUREMENT_LABEL[activity.measurement]}</Badge>
                      </Td>
                      <Td className="tnum text-right">{formatPercent(activity.weight)}</Td>
                      <Td className="tnum text-right font-bold">
                        {formatPercent(activity.progress_percent)}
                      </Td>
                      <Td className="tnum text-right text-muted-foreground">
                        {formatPercent(activity.contribution_percent)}
                      </Td>
                    </Tr>
                  )
                })}
            </tbody>
          </Table>
        ) : (
          <EmptyState title="Belum ada aktivitas" />
        )}
      </Card>
    </>
  )
}
