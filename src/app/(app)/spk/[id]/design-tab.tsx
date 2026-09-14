import Link from 'next/link'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { EmptyState } from '@/components/ui/page-header'
import { StepChain, chainBadge, type ChainStep } from '@/components/ui/step-chain'
import { createClient } from '@/lib/supabase/server'
import { cn, formatDateTime } from '@/lib/utils'
import { PHASE_LABEL, PHASE_STAGES, STAGE_ORDER, daysInStage } from '@/lib/design'
import type { DesignPhase } from '@/lib/supabase/types'

/**
 * Section 12 — the Design tab of Detail SPK. Read-only here; the design is
 * driven from /design so one screen owns the workflow.
 *
 * migration 0020 — an SPK can have up to two design records, one per phase
 * (Desain Siteplan and Finalisasi Desain), each opening itself in turn —
 * so this renders one card per record that exists rather than assuming one.
 */
export async function DesignTab({ spkId }: { spkId: string }) {
  const supabase = await createClient()

  const { data: designs } = await supabase
    .from('designs')
    .select('*')
    .eq('spk_id', spkId)
    .eq('status', 'Active')
    .order('phase')

  if (!designs || designs.length === 0) {
    return (
      <Card>
        <CardContent className="p-0">
          <EmptyState
            title="Belum ada record desain"
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

  const designIds = designs.map((d) => d.id)
  const [{ data: revisions }, { data: pics }] = await Promise.all([
    supabase
      .from('design_revisions')
      .select('*')
      .in('design_id', designIds)
      .eq('status', 'Active')
      .order('revision_no', { ascending: false })
      .order('created_at', { ascending: false }),
    supabase.from('design_pics').select('id, full_name'),
  ])

  const picName = new Map((pics ?? []).map((p) => [p.id, p.full_name]))
  const revisionsByDesign = new Map<string, typeof revisions>()
  for (const revision of revisions ?? []) {
    revisionsByDesign.set(revision.design_id, [
      ...(revisionsByDesign.get(revision.design_id) ?? []),
      revision,
    ])
  }

  return (
    <div className="grid gap-5 lg:grid-cols-2">
      {designs.map((design) => {
        const designRevisions = revisionsByDesign.get(design.id) ?? []
        const isDraft = designRevisions.length === 0
        const currentOrder = STAGE_ORDER[design.current_stage]
        const held = daysInStage(design.updated_at)
        const stages = PHASE_STAGES[design.phase as DesignPhase]

        const chainSteps: ChainStep[] = stages.map((stage) => {
          const now = stage === design.current_stage
          const done = STAGE_ORDER[stage] < currentOrder
          const stageRevisions = designRevisions.filter((r) => r.stage === stage)
          return {
            key: stage,
            label: stage,
            state: now ? 'current' : done ? 'done' : 'pending',
            badge: chainBadge(now ? 'current' : done ? 'done' : 'pending', now ? design.current_stage : done ? 'Selesai' : 'Belum'),
            sub:
              stageRevisions.length > 0 ? (
                <ul className="grid gap-1">
                  {stageRevisions.map((revision) => (
                    <li key={revision.id}>
                      Revisi {revision.revision_no} · {formatDateTime(revision.started_at)}
                      <br />
                      {revision.pic_id ? (picName.get(revision.pic_id) ?? '—') : 'PIC belum ditentukan'}
                      {revision.pic_pertamina && ` · Pertamina: ${revision.pic_pertamina}`}
                      {revision.notes && ` · ${revision.notes}`}
                    </li>
                  ))}
                </ul>
              ) : undefined,
          }
        })

        return (
          <Card key={design.id}>
            <CardHeader>
              <div>
                <CardTitle>{PHASE_LABEL[design.phase as DesignPhase]}</CardTitle>
                {design.title && <CardDescription>{design.title}</CardDescription>}
              </div>
              <Link
                href={`/design/${design.id}`}
                className="text-xs font-bold text-primary hover:underline"
              >
                Kelola
              </Link>
            </CardHeader>
            <CardContent>
              {isDraft ? (
                <EmptyState
                  title="Belum dimulai"
                  description={`Menunggu tahap ${design.current_stage} dimulai.`}
                />
              ) : (
                <>
                  <StepChain steps={chainSteps} />

                  <div className="mt-2 flex justify-between gap-3 border-t border-slate-100 pt-3 text-sm">
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
                </>
              )}
            </CardContent>
          </Card>
        )
      })}
    </div>
  )
}
