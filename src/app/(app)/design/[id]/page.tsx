import type { Metadata } from 'next'
import Link from 'next/link'
import { notFound } from 'next/navigation'
import { ArrowLeft, ArrowRight, ExternalLink } from 'lucide-react'
import { PageHeader, EmptyState } from '@/components/ui/page-header'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { linkButtonClass } from '@/components/ui/button'
import { StepChain, chainBadge, type ChainStep } from '@/components/ui/step-chain'
import { requirePermission } from '@/lib/auth/session'
import { createClient } from '@/lib/supabase/server'
import { can } from '@/lib/auth/permissions'
import { cn, formatDate } from '@/lib/utils'
import { PHASE_LABEL, PHASE_STAGES, STAGE_ORDER, STAGE_TONE, daysInStage, stageDisplayLabel } from '@/lib/design'
import {
  DeleteRevisionEntryButton,
  EditRevisionEntryButton,
  StageReviewForm,
  StartDesignForm,
} from '../forms'

export const metadata: Metadata = { title: 'Detail desain' }

/** Whole days between two instants, for the per-stage lead time column. */
function spanDays(from: string | null, to: string | null) {
  if (!from) return null
  const start = new Date(from).getTime()
  const end = to ? new Date(to).getTime() : Date.now()
  if (Number.isNaN(start) || Number.isNaN(end)) return null
  return Math.max(0, Math.round(((end - start) / 86_400_000) * 10) / 10)
}

