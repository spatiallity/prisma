import type { Metadata } from 'next'
import { PageHeader, EmptyState } from '@/components/ui/page-header'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Alert } from '@/components/ui/alert'
import { SpkCell } from '@/components/ui/spk-cell'
import { requirePermission } from '@/lib/auth/session'
import { createClient } from '@/lib/supabase/server'
import { DESIGN_STAGES, type DesignStage } from '@/lib/supabase/types'
import { PHASE_LABEL, PHASE_STAGES, PHASE_TERMINAL_STAGE, daysInStage, stageDisplayLabel } from '@/lib/design'
import { DesignStageChart } from '../dashboard/dashboard-charts'

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
    supabase.from('designs').select('id, spk_id, phase, current_stage, approved_at, updated_at').eq('status', 'Active'),
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
  // Opname (siteplan) and Acc PIC Pertamina (finalisasi) are terminal —
  // current_stage sits there forever even once the phase is actually done
  // and approved, so an already-approved design has to be counted
  // separately or it inflates that stage's "still pending" count forever.
  const donePerPhase = { siteplan: 0, finalisasi: 0 }
  const heldDaysPerPhase: Record<'siteplan' | 'finalisasi', number[]> = { siteplan: [], finalisasi: [] }
  const stuck: { id: string; spkId: string; phase: 'siteplan' | 'finalisasi'; stage: DesignStage; days: number }[] = []

  for (const d of designs ?? []) {
    if (d.approved_at !== null) {
      donePerPhase[d.phase]++
      continue
    }
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

  const chartDataPerPhase: Record<'siteplan' | 'finalisasi', { label: string; count: number; hrefStage?: string }[]> = {
    siteplan: [
      { label: 'Draft', count: draftPerPhase.siteplan },
      ...PHASE_STAGES.siteplan.map((s) => ({
        label: stageDisplayLabel(s),
        hrefStage: s,
        count: (perStage.get(s) ?? 0) + (s === PHASE_TERMINAL_STAGE.siteplan ? donePerPhase.siteplan : 0),
      })),
    ],
    finalisasi: [
      { label: 'Draft', count: draftPerPhase.finalisasi },
      ...PHASE_STAGES.finalisasi.map((s) => ({
        label: stageDisplayLabel(s),
        hrefStage: s,
        count: (perStage.get(s) ?? 0) + (s === PHASE_TERMINAL_STAGE.finalisasi ? donePerPhase.finalisasi : 0),
      })),
    ],
  }
  const totalPerPhase = {
    siteplan: chartDataPerPhase.siteplan.reduce((sum, d) => sum + d.count, 0),
    finalisasi: chartDataPerPhase.finalisasi.reduce((sum, d) => sum + d.count, 0),
  }

  return (
    <>
      <PageHeader
        title="Design Queue"
        description="Pantau antrean desain, tahap yang sedang dikerjakan, dan SPK yang perlu segera ditindaklanjuti."
      />

      {error && (
        <Alert tone="danger" className="mb-4" title="Gagal memuat data">
          {error.message}
        </Alert>
      )}

      <div className="mb-5 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <OverviewStat label="Desain aktif" value={designs?.length ?? 0} helper="siteplan + finalisasi" />
        <OverviewStat label="Siteplan" value={totalPerPhase.siteplan} helper={`${donePerPhase.siteplan} sudah opname`} tone="primary" />
        <OverviewStat label="Finalisasi" value={totalPerPhase.finalisasi} helper={`${donePerPhase.finalisasi} sudah acc PIC`} tone="success" />
        <OverviewStat label="Perlu dicek" value={stuck.length} helper="lebih dari 7 hari" tone={stuck.length ? 'danger' : 'neutral'} />
      </div>

      <div className="mb-5 grid gap-5 xl:grid-cols-2">
        {phases.map((phase) => (
          <Card key={phase} className="overflow-hidden">
            <CardHeader>
              <div>
                <CardTitle>
                  {PHASE_LABEL[phase]}{' '}
                  <span className="tnum text-muted-foreground font-bold">({totalPerPhase[phase]})</span>
                </CardTitle>
                <CardDescription>
                  Rata-rata lama di tahap saat ini:{' '}
                  {avg(heldDaysPerPhase[phase]) === null ? '—' : `${avg(heldDaysPerPhase[phase])} hari`}
                </CardDescription>
              </div>
              <Badge tone={phase === 'siteplan' ? 'primary' : 'info'}>{PHASE_LABEL[phase]}</Badge>
            </CardHeader>
            <DesignStageChart data={chartDataPerPhase[phase]} linkBase={`/design/${phase}`} />
          </Card>
        ))}
      </div>

      <Card className="overflow-hidden">
        <CardHeader>
          <div>
            <CardTitle>Perlu ditindaklanjuti</CardTitle>
            <CardDescription>Desain yang belum bergerak lebih dari 7 hari.</CardDescription>
          </div>
          <Badge tone={stuck.length ? 'danger' : 'success'}>{stuck.length}</Badge>
        </CardHeader>
        {stuck.length > 0 ? (
          <ul className="grid gap-3 p-4 sm:grid-cols-2 xl:grid-cols-3">
            {stuck.map((s) => {
              const spk = spkById[s.spkId]
              return (
                <li key={s.id} className="rounded-lg border border-slate-200 bg-slate-50 px-4 py-3">
                  <div className="min-w-0">
                    <SpkCell
                      id={s.spkId}
                      spkNumber={spk?.spk_number ?? 'SPK'}
                      siteCode={spk?.site_code ?? null}
                      href={`/spk/${s.spkId}?tab=design`}
                    />
                    <div className="text-xs text-muted-foreground">
                      {PHASE_LABEL[s.phase]} · {stageDisplayLabel(s.stage)}
                    </div>
                  </div>
                  <div className="tnum mt-3 inline-flex rounded-full bg-danger/10 px-2 py-1 text-xs font-black text-danger">
                    {s.days} hari
                  </div>
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

function OverviewStat({
  label,
  value,
  helper,
  tone = 'neutral',
}: {
  label: string
  value: number
  helper: string
  tone?: 'neutral' | 'primary' | 'success' | 'danger'
}) {
  const toneClass = {
    neutral: 'text-slate-900 bg-slate-100',
    primary: 'text-primary bg-primary-soft',
    success: 'text-success bg-success/10',
    danger: 'text-danger bg-danger/10',
  }[tone]

  return (
    <Card>
      <CardContent className="flex items-center justify-between gap-4 p-4">
        <div>
          <div className="text-[11px] font-extrabold tracking-wider text-slate-500 uppercase">{label}</div>
          <div className="mt-1 text-xs font-semibold text-muted-foreground">{helper}</div>
        </div>
        <div className={`tnum rounded-full px-3 py-1 text-lg font-black ${toneClass}`}>{value}</div>
      </CardContent>
    </Card>
  )
}
