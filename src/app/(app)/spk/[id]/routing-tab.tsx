import Link from 'next/link'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { EmptyState } from '@/components/ui/page-header'
import { StepChain, chainBadge, type ChainStep } from '@/components/ui/step-chain'
import { createClient } from '@/lib/supabase/server'
import { formatDate } from '@/lib/utils'
import { RoutingStepEdit } from '../../routing/routing-step-edit'

/** The Routing tab of Detail SPK: every document this SPK has in flight,
 *  shown as its own chain — the same view as clicking it from Routing
 *  Monitor, without leaving the SPK. */
export async function RoutingTab({ spkId, mayEdit }: { spkId: string; mayEdit: boolean }) {
  const supabase = await createClient()

  const { data: documents } = await supabase
    .from('spk_routing')
    .select('*')
    .eq('spk_id', spkId)
    .order('created_at', { ascending: false })

  if (!documents || documents.length === 0) {
    return (
      <Card>
        <CardContent className="p-0">
          <EmptyState
            title="Belum ada dokumen dirutekan"
            description="Rutekan Berita Acara, PAD, atau Invoice dari Routing Monitor."
            action={
              <Link href="/routing" className="text-sm font-bold text-primary hover:underline">
                Buka Routing Monitor
              </Link>
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
    status: string
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
            badge: cell && chainBadge(state, cell.status),
            sub: cell && (
              <>
                {cell.pic_name ?? 'PIC belum ditentukan'}
                {cell.started_at && ` · mulai ${formatDate(cell.started_at)}`}
                {cell.completed_at && ` → ${formatDate(cell.completed_at)}`}
                {cell.note && <div className="mt-0.5 text-slate-700">{cell.note}</div>}
              </>
            ),
            action:
              mayEdit && isCurrent && cell ? (
                <RoutingStepEdit routingId={doc.id} stepId={cell.id} stepName={step.name} defaultPic={cell.pic_name} />
              ) : undefined,
          }
        })

        return (
          <Card key={doc.id}>
            <CardHeader>
              <div>
                <CardTitle>{doc.document_type}</CardTitle>
              </div>
              {doc.document_number && (
                <span className="text-xs font-semibold text-muted-foreground">{doc.document_number}</span>
              )}
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
