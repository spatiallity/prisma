'use client'

import { useState } from 'react'
import { Pencil } from 'lucide-react'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { EmptyState } from '@/components/ui/page-header'
import { StepChain, chainBadge, type ChainStep } from '@/components/ui/step-chain'
import { DesignDetailModal } from '../../design/design-detail-modal'
import { cn, formatDateTime } from '@/lib/utils'
import { PHASE_LABEL, PHASE_STAGES, STAGE_ORDER, daysInStage } from '@/lib/design'
import type { DesignPhase, DesignStage } from '@/lib/supabase/types'
import type { PicOption } from '../../design/forms'

type DesignRow = {
  id: string
  phase: DesignPhase
  current_stage: DesignStage
  title: string | null
  updated_at: string
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
          const currentOrder = STAGE_ORDER[design.current_stage]
          const held = daysInStage(design.updated_at)
          const stages = PHASE_STAGES[design.phase]

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
                        {revision.pic_id ? (picName[revision.pic_id] ?? '—') : 'PIC belum ditentukan'}
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
                  <CardTitle>{PHASE_LABEL[design.phase]}</CardTitle>
                  {design.title && <CardDescription>{design.title}</CardDescription>}
                </div>
                {mayEdit && (
                  <button
                    type="button"
                    onClick={() => setOpenId(design.id)}
                    className="inline-flex h-8 w-8 items-center justify-center rounded-lg border border-slate-300 bg-white text-slate-600 hover:bg-slate-50"
                    aria-label="Edit"
                  >
                    <Pencil size={14} aria-hidden />
                  </button>
                )}
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
