import type { Metadata } from 'next'
import { PageHeader, EmptyState } from '@/components/ui/page-header'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Alert } from '@/components/ui/alert'
import { SpkCell } from '@/components/ui/spk-cell'
import { requirePermission } from '@/lib/auth/session'
import { createClient } from '@/lib/supabase/server'
import { DESIGN_STAGES } from '@/lib/supabase/types'
import { PHASE_LABEL, PHASE_STAGES, daysInStage } from '@/lib/design'

export const metadata: Metadata = { title: 'Design Queue' }

/**
 * Design Queue is the overview: how many designs sit in each stage of each
 * phase, and which ones haven't moved in a while. The two phases have their
 * own list pages (Desain Siteplan, Finalisasi Desain) for actually working a
 * design — this page is read-only statistics.
 */
export default async function DesignQueuePage() {
  await requirePermission('design', 'view')
  const supabase = await createClient()

  const [{ data: designs, error }, { data: spks }] = await Promise.all([
    supabase.from('designs').select('id, spk_id, phase, current_stage, updated_at').eq('status', 'Active'),
    supabase.from('spks').select('id, spk_number, site_code'),
  ])

  const spkById = Object.fromEntries((spks ?? []).map((s) => [s.id, s]))

  const designIds = (designs ?? []).map((d) => d.id)
  const { data: openEntries } = designIds.length
    ? await supabase
        .from('design_revisions')
        .select('design_id, started_at')
        .in('design_id', designIds)
        .eq('status', 'Active')
        .is('completed_at', null)
    : { data: [] }
  const startedDesignIds = new Set((openEntries ?? []).map((e) => e.design_id))

  const perStage = new Map(DESIGN_STAGES.map((s) => [s, 0]))
  const draftPerPhase = { siteplan: 0, finalisasi: 0 }
  const heldDaysPerPhase: Record<'siteplan' | 'finalisasi', number[]> = { siteplan: [], finalisasi: [] }
  const stuck: { id: string; spkId: string; phase: 'siteplan' | 'finalisasi'; stage: string; days: number }[] = []

  for (const d of designs ?? []) {
    if (startedDesignIds.has(d.id)) {
      perStage.set(d.current_stage, (perStage.get(d.current_stage) ?? 0) + 1)
      const held = daysInStage(d.updated_at)
      if (held !== null) {
        heldDaysPerPhase[d.phase].push(held)
        if (held > 7) stuck.push({ id: d.id, spkId: d.spk_id, phase: d.phase, stage: d.current_stage, days: held })
      }
    } else {
      draftPerPhase[d.phase]++
    }
  }
  stuck.sort((a, b) => b.days - a.days)

  const avg = (values: number[]) =>
    values.length ? Math.round(values.reduce((sum, v) => sum + v, 0) / values.length) : null

  const phases: ('siteplan' | 'finalisasi')[] = ['siteplan', 'finalisasi']

  return (
    <>
      <PageHeader title="Design Queue" />

      {error && (
        <Alert tone="danger" className="mb-4" title="Gagal memuat data">
          {error.message}
        </Alert>
      )}

      {phases.map((phase) => (
        <div key={phase} className="mb-5">
          <h2 className="mb-2 text-xs font-extrabold tracking-wide text-slate-500 uppercase">
            {PHASE_LABEL[phase]}
          </h2>
          <div className="grid gap-4 sm:grid-cols-3 lg:grid-cols-6">
            <Card className="border-dashed">
              <CardContent className="p-4">
                <div className="truncate text-[11px] font-extrabold tracking-wider text-slate-500 uppercase">
                  Draft
                </div>
                <div className="tnum mt-1 text-2xl font-black text-slate-900">
                  {draftPerPhase[phase]}
                </div>
              </CardContent>
            </Card>
            {PHASE_STAGES[phase].map((s) => (
              <Card key={s}>
                <CardContent className="p-4">
                  <div className="truncate text-[11px] font-extrabold tracking-wider text-slate-500 uppercase">
                    {s}
                  </div>
                  <div className="tnum mt-1 text-2xl font-black text-slate-900">
                    {perStage.get(s) ?? 0}
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
          <p className="mt-2 text-xs font-semibold text-muted-foreground">
            Rata-rata lama di tahap saat ini:{' '}
            {avg(heldDaysPerPhase[phase]) === null ? '—' : `${avg(heldDaysPerPhase[phase])} hari`}
          </p>
        </div>
      ))}

      <Card className="overflow-hidden">
        <CardHeader>
          <CardTitle>Desain yang lama tidak bergerak (&gt;7 hari)</CardTitle>
        </CardHeader>
        {stuck.length > 0 ? (
          <ul className="divide-y divide-slate-100">
            {stuck.map((s) => {
              const spk = spkById[s.spkId]
              return (
                <li key={s.id} className="flex items-center justify-between gap-3 px-5 py-3">
                  <div className="min-w-0">
                    <SpkCell
                      id={s.id}
                      spkNumber={spk?.spk_number ?? 'SPK'}
                      siteCode={spk?.site_code ?? null}
                      href={`/design/${s.id}`}
                    />
                    <div className="text-xs text-muted-foreground">
                      {PHASE_LABEL[s.phase]} — {s.stage}
                    </div>
                  </div>
                  <span className="tnum shrink-0 text-sm font-bold text-danger">{s.days} hari</span>
                </li>
              )
            })}
          </ul>
        ) : (
          <EmptyState title="Tidak ada desain yang stuck" description="Semua desain masih bergerak dalam 7 hari terakhir." />
        )}
      </Card>
    </>
  )
}