export default async function DesignDetailPage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const user = await requirePermission('design', 'view')
  const { id } = await params
  const mayEdit = can(user.permissions, 'design', 'edit')

  const supabase = await createClient()
  const { data: design } = await supabase
    .from('designs')
    .select('*')
    .eq('id', id)
    .maybeSingle()

  if (!design) notFound()

  const siblingPhase = design.phase === 'siteplan' ? 'finalisasi' : 'siteplan'

  const [{ data: spk }, { data: revisions }, { data: pics }, { data: sibling }] = await Promise.all([
    supabase
      .from('spks')
      .select('id, spk_number, site_code, work_name')
      .eq('id', design.spk_id)
      .maybeSingle(),
    supabase
      .from('design_revisions')
      .select('*')
      .eq('design_id', id)
      .eq('status', 'Active')
      .order('revision_no', { ascending: true })
      .order('created_at', { ascending: true }),
    supabase.from('design_pics').select('id, full_name').order('full_name'),
    supabase
      .from('designs')
      .select('id')
      .eq('spk_id', design.spk_id)
      .eq('phase', siblingPhase)
      .eq('status', 'Active')
      .maybeSingle(),
  ])

  const isDraft = (revisions?.length ?? 0) === 0

  const entryIds = (revisions ?? []).map((r) => r.id)
  const { data: rounds } = entryIds.length
    ? await supabase
        .from('design_stage_revisions')
        .select('*')
        .in('design_revision_id', entryIds)
        .order('created_at')
    : { data: [] }
  const roundsByEntry = new Map<string, typeof rounds>()
  for (const round of rounds ?? []) {
    roundsByEntry.set(round.design_revision_id, [
      ...(roundsByEntry.get(round.design_revision_id) ?? []),
      round,
    ])
  }

  const picName = new Map((pics ?? []).map((p) => [p.id, p.full_name]))
  const reached = new Set((revisions ?? []).map((r) => r.stage))
  const currentOrder = STAGE_ORDER[design.current_stage]
  const held = daysInStage(design.updated_at)
  const roundCount = Math.max(0, ...(revisions ?? []).map((r) => r.revision_no))
  const latestRevisionId = revisions?.[revisions.length - 1]?.id
  const picOptions = (pics ?? []).map((p) => ({ id: p.id, label: p.full_name }))

  // The stage the design is sitting in — the entry that never closed. Its
  // revision rounds are what "Revisi ke-N" counts, exactly as routing does.
  const currentEntry = (revisions ?? []).find((r) => !r.completed_at) ?? null
  const currentRounds = currentEntry
    ? (roundsByEntry.get(currentEntry.id) ?? []).length
    : 0
  const stagesDone = (revisions ?? []).filter((r) => r.completed_at).length
  const totalDays = (revisions ?? []).reduce(
    (sum, r) => sum + (spanDays(r.started_at, r.completed_at) ?? 0),
    0,
  )
  const picPertamina = currentEntry?.pic_pertamina ?? null

  return (
    <>
      <Link
        href="/design"
        className="mb-4 inline-flex items-center gap-1.5 text-sm font-semibold text-muted-foreground hover:text-primary"
      >
        <ArrowLeft size={16} aria-hidden />
        Kembali ke Design Queue
      </Link>

      <PageHeader
        title={design.title ?? spk?.work_name ?? 'Desain'}
        description={
          [
            PHASE_LABEL[design.phase],
            spk ? `${spk.spk_number}${spk.site_code ? ` · ${spk.site_code}` : ''}` : null,
          ]
            .filter(Boolean)
            .join(' · ') || undefined
        }
        actions={
          <div className="flex items-center gap-2">
            {isDraft ? (
              <Badge tone="neutral">Draft</Badge>
            ) : (
              <Badge tone={STAGE_TONE[design.current_stage]}>{stageDisplayLabel(design.current_stage)}</Badge>
            )}
            {sibling && (
              <Link href={`/design/${sibling.id}`} className={linkButtonClass}>
                {PHASE_LABEL[siblingPhase]}
                <ArrowRight size={16} aria-hidden />
              </Link>
            )}
            {spk && (
              <Link
                href={`/spk/${spk.id}`}
                className="inline-flex h-10 items-center justify-center gap-2 rounded-lg border border-slate-300 bg-white px-4 text-sm font-semibold text-slate-700 transition-all duration-200 hover:bg-surface-muted hover:border-slate-400"
              >
                Buka SPK
                <ExternalLink size={16} aria-hidden />
              </Link>
            )}
          </div>
        }
      />

      {isDraft ? (
        <Card>
          <CardHeader>
            <div>
              <CardTitle>Belum dimulai</CardTitle>
              <CardDescription>
                {PHASE_LABEL[design.phase]} terbuka otomatis, menunggu tahap{' '}
                {design.current_stage} dimulai.
              </CardDescription>
            </div>
          </CardHeader>
          <CardContent>
            {mayEdit ? (
              <StartDesignForm
                designId={design.id}
                phase={design.phase}
                currentStage={design.current_stage}
                pics={(pics ?? []).map((p) => ({ id: p.id, label: p.full_name }))}
              />
            ) : (
              <EmptyState title="Belum ada yang mengerjakan" />
            )}
          </CardContent>
        </Card>
      ) : (
      <>
      <div className="mb-5 grid gap-4 sm:grid-cols-3">
        <Card>
          <CardContent className="p-4">
            <div className="text-[11px] font-extrabold tracking-wider text-slate-500 uppercase">
              Tahap selesai
            </div>
            <div className="tnum mt-1 text-2xl font-black text-slate-900">
              {stagesDone}/{revisions?.length ?? 0}
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="text-[11px] font-extrabold tracking-wider text-slate-500 uppercase">
              Lead time terpakai
            </div>
            <div className="tnum mt-1 text-2xl font-black text-slate-900">
              {Math.round(totalDays * 10) / 10} hari
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="text-[11px] font-extrabold tracking-wider text-slate-500 uppercase">
              Posisi sekarang
            </div>
            <div className="mt-1 truncate text-lg font-black text-slate-900">
              {design.current_stage}
            </div>
            <div className="text-xs text-muted-foreground">
              {currentRounds > 0 ? `Revisi ke-${currentRounds}` : 'Submission pertama'}
              {currentEntry?.started_at && ` · mulai ${formatDate(currentEntry.started_at)}`}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Section 21 — one rail, this record's own phase. A design never
          crosses phases itself, so there's nothing to blend into one bar —
          the sibling phase (if it exists yet) is its own separate record,
          linked above. */}
      <Card className="mb-5">
        <CardHeader>
          <CardTitle>{PHASE_LABEL[design.phase]}</CardTitle>
        </CardHeader>
        <CardContent>
          <StepChain
            steps={PHASE_STAGES[design.phase].map((stage): ChainStep => {
              const done = reached.has(stage) && STAGE_ORDER[stage] < currentOrder
              const now = stage === design.current_stage
              const state = now ? 'current' : done ? 'done' : 'pending'
              return {
                key: stage,
                label: stage,
                state,
                badge: chainBadge(state),
              }
            })}
          />
        </CardContent>
      </Card>

      <div className="grid gap-5 lg:grid-cols-3">
        <Card className="lg:col-span-2">
          <CardHeader>
            <div>
              <CardTitle>Riwayat tahap</CardTitle>
              <CardDescription>
                Setiap perpindahan menutup tahap sebelumnya, sehingga lama tiap
                tahap terukur.
              </CardDescription>
            </div>
            <Badge tone="neutral">{roundCount} putaran tahap</Badge>
          </CardHeader>
          <CardContent className="p-0">
            {revisions && revisions.length > 0 ? (
              <ul className="divide-y divide-slate-100">
                {[...revisions].reverse().map((revision) => {
                  const duration = spanDays(revision.started_at, revision.completed_at)
                  const open = !revision.completed_at
                  return (
                    <li key={revision.id} className="px-5 py-3.5">
                      <div className="flex flex-wrap items-center justify-between gap-2">
                        <div className="flex items-center gap-2">
                          <Badge tone={STAGE_TONE[revision.stage]}>{revision.stage}</Badge>
                          <span className="text-xs font-bold text-slate-500">
                            Revisi {revision.revision_no}
                          </span>
                          {open && <Badge tone="primary">berjalan</Badge>}
                        </div>
                        <div className="flex items-center gap-3">
                          <span
                            className={cn(
                              'tnum text-xs font-bold',
                              open && duration !== null && duration > 7
                                ? 'text-danger'
                                : 'text-muted-foreground',
                            )}
                          >
                            {duration === null ? '—' : `${duration} hari`}
                          </span>
                          {mayEdit && (
                            <div className="flex items-center gap-2">
                              <EditRevisionEntryButton
                                designId={design.id}
                                pics={picOptions}
                                entry={revision}
                              />
                              {revision.id === latestRevisionId && (
                                <DeleteRevisionEntryButton
                                  designId={design.id}
                                  entryId={revision.id}
                                />
                              )}
                            </div>
                          )}
                        </div>
                      </div>
                      <div className="mt-1 text-xs text-muted-foreground">
                        {revision.pic_id
                          ? (picName.get(revision.pic_id) ?? 'PIC tidak dikenal')
                          : 'PIC belum ditentukan'}
                        {revision.pic_pertamina && ` · Pertamina: ${revision.pic_pertamina}`}
                        {' · '}
                        {formatDate(revision.started_at)}
                        {revision.completed_at && ` → ${formatDate(revision.completed_at)}`}
                      </div>
                      {revision.notes && (
                        <p className="mt-1.5 text-sm text-slate-700">{revision.notes}</p>
                      )}
                      {(roundsByEntry.get(revision.id) ?? []).length > 0 && (
                        <ul className="mt-2 grid gap-1.5 border-l-2 border-warning/40 pl-3">
                          {(roundsByEntry.get(revision.id) ?? []).map((round, i) => (
                            <li key={round.id} className="text-xs">
                              <span className="font-bold text-warning">Revisi {i + 1}</span>{' '}
                              <span className="text-slate-700">{round.note}</span>
                              <span className="text-muted-foreground">
                                {' '}
                                · disubmit ulang {formatDate(round.resubmit_at)}
                              </span>
                            </li>
                          ))}
                        </ul>
                      )}
                    </li>
                  )
                })}
              </ul>
            ) : (
              <EmptyState title="Belum ada riwayat tahap" />
            )}
          </CardContent>
        </Card>

        <div className="grid content-start gap-5">
          <Card>
            <CardHeader>
              <CardTitle>Ringkasan</CardTitle>
            </CardHeader>
            <CardContent className="grid gap-3 text-sm">
              <div className="flex justify-between gap-3">
                <span className="text-muted-foreground">Tahap sekarang</span>
                <Badge tone={STAGE_TONE[design.current_stage]}>
                  {stageDisplayLabel(design.current_stage)}
                </Badge>
              </div>
              <div className="flex justify-between gap-3">
                <span className="text-muted-foreground">Di tahap ini</span>
                <span
                  className={cn(
                    'tnum font-bold',
                    held !== null && held > 7 && design.current_stage !== 'Acc PIC Pertamina'
                      ? 'text-danger'
                      : 'text-slate-900',
                  )}
                >
                  {held === null ? '—' : `${held} hari`}
                </span>
              </div>
              <div className="flex justify-between gap-3">
                <span className="text-muted-foreground">Data topografi masuk</span>
                <span className="tnum font-bold text-slate-900">
                  {design.topo_data_received_at ? formatDate(design.topo_data_received_at) : '—'}
                </span>
              </div>
              <div className="flex justify-between gap-3">
                <span className="text-muted-foreground">PIC</span>
                <span className="font-bold text-slate-900">
                  {design.pic_id ? (picName.get(design.pic_id) ?? '—') : '—'}
                </span>
              </div>
              <div className="flex justify-between gap-3">
                <span className="text-muted-foreground">PIC Pertamina</span>
                <span className="font-bold text-slate-900">{picPertamina ?? '—'}</span>
              </div>
              <div className="flex justify-between gap-3">
                <span className="text-muted-foreground">Putaran tahap ini</span>
                <span className="font-bold text-slate-900">
                  {currentRounds > 0 ? `Revisi ke-${currentRounds}` : 'Submission pertama'}
                </span>
              </div>
              <div className="flex justify-between gap-3">
                <span className="text-muted-foreground">Disetujui</span>
                <span className="tnum font-bold text-slate-900">
                  {design.approved_at ? formatDate(design.approved_at) : '—'}
                </span>
              </div>
            </CardContent>
          </Card>

          {mayEdit && (
            <Card>
              <CardHeader>
                <div>
                  <CardTitle>Review</CardTitle>
                  <CardDescription>{design.current_stage}</CardDescription>
                </div>
              </CardHeader>
              <CardContent>
                <StageReviewForm
                  designId={design.id}
                  entryId={currentEntry?.id ?? null}
                  phase={design.phase}
                  currentStage={design.current_stage}
                  pics={picOptions}
                  defaultPicPertamina={picPertamina}
                />
              </CardContent>
            </Card>
          )}
        </div>
      </div>
      </>
      )}
    </>
  )
}
