import Link from 'next/link'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Table, Td, Th, Tr } from '@/components/ui/table'
import { EmptyState } from '@/components/ui/page-header'
import { Alert } from '@/components/ui/alert'
import { createClient } from '@/lib/supabase/server'
import { MEASUREMENT_LABEL, STAGE_TONE, formatMeasure } from '@/lib/progress'
import { formatPercent } from '@/lib/spk'
import { ApplyTemplateForm, AddActivityForm } from '../progress-forms'

/**
 * Section 13–15 — the activity list with its weights, and the contribution of
 * each activity to Overall Progress. Every percentage here comes from the
 * database view, never from a field anyone typed.
 */
export async function ProgressTab({
  spkId,
  activityTemplateId,
  mayEdit,
}: {
  spkId: string
  activityTemplateId: string | null
  mayEdit: boolean
}) {
  const supabase = await createClient()

  const [{ data: activities, error }, { data: templates }] = await Promise.all([
    supabase
      .from('v_spk_activity_progress')
      .select('*')
      .eq('spk_id', spkId)
      .order('sequence'),
    supabase
      .from('activity_templates')
      .select('id, name, code')
      .eq('status', 'Active')
      .order('code'),
  ])

  const totalWeight = (activities ?? []).reduce((sum, a) => sum + Number(a.weight), 0)
  const overall = (activities ?? []).reduce(
    (sum, a) => sum + Number(a.contribution_percent),
    0,
  )

  return (
    <div className="grid gap-5">
      {error && (
        <Alert tone="danger" title="Gagal memuat aktivitas">
          {error.message}
        </Alert>
      )}

      {(!activities || activities.length === 0) && (
        <Card>
          <CardHeader>
            <div>
              <CardTitle>Belum ada aktivitas</CardTitle>
              <CardDescription>
                Terapkan Progress Template (Section 17) untuk membuat daftar
                aktivitas beserta bobotnya sekaligus.
              </CardDescription>
            </div>
          </CardHeader>
          <CardContent>
            {mayEdit ? (
              <ApplyTemplateForm
                spkId={spkId}
                templates={(templates ?? []).map((t) => ({
                  id: t.id,
                  label: `${t.name} (${t.code})`,
                }))}
                defaultTemplateId={activityTemplateId}
              />
            ) : (
              <EmptyState
                title="Belum ada aktivitas"
                description="Role Anda tidak punya izin edit progress."
              />
            )}
          </CardContent>
        </Card>
      )}

      {activities && activities.length > 0 && (
        <Card className="overflow-hidden">
          <CardHeader>
            <div>
              <CardTitle>Aktivitas &amp; bobot</CardTitle>
              <CardDescription>
                Overall Progress = Σ (progress aktivitas × bobot). Dihitung
                database, tidak pernah diketik.
              </CardDescription>
            </div>
            <div className="text-right">
              <div className="text-[11px] font-extrabold tracking-wider text-slate-500 uppercase">
                Total bobot
              </div>
              <div className="tnum text-lg font-black text-slate-900">
                {formatPercent(totalWeight)}
              </div>
            </div>
          </CardHeader>

          <Table>
            <thead>
              <tr>
                <Th className="w-10 text-right">#</Th>
                <Th>Aktivitas</Th>
                <Th>Pengukuran</Th>
                <Th className="text-right">Bobot</Th>
                <Th className="text-right">Aktual / Target</Th>
                <Th className="text-right">Progress</Th>
                <Th className="text-right">Kontribusi</Th>
              </tr>
            </thead>
            <tbody>
              {activities.map((activity) => (
                <Tr key={activity.spk_activity_id}>
                  <Td className="tnum text-right text-muted-foreground">
                    {activity.sequence}
                  </Td>
                  <Td>
                    <Link
                      href={`/spk/${spkId}/progress/${activity.spk_activity_id}`}
                      className="font-bold text-primary hover:underline"
                    >
                      {activity.name}
                    </Link>
                  </Td>
                  <Td>
                    {activity.measurement === 'stage' ? (
                      <Badge tone={STAGE_TONE[activity.current_stage]}>
                        {MEASUREMENT_LABEL[activity.measurement]}
                      </Badge>
                    ) : (
                      <Badge>{MEASUREMENT_LABEL[activity.measurement]}</Badge>
                    )}
                  </Td>
                  <Td className="tnum text-right">{formatPercent(activity.weight)}</Td>
                  <Td className="tnum text-right text-muted-foreground">
                    {formatMeasure(
                      activity.measurement,
                      Number(activity.current_value),
                      activity.target_value === null ? null : Number(activity.target_value),
                      activity.current_stage,
                      activity.unit,
                    )}
                  </Td>
                  <Td className="text-right">
                    <div className="flex items-center justify-end gap-2">
                      <div className="h-1.5 w-16 overflow-hidden rounded-full bg-slate-100">
                        <div
                          className="h-full rounded-full bg-primary"
                          style={{
                            width: `${Math.min(Math.max(Number(activity.progress_percent), 0), 100)}%`,
                          }}
                        />
                      </div>
                      <span className="tnum w-14 font-bold">
                        {formatPercent(activity.progress_percent)}
                      </span>
                    </div>
                  </Td>
                  <Td className="tnum text-right font-bold text-slate-900">
                    {formatPercent(activity.contribution_percent)}
                  </Td>
                </Tr>
              ))}
            </tbody>
            <tfoot>
              <tr className="bg-surface-muted">
                <Td colSpan={6} className="text-right text-xs font-extrabold tracking-wider text-slate-500 uppercase">
                  Overall Progress
                </Td>
                <Td className="tnum text-right text-base font-black text-primary">
                  {formatPercent(overall)}
                </Td>
              </tr>
            </tfoot>
          </Table>
        </Card>
      )}

      {mayEdit && activities && activities.length > 0 && (
        <Card>
          <CardHeader>
            <div>
              <CardTitle>Tambah aktivitas</CardTitle>
              <CardDescription>
                Untuk pekerjaan di luar template. Total bobot tetap dijaga ≤ 100%
                oleh database.
              </CardDescription>
            </div>
          </CardHeader>
          <CardContent>
            <AddActivityForm spkId={spkId} />
          </CardContent>
        </Card>
      )}
    </div>
  )
}
