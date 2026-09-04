import Link from 'next/link'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { EmptyState } from '@/components/ui/page-header'
import { createClient } from '@/lib/supabase/server'
import { cn, formatDateTime } from '@/lib/utils'
import { STAGE_ORDER, STAGE_TONE, STAGE_FILTERS, daysInStage } from '@/lib/design'

/** The two design-team phases, kept visually separate — see STAGE_FILTERS. */
const PHASE_GROUPS = STAGE_FILTERS.slice(1)

/**
 * Section 12 — the Design tab of Detail SPK. Read-only here; the design is
 * driven from /design so one screen owns the workflow.
 */
export async function DesignTab({ spkId }: { spkId: string }) {
  const supabase = await createClient()

  const { data: design } = await supabase
    .from('designs')
    .select('*')
    .eq('spk_id', spkId)
    .eq('status', 'Active')
    .maybeSingle()

  if (!design) {
    return (
      <Card>
        <CardContent className="p-0">
          <EmptyState
            title="Belum ada record desain"
            description="Buka record desain dari Design Queue untuk mulai melacak tahapannya."
            action={
              <Link
                href="/design"
                className="text-sm font-bold text-primary hover:underline"
              >
                Buka Design Queue
              </Link>
            }
          />
        </CardContent>
      </Card>
    )
  }

  const [{ data: revisions }, { data: pics }] = await Promise.all([
    supabase
      .from('design_revisions')
      .select('*')
      .eq('design_id', design.id)
      .eq('status', 'Active')
      .order('revision_no', { ascending: false })
      .order('created_at', { ascending: false })
      .limit(6),
    supabase.from('design_pics').select('id, full_name'),
  ])

  const picName = new Map((pics ?? []).map((p) => [p.id, p.full_name]))
  const reached = new Set((revisions ?? []).map((r) => r.stage))
  const currentOrder = STAGE_ORDER[design.current_stage]
  const held = daysInStage(design.updated_at)

  return (
    <div className="grid gap-5 lg:grid-cols-3">
      <Card className="lg:col-span-2">
        <CardHeader>
          <div>
            <CardTitle>{design.title ?? 'Desain'}</CardTitle>
            <CardDescription>
              Tanpa penyimpanan file — yang dilacak tahap, PIC, dan lamanya.
            </CardDescription>
          </div>
          <Link
            href={`/design/${design.id}`}
            className="text-xs font-bold text-primary hover:underline"
          >
            Kelola
          </Link>
        </CardHeader>
        <CardContent>
          <div className="mb-5 grid gap-2">
            {PHASE_GROUPS.map((phase) => {
              const stages = phase.stages ?? []
              return (
                <ol key={phase.key} className="flex flex-wrap items-center gap-y-2">
                  {stages.map((stage, index) => {
                    const done = reached.has(stage) && STAGE_ORDER[stage] < currentOrder
                    const now = stage === design.current_stage
                    return (
                      <li key={stage} className="flex items-center">
                        <span
                          className={cn(
                            'rounded-lg px-2 py-0.5 text-[11px] font-bold whitespace-nowrap',
                            now
                              ? 'bg-primary text-white'
                              : done
                                ? 'bg-green-50 text-success'
                                : 'text-slate-400',
                          )}
                        >
                          {stage}
                        </span>
                        {index < stages.length - 1 && (
                          <span className="mx-1 text-slate-300" aria-hidden>
                            ›
                          </span>
                        )}
                      </li>
                    )
                  })}
                </ol>
              )
            })}
          </div>

          {revisions && revisions.length > 0 ? (
            <ul className="divide-y divide-slate-100">
              {revisions.map((revision) => (
                <li key={revision.id} className="py-2.5 first:pt-0">
                  <div className="flex items-center justify-between gap-2">
                    <div className="flex items-center gap-2">
                      <Badge tone={STAGE_TONE[revision.stage]}>{revision.stage}</Badge>
                      <span className="text-xs font-bold text-slate-500">
                        Revisi {revision.revision_no}
                      </span>
                    </div>
                    <span className="tnum text-xs text-muted-foreground">
                      {formatDateTime(revision.started_at)}
                    </span>
                  </div>
                  <div className="mt-0.5 text-xs text-muted-foreground">
                    {revision.pic_id
                      ? (picName.get(revision.pic_id) ?? '—')
                      : 'PIC belum ditentukan'}
                    {revision.notes && ` · ${revision.notes}`}
                  </div>
                </li>
              ))}
            </ul>
          ) : (
            <EmptyState title="Belum ada riwayat tahap" />
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Ringkasan</CardTitle>
        </CardHeader>
        <CardContent className="grid gap-3 text-sm">
          <div className="flex justify-between gap-3">
            <span className="text-muted-foreground">Tahap</span>
            <Badge tone={STAGE_TONE[design.current_stage]}>{design.current_stage}</Badge>
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
            <span className="text-muted-foreground">Disetujui</span>
            <span className="tnum font-bold text-slate-900">
              {design.approved_at ? formatDateTime(design.approved_at) : '—'}
            </span>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
