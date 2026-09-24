import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { EmptyState } from '@/components/ui/page-header'
import { StepChain, chainBadge, type ChainStep } from '@/components/ui/step-chain'
import { createClient } from '@/lib/supabase/server'
import { formatDate } from '@/lib/utils'
import { routingStatusLabel } from '@/lib/routing'
import type { RoutingStatus } from '@/lib/supabase/types'
import { AddRoutingButton } from '../../routing/forms'
import { RoutingStepEdit } from '../../routing/routing-step-edit'

/** The Routing tab of Detail SPK: every document this SPK has in flight,
 *  shown as its own chain — the same view as clicking it from Routing
 *  Monitor, without leaving the SPK. */
export async function RoutingTab({
  spkId,
  mayEdit,
  allowBlankDates = false,
}: {
  spkId: string
  mayEdit: boolean
  allowBlankDates?: boolean
}) {
  const supabase = await createClient()

  const { data: documents } = await supabase
    .from('spk_routing')
    .select('*')
    .eq('spk_id', spkId)
    .order('created_at', { ascending: false })

  if (!documents || documents.length === 0) {
    const [{ data: spk }, { data: template }] = await Promise.all([
      supabase
        .from('spks')
        .select('id, spk_number, work_name, status')
        .eq('id', spkId)
        .maybeSingle(),
      supabase.from('routing_templates').select('id').eq('status', 'Active').order('created_at').limit(1).maybeSingle(),
    ])
    const ready = spk?.status === 'Draft' || spk?.status === 'On Going'
    const spkOptions = spk ? [{ id: spk.id, label: `${spk.spk_number} — ${spk.work_name}` }] : []

    return (
      <Card className="overflow-hidden">
        <CardHeader>
          <div>
            <CardTitle>Dokumen Invoice</CardTitle>
            <CardDescription>Buat dan pantau alur dokumen invoice dari SPK ini.</CardDescription>
          </div>
        </CardHeader>
        <CardContent className="p-0">
          <EmptyState
            title="Belum ada dokumen invoice"
            description={
              ready
                ? 'SPK siap dibuatkan dokumen invoice. Opname dan PAD dapat diisi dari Routing Monitor.'
                : 'Dokumen invoice hanya dapat dibuat untuk SPK Draft atau Sedang Berjalan.'
            }
            action={
              mayEdit && ready && spkOptions.length > 0 ? (
                <AddRoutingButton
                  spks={spkOptions}
                  templateId={template?.id ?? null}
                  lockedSpkId={spkId}
                  returnToSpk
                  label="Buat dokumen invoice"
                  allowBlankDates={allowBlankDates}
                />
              ) : undefined
            }
          />
        </CardContent>
      </Card>
    )
  }

  const templateIds = [...new Set(documents.map((d) => d.template_id).filter((id): id is string => !!id))]
  const docIds = documents.map((d) => d.id)

  const [{ data: allSteps }, { data: history }] = await Promise.all([
    templateIds.length
      ? supabase
          .from('routing_template_steps')
          .select('id, template_id, name, sequence')
          .in('template_id', templateIds)
          .order('sequence')
      : Promise.resolve({ data: [] }),
    docIds.length
      ? supabase
          .from('routing_history')
          .select('id, spk_routing_id, sequence, status, started_at, completed_at, pic_name, note')
          .in('spk_routing_id', docIds)
      : Promise.resolve({ data: [] }),
  ])

  type HistoryCell = {
    id: string
    status: RoutingStatus
    started_at: string | null
    completed_at: string | null
    pic_name: string | null
    note: string | null
  }

  const stepsByTemplate = new Map<string, { id: string; name: string; sequence: number }[]>()
  for (const step of allSteps ?? []) {
    const list = stepsByTemplate.get(step.template_id) ?? []
    list.push(step)
    stepsByTemplate.set(step.template_id, list)
  }

  const historyByDoc = new Map<string, Map<number, HistoryCell>>()
  for (const row of history ?? []) {
    const map = historyByDoc.get(row.spk_routing_id) ?? new Map<number, HistoryCell>()
    map.set(row.sequence, row)
    historyByDoc.set(row.spk_routing_id, map)
  }

  return (
    <div className="grid gap-5">
      {documents.map((doc) => {
        const templateSteps = doc.template_id ? (stepsByTemplate.get(doc.template_id) ?? []) : []
        const docHistory = historyByDoc.get(doc.id) ?? new Map()
        const current = templateSteps.find((s) => {
          const cell = docHistory.get(s.sequence)
          return cell && cell.status !== 'Completed'
        })
        const complete = templateSteps.length > 0 && templateSteps.every(
          (step) => docHistory.get(step.sequence)?.status === 'Completed',
        )

        const chainSteps: ChainStep[] = templateSteps.map((step) => {
          const cell = docHistory.get(step.sequence)
          const isCurrent = current?.id === step.id
          const finished = cell?.status === 'Completed'
          const rejected = cell?.status === 'Rejected'
          const state = finished ? 'done' : rejected ? 'rejected' : isCurrent ? 'current' : 'pending'
          return {
            key: step.id,
            label: step.name,
            state,
            badge: cell && chainBadge(
              state,
              step.name === 'Invoiced'
                ? cell.status === 'Completed' ? 'Sudah' : 'Belum'
                : routingStatusLabel(cell.status),
            ),
            sub: cell && (
              <div>
                <div>{cell.pic_name ?? 'PIC belum ditentukan'}</div>
                {(cell.started_at || cell.completed_at) && (
                  <div className="mt-1.5 flex flex-wrap gap-1.5">
                    {cell.started_at && (
                      <span className="rounded-md bg-primary-soft px-2 py-0.5 font-bold text-primary">
                        Mulai {formatDate(cell.started_at)}
                      </span>
                    )}
                    {cell.completed_at && (
                      <span className="rounded-md bg-success/10 px-2 py-0.5 font-bold text-success">
                        Selesai {formatDate(cell.completed_at)}
                      </span>
                    )}
                  </div>
                )}
                {cell.note && <div className="mt-1 text-slate-600">{cell.note}</div>}
              </div>
            ),
            action:
              mayEdit && isCurrent && cell ? (
                <RoutingStepEdit
                  routingId={doc.id}
                  stepId={cell.id}
                  stepName={step.name}
                  defaultPic={cell.pic_name}
                  allowBlankDates={allowBlankDates}
                />
              ) : undefined,
          }
        })

        return (
          <Card key={doc.id} className="overflow-hidden">
            <CardHeader>
              <div>
                <CardTitle>{doc.document_type}</CardTitle>
                <CardDescription>
                  {complete ? 'Selesai' : current ? `Sedang di ${current.name}` : 'Draft'}
                </CardDescription>
              </div>
              <div className="flex items-center gap-2">
                <Badge tone={complete ? 'success' : current ? 'primary' : 'neutral'}>
                  {complete ? 'Selesai' : current ? 'Sedang Berjalan' : 'Draft'}
                </Badge>
                {doc.document_number && (
                  <span className="text-xs font-semibold text-muted-foreground">{doc.document_number}</span>
                )}
              </div>
            </CardHeader>
            <CardContent>
              <StepChain steps={chainSteps} />
            </CardContent>
          </Card>
        )
      })}
    </div>
  )
}
