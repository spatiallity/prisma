'use client'

import { Badge } from '@/components/ui/badge'
import { Modal } from '@/components/ui/modal'
import { DataTable, type DataTableColumn } from '@/components/ui/data-table'
import { cn, formatDate } from '@/lib/utils'
import { StepReviewForm } from './forms'
import type { Database } from '@/lib/supabase/types'

type RoutingDoc = Database['public']['Tables']['spk_routing']['Row']
type SpkLite = { id: string; spk_number: string; site_code: string | null }
type StepColumn = { id: string; name: string; sequence: number }
type HistoryCell = {
  id: string
  status: Database['public']['Tables']['routing_history']['Row']['status']
  started_at: string | null
  completed_at: string | null
  pic_name: string | null
}

/**
 * One cell of the matrix — a step's state for one document. Only the
 * document's current step is ever editable (the workflow is sequential;
 * nothing lets a finished or future step be reopened from here), so that's
 * the only cell that renders as a button.
 */
function StepCell({
  routingId,
  cell,
  isCurrent,
  isOverdue,
  mayEdit,
}: {
  routingId: string
  cell: HistoryCell | undefined
  isCurrent: boolean
  isOverdue: boolean
  mayEdit: boolean
}) {
  if (!cell) return <span className="text-muted-foreground">—</span>

  if (cell.status === 'Completed') {
    return (
      <div>
        <Badge tone="success">Done</Badge>
        {cell.completed_at && (
          <div className="tnum mt-1 text-xs text-muted-foreground">
            {formatDate(cell.completed_at)}
          </div>
        )}
      </div>
    )
  }

  if (!isCurrent) {
    return <Badge tone="neutral">Not Yet</Badge>
  }

  const body = (
    <div>
      <Badge tone={isOverdue ? 'danger' : cell.status === 'Returned' ? 'warning' : 'primary'}>
        {isOverdue ? 'Lewat SLA' : cell.status}
      </Badge>
      {cell.started_at && (
        <div
          className={cn(
            'tnum mt-1 text-xs',
            isOverdue ? 'font-bold text-danger' : 'text-muted-foreground',
          )}
        >
          {formatDate(cell.started_at)}
        </div>
      )}
    </div>
  )

  if (!mayEdit) return body

  return (
    <Modal
      title="Review tahap"
      description={cell.status === 'Returned' ? 'Tahap ini sedang direvisi.' : undefined}
      trigger={
        <button type="button" className="text-left hover:opacity-80">
          {body}
        </button>
      }
    >
      <StepReviewForm routingId={routingId} stepId={cell.id} defaultPic={cell.pic_name} />
    </Modal>
  )
}

/**
 * The SPK column doubles as the edit entry point — clicking it opens the same
 * review popup as its current step's cell instead of leaving the matrix, so
 * a whole document can be worked from one screen.
 */
function SpkNameCell({
  spk,
  routingId,
  currentCell,
  mayEdit,
}: {
  spk: SpkLite | undefined
  routingId: string
  currentCell: HistoryCell | undefined
  mayEdit: boolean
}) {
  const label = spk?.site_code ?? spk?.spk_number ?? 'SPK'
  const sub = spk?.site_code ? spk?.spk_number : null
  const text = (
    <>
      <span className="font-bold text-primary">{label}</span>
      {sub && <div className="text-xs font-semibold text-slate-500">{sub}</div>}
    </>
  )

  if (!mayEdit || !currentCell) return <div>{text}</div>

  return (
    <Modal
      title="Review tahap"
      description={currentCell.status === 'Returned' ? 'Tahap ini sedang direvisi.' : undefined}
      trigger={
        <button type="button" className="text-left hover:opacity-80">
          {text}
        </button>
      }
    >
      <StepReviewForm routingId={routingId} stepId={currentCell.id} defaultPic={currentCell.pic_name} />
    </Modal>
  )
}

export function RoutingMatrix({
  docs,
  spkById,
  steps,
  historyByDoc,
  currentSequenceByDoc,
  overdueByDoc,
  mayEdit,
}: {
  docs: RoutingDoc[]
  spkById: Record<string, SpkLite>
  /** Fixed columns, in sequence order — every document shares one template. */
  steps: StepColumn[]
  historyByDoc: Record<string, Record<number, HistoryCell>>
  currentSequenceByDoc: Record<string, number | undefined>
  overdueByDoc: Record<string, boolean>
  mayEdit: boolean
}) {
  const columns: DataTableColumn<RoutingDoc>[] = [
    {
      key: 'spk',
      label: 'SPK',
      stopRowClick: true,
      sortAccessor: (row) => {
        const spk = spkById[row.spk_id]
        return spk?.site_code ?? spk?.spk_number ?? null
      },
      render: (row) => (
        <SpkNameCell
          spk={spkById[row.spk_id]}
          routingId={row.id}
          currentCell={historyByDoc[row.id]?.[currentSequenceByDoc[row.id] ?? -1]}
          mayEdit={mayEdit}
        />
      ),
    },
    ...steps.map(
      (step): DataTableColumn<RoutingDoc> => ({
        key: step.id,
        label: step.name,
        stopRowClick: true,
        render: (row) => (
          <StepCell
            routingId={row.id}
            cell={historyByDoc[row.id]?.[step.sequence]}
            isCurrent={currentSequenceByDoc[row.id] === step.sequence}
            isOverdue={currentSequenceByDoc[row.id] === step.sequence && !!overdueByDoc[row.id]}
            mayEdit={mayEdit}
          />
        ),
      }),
    ),
  ]

  return (
    <DataTable
      columns={columns}
      rows={docs}
      rowKey={(row) => row.id}
      searchAccessor={(row) => {
        const spk = spkById[row.spk_id]
        return [spk?.spk_number, spk?.site_code].filter(Boolean).join(' ')
      }}
      searchPlaceholder="Cari SPK…"
      emptyTitle="Tidak ada dokumen berjalan"
      emptyDescription="Rutekan dokumen agar posisinya bisa dipantau."
      pageSize={100}
    />
  )
}
