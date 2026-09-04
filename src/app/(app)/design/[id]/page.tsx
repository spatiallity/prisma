import type { Metadata } from 'next'
import Link from 'next/link'
import { notFound } from 'next/navigation'
import { ArrowLeft, Check } from 'lucide-react'
import { PageHeader, EmptyState } from '@/components/ui/page-header'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { requirePermission } from '@/lib/auth/session'
import { createClient } from '@/lib/supabase/server'
import { can } from '@/lib/auth/permissions'
import { cn, formatDate, formatDateTime } from '@/lib/utils'
import { STAGE_ORDER, STAGE_TONE, STAGE_FILTERS, daysInStage } from '@/lib/design'
import { DeleteRevisionEntryButton, EditRevisionEntryButton, StageReviewForm } from '../forms'

/** The two design-team phases, kept visually separate — see STAGE_FILTERS. */
const PHASE_GROUPS = STAGE_FILTERS.slice(1)

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

  const [{ data: spk }, { data: revisions }, { data: pics }] = await Promise.all([
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
  ])

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
          spk ? `${spk.spk_number}${spk.site_code ? ` · ${spk.site_code}` : ''}` : undefined
        }
        actions={
          <div className="flex items-center gap-2">
            <Badge tone={STAGE_TONE[design.current_stage]}>{design.current_stage}</Badge>
            {spk && (
              <Link
                href={`/spk/${spk.id}`}
                className="text-sm font-bold text-primary hover:underline"
              >
                Buka SPK
              </Link>
            )}
          </div>
        }
      />

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

      {/* Section 21 — two separate rails, one per phase, so a design mid-way
          through Desain Siteplan never reads as "half done overall" — the
          two phases' progress is never blended into one bar. */}
      <Card className="mb-5">
        <CardContent className="grid gap-5 p-5">
          {PHASE_GROUPS.map((phase) => {
            const stages = phase.stages ?? []
            return (
              <div key={phase.key}>
                <div className="mb-2 text-[11px] font-extrabold tracking-wide text-slate-500 uppercase">
                  {phase.label}
                </div>
                <ol className="flex flex-wrap items-center gap-y-3">
                  {stages.map((stage, index) => {
                    const done = reached.has(stage) && STAGE_ORDER[stage] < currentOrder
                    const now = stage === design.current_stage
                    return (
                      <li key={stage} className="flex items-center">
                        <div className="flex items-center gap-2">
                          <span
                            className={cn(
                              'grid h-6 w-6 shrink-0 place-items-center rounded-full border-2 text-[10px] font-extrabold',
                              now
                                ? 'border-primary bg-primary text-white'
                                : done
                                  ? 'border-success bg-success text-white'
                                  : 'border-slate-200 bg-white text-slate-400',
                            )}
                          >
                            {done ? <Check size={12} aria-hidden /> : index + 1}
                          </span>
                          <span
                            className={cn(
                              'text-xs font-bold whitespace-nowrap',
                              now
                                ? 'text-primary'
                                : done
                                  ? 'text-slate-700'
                                  : 'text-slate-400',
                            )}
                          >
                            {stage}
                          </span>
                        </div>
                        {index < stages.length - 1 && (
                          <span
                            className={cn(
                              'mx-3 h-0.5 w-6 rounded-full',
                              done ? 'bg-success' : 'bg-slate-200',
                            )}
                            aria-hidden
                          />
                        )}
                      </li>
                    )
                  })}
                </ol>
              </div>
            )
          })}
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
                        {formatDateTime(revision.started_at)}
                        {revision.completed_at && ` → ${formatDateTime(revision.completed_at)}`}
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
                  {design.current_stage}
                </Badge>
              </div>
              <div className="flex justify-between gap-3">
                <span className="text-muted-foreground">Di tahap ini</span>
                <span
                  className={cn(
                    'tnum font-bold',
                    held !== null && held > 7 && design.current_stage !== 'Submit Peta'
                      ? 'text-danger'
                      : 'text-slate-900',
                  )}
                >
                  {held === null ? '—' : `${held} hari`}
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
                  {design.approved_at ? formatDateTime(design.approved_at) : '—'}
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
  )
}
