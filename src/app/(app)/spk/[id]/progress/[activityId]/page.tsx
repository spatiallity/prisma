import type { Metadata } from 'next'
import Link from 'next/link'
import { notFound } from 'next/navigation'
import { ArrowLeft } from 'lucide-react'
import { PageHeader, EmptyState } from '@/components/ui/page-header'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Table, Td, Th, Tr } from '@/components/ui/table'
import { Badge } from '@/components/ui/badge'
import { requirePermission } from '@/lib/auth/session'
import { createClient } from '@/lib/supabase/server'
import { can } from '@/lib/auth/permissions'
import { formatDate, formatDateTime } from '@/lib/utils'
import { formatPercent } from '@/lib/spk'
import { MEASUREMENT_HINT, MEASUREMENT_LABEL, STAGE_TONE, formatMeasure } from '@/lib/progress'
import {
  DeleteProgressEntryButton,
  EditProgressEntryButton,
  EditTargetForm,
  RecordProgressForm,
} from '../../../progress-forms'

export const metadata: Metadata = { title: 'Progress aktivitas' }

/** Section 16 — Progress History: every update, with who recorded it and when. */
export default async function ActivityProgressPage({
  params,
}: {
  params: Promise<{ id: string; activityId: string }>
}) {
  const user = await requirePermission('progress', 'view')
  const { id: spkId, activityId } = await params

  const supabase = await createClient()

  const [{ data: activity }, { data: spk }] = await Promise.all([
    supabase.from('spk_activities').select('*').eq('id', activityId).maybeSingle(),
    supabase.from('spks').select('id, spk_number, work_name').eq('id', spkId).maybeSingle(),
  ])

  if (!activity || !spk || activity.spk_id !== spkId) notFound()

  // A vendor's progress-edit window closes once Desain Siteplan starts — the
  // design team takes over from there (spk_progress_editable() enforces the
  // same cutoff at the database level).
  let mayEdit = can(user.permissions, 'progress', 'edit')
  if (mayEdit && user.vendorId) {
    const { data: designActivities } = await supabase
      .from('spk_activities')
      .select('current_stage')
      .eq('spk_id', spkId)
      .in('name', [
        'Desain Siteplan',
        'Pembuatan Desain Awal',
        'Review Desain Awal',
        'Revisi Desain Awal',
        'Pembuatan Peta Inventaris dan Stake Out',
      ])
    if (designActivities?.some((a) => a.current_stage !== 'Belum Mulai')) {
      mayEdit = false
    }
  }

  // Target editing takes the same dual path as spk_activities' RLS: an
  // internal spk:edit holder always can (structural, not progress); a
  // vendor only through progress:edit, so still gated by the cutoff above.
  const mayEditTarget =
    (can(user.permissions, 'spk', 'edit') || mayEdit) &&
    (activity.measurement === 'quantity' || activity.measurement === 'area')

  const { data: history } = await supabase
    .from('activity_progress')
    .select('*')
    .eq('spk_activity_id', activityId)
    .order('progress_date', { ascending: false })
    .order('created_at', { ascending: false })

  const actorIds = [
    ...new Set((history ?? []).map((entry) => entry.recorded_by).filter(Boolean)),
  ] as string[]

  const { data: actors } = actorIds.length
    ? await supabase.from('users').select('id, full_name').in('id', actorIds)
    : { data: [] }

  const actorName = new Map((actors ?? []).map((a) => [a.id, a.full_name]))

  return (
    <>
      <Link
        href={`/spk/${spkId}?tab=progress`}
        className="mb-4 inline-flex items-center gap-1.5 text-sm font-semibold text-muted-foreground hover:text-primary"
      >
        <ArrowLeft size={16} aria-hidden />
        Kembali ke Progress {spk.spk_number}
      </Link>

      <PageHeader
        title={activity.name}
        description={`${spk.spk_number} — ${spk.work_name}`}
        actions={
          <div className="text-right">
            <div className="text-[11px] font-extrabold tracking-wider text-slate-500 uppercase">
              Progress
            </div>
            <div className="tnum text-2xl font-black text-primary">
              {formatPercent(activity.progress_percent)}
            </div>
          </div>
        }
      />

      <div className="grid gap-5 lg:grid-cols-3">
        <Card className="lg:col-span-2">
          <CardHeader>
            <div>
              <CardTitle>Riwayat progress</CardTitle>
              <CardDescription>
                Entri bertanda <em>daily_progress</em> berasal dari Daily Progress.
              </CardDescription>
            </div>
          </CardHeader>
          <CardContent className="p-0">
            {history && history.length > 0 ? (
              <Table>
                <thead>
                  <tr>
                    <Th>Tanggal</Th>
                    <Th className="text-right">Nilai</Th>
                    <Th>Sumber</Th>
                    <Th>Dicatat oleh</Th>
                    <Th>Catatan</Th>
                    {mayEdit && <Th className="text-right">Aksi</Th>}
                  </tr>
                </thead>
                <tbody>
                  {history.map((entry) => (
                    <Tr key={entry.id}>
                      <Td className="tnum whitespace-nowrap font-semibold">
                        {formatDate(entry.progress_date)}
                        <div className="text-xs font-normal text-muted-foreground">
                          {formatDateTime(entry.created_at)}
                        </div>
                      </Td>
                      <Td className="tnum text-right">
                        {activity.measurement === 'stage'
                          ? (entry.stage ?? '—')
                          : (entry.actual_value ?? '—')}
                      </Td>
                      <Td>
                        <Badge tone={entry.source === 'manual' ? 'neutral' : 'info'}>
                          {entry.source}
                        </Badge>
                      </Td>
                      <Td className="text-muted-foreground">
                        {entry.recorded_by
                          ? (actorName.get(entry.recorded_by) ?? 'Tidak dikenal')
                          : '—'}
                      </Td>
                      <Td className="max-w-xs text-muted-foreground">
                        {entry.notes ?? '—'}
                      </Td>
                      {mayEdit && (
                        <Td className="text-right whitespace-nowrap">
                          {entry.source === 'manual' ? (
                            <div className="flex justify-end gap-3">
                              <EditProgressEntryButton
                                spkId={spkId}
                                activityId={activity.id}
                                measurement={activity.measurement}
                                unit={activity.unit}
                                targetValue={
                                  activity.target_value === null
                                    ? null
                                    : Number(activity.target_value)
                                }
                                entry={entry}
                              />
                              <DeleteProgressEntryButton
                                spkId={spkId}
                                activityId={activity.id}
                                entryId={entry.id}
                              />
                            </div>
                          ) : (
                            <span className="text-xs text-muted-foreground">
                              via Daily Progress
                            </span>
                          )}
                        </Td>
                      )}
                    </Tr>
                  ))}
                </tbody>
              </Table>
            ) : (
              <EmptyState
                title="Belum ada riwayat"
                description="Catat progress pertama untuk aktivitas ini."
              />
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Aktivitas</CardTitle>
          </CardHeader>
          <CardContent className="grid gap-3 text-sm">
            <div className="flex justify-between gap-3">
              <span className="text-muted-foreground">Bobot</span>
              <span className="tnum font-bold">{formatPercent(activity.weight)}</span>
            </div>
            <div className="flex justify-between gap-3">
              <span className="text-muted-foreground">Pengukuran</span>
              <Badge
                tone={
                  activity.measurement === 'stage'
                    ? STAGE_TONE[activity.current_stage]
                    : 'neutral'
                }
              >
                {MEASUREMENT_LABEL[activity.measurement]}
              </Badge>
            </div>
            <div className="flex justify-between gap-3">
              <span className="text-muted-foreground">Aktual / target</span>
              <span className="tnum font-bold">
                {formatMeasure(
                  activity.measurement,
                  Number(activity.current_value),
                  activity.target_value === null ? null : Number(activity.target_value),
                  activity.current_stage,
                  activity.unit,
                )}
              </span>
            </div>
            <div className="flex justify-between gap-3">
              <span className="text-muted-foreground">Kontribusi</span>
              <span className="tnum font-bold">
                {formatPercent(
                  (Number(activity.progress_percent) * Number(activity.weight)) / 100,
                )}
              </span>
            </div>
            <p className="mt-1 rounded-lg border border-slate-200 bg-surface-muted p-3 text-xs text-muted-foreground">
              {MEASUREMENT_HINT[activity.measurement]}
            </p>
          </CardContent>
        </Card>
      </div>

      {mayEditTarget && (
        <Card className="mt-5">
          <CardHeader>
            <div>
              <CardTitle>Target</CardTitle>
              <CardDescription>
                {activity.target_value === null
                  ? 'Belum ada target — isi supaya persentase progress bisa dihitung.'
                  : 'Ubah target aktivitas ini.'}
              </CardDescription>
            </div>
          </CardHeader>
          <CardContent>
            <EditTargetForm
              spkId={spkId}
              activityId={activity.id}
              unit={activity.unit}
              targetValue={
                activity.target_value === null ? null : Number(activity.target_value)
              }
            />
          </CardContent>
        </Card>
      )}

      {mayEdit && (
        <Card className="mt-5">
          <CardHeader>
            <div>
              <CardTitle>Catat progress</CardTitle>
              <CardDescription>
                Isi angka kumulatif per tanggal. Persentase dihitung sistem.
              </CardDescription>
            </div>
          </CardHeader>
          <CardContent>
            <RecordProgressForm
              spkId={spkId}
              activityId={activity.id}
              measurement={activity.measurement}
              unit={activity.unit}
              targetValue={
                activity.target_value === null ? null : Number(activity.target_value)
              }
            />
          </CardContent>
        </Card>
      )}
    </>
  )
}
