'use client'

import { useState } from 'react'
import { Pencil } from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { EmptyState } from '@/components/ui/page-header'
import { StepChain, chainBadge, type ChainStep } from '@/components/ui/step-chain'
import { DesignDetailModal } from '../../design/design-detail-modal'
import { cn, formatDate } from '@/lib/utils'
import { PHASE_LABEL, PHASE_STAGES, daysInStage, stageDisplayLabel } from '@/lib/design'
import type { DesignPhase, DesignStage } from '@/lib/supabase/types'
import type { PicOption } from '../../design/forms'

type DesignRow = {
  id: string
  phase: DesignPhase
  current_stage: DesignStage
  title: string | null
  updated_at: string
  approved_at: string | null
}
type Revision = {
  id: string
  stage: string
  revision_no: number
  pic_id: string | null
  pic_pertamina: string | null
  started_at: string | null
  completed_at: string | null
  notes: string | null
}

export function DesignTabCards({
  designs,
  revisionsByDesign,
  picName,
  pics,
  mayEdit,
}: {
  designs: DesignRow[]
  revisionsByDesign: Record<string, Revision[]>
  picName: Record<string, string>
  pics: PicOption[]
  mayEdit: boolean
}) {
  const [openId, setOpenId] = useState<string | null>(null)
  const openDesign = designs.find((d) => d.id === openId) ?? null

  return (
    <>
      <div className="grid gap-5 lg:grid-cols-2">
        {designs.map((design) => {
          const designRevisions = revisionsByDesign[design.id] ?? []
          const isDraft = designRevisions.length === 0
          const isComplete = Boolean(design.approved_at)
          const held = daysInStage(design.updated_at)
          const stages = PHASE_STAGES[design.phase]
          const currentIndex = stages.indexOf(design.current_stage)

          const chainSteps: ChainStep[] = stages.map((stage, index) => {
            const stageRevisions = designRevisions.filter((r) => r.stage === stage)
            const latestRevision = stageRevisions[0]
            const inferredDone = !isDraft && index < currentIndex
            const now = stage === design.current_stage && !isComplete
            const done =
              !now &&
              (inferredDone ||
                (stage === design.current_stage && Boolean(design.approved_at || latestRevision?.completed_at)))
            return {
              key: stage,
              label: stageDisplayLabel(stage),
              state: now ? 'current' : done ? 'done' : 'pending',
              badge: chainBadge(now ? 'current' : done ? 'done' : 'pending', now ? stageDisplayLabel(design.current_stage) : undefined),
              sub:
                stageRevisions.length > 0 ? (
                  <ul className="grid gap-2">
                    {stageRevisions.map((revision) => (
                      <li key={revision.id}>
                        <div className="font-semibold text-slate-700">Revisi {revision.revision_no}</div>
                        <div className="mt-0.5">
                          {revision.pic_id ? (picName[revision.pic_id] ?? '—') : 'PIC belum ditentukan'}
                          {revision.pic_pertamina && ` · Pertamina: ${revision.pic_pertamina}`}
                        </div>
                        {(revision.started_at || revision.completed_at) && (
                          <div className="mt-1.5 flex flex-wrap gap-1.5">
                            {revision.started_at && (
                              <span className="rounded-md bg-primary-soft px-2 py-0.5 font-bold text-primary">
                                Mulai {formatDate(revision.started_at)}
                              </span>
                            )}
                            {revision.completed_at && (
                              <span className="rounded-md bg-success/10 px-2 py-0.5 font-bold text-success">
                                Selesai {formatDate(revision.completed_at)}
                              </span>
                            )}
                          </div>
                        )}
                        {revision.notes && <div className="mt-1 text-slate-600">{revision.notes}</div>}
                      </li>
                    ))}
                  </ul>
                ) : inferredDone ? (
                  <span>Data lama · tanggal belum tercatat.</span>
                ) : undefined,
            }
          })

          return (
            <Card key={design.id} className="overflow-hidden">
              <CardHeader>
                <div>
                  <CardTitle>{PHASE_LABEL[design.phase]}</CardTitle>
                  <CardDescription>
                    {isDraft
                      ? `Draft · mulai dari ${stageDisplayLabel(design.current_stage)}`
                      : isComplete
                        ? `Selesai · ${stageDisplayLabel(design.current_stage)}`
                      : `Sedang di ${stageDisplayLabel(design.current_stage)}`}
                  </CardDescription>
                </div>
                <div className="flex items-center gap-2">
                  <Badge tone={isDraft ? 'neutral' : isComplete ? 'success' : 'primary'}>
                    {isDraft ? 'Draft' : isComplete ? 'Selesai' : 'Sedang Berjalan'}
                  </Badge>
                  {mayEdit && (
                    <button
                      type="button"
                      onClick={() => setOpenId(design.id)}
                      className="inline-flex h-8 items-center gap-1.5 rounded-lg border border-slate-300 bg-white px-2.5 text-xs font-bold text-slate-700 hover:bg-slate-50"
                    >
                      <Pencil size={14} aria-hidden />
                      Edit
                    </button>
                  )}
                </div>
              </CardHeader>
              <CardContent>
                {isDraft ? (
                  <EmptyState
                    title="Belum dimulai"
                    description={`Klik Edit untuk mengisi tanggal mulai, drafter, dan PIC Pertamina pada tahap ${stageDisplayLabel(design.current_stage)}.`}
                  />
                ) : (
                  <>
                    <StepChain steps={chainSteps} />

                    <div className="mt-2 flex justify-between gap-3 border-t border-slate-100 pt-3 text-sm">
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
                  </>
                )}
              </CardContent>
            </Card>
          )
        })}
      </div>
      <DesignDetailModal
        open={openId !== null}
        onOpenChange={(v) => !v && setOpenId(null)}
        design={openDesign}
        title={openDesign ? PHASE_LABEL[openDesign.phase] : ''}
        revisions={openDesign ? (revisionsByDesign[openDesign.id] ?? []) : []}
        picName={picName}
        pics={pics}
        mayEdit={mayEdit}
      />
    </>
  )
}
