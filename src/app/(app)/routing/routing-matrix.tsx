'use client'

import { Pencil } from 'lucide-react'
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
        <div className="mt-1 text-xs text-muted-foreground">{cell.pic_name ?? 'N/A'}</div>
        <div className="tnum text-xs text-muted-foreground">
          {cell.completed_at ? formatDate(cell.completed_at) : 'N/A'}
        </div>
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
      <div className="mt-1 text-xs text-muted-foreground">{cell.pic_name ?? 'N/A'}</div>
      <div className={cn('tnum text-xs', isOverdue ? 'font-bold text-danger' : 'text-muted-foreground')}>
        {cell.started_at ? formatDate(cell.started_at) : 'N/A'}
      </div>
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
  invoiceDraftedBySpk,
}: {
  docs: RoutingDoc[]
  spkById: Record<string, SpkLite>
  /** Fixed columns, in sequence order — every document shares one template. */
  steps: StepColumn[]
  historyByDoc: Record<string, Record<number, HistoryCell>>
  currentSequenceByDoc: Record<string, number | undefined>
  overdueByDoc: Record<string, boolean>
  mayEdit: boolean
  invoiceDraftedBySpk: Record<string, string | null>
}) {
  const columns: DataTableColumn<RoutingDoc>[] = [
    {
      key: 'drafting_invoice',
      label: 'Drafting Invoice',
      align: 'center',
      className: 'text-muted-foreground',
      sortAccessor: (row) => (row.spk_id in invoiceDraftedBySpk ? 1 : 0),
      render: (row) => {
        const date = invoiceDraftedBySpk[row.spk_id]
        if (!(row.spk_id in invoiceDraftedBySpk)) return <Badge tone="neutral">Belum</Badge>
        return (
          <div>
            <Badge tone="success">Sudah</Badge>
            <div className="tnum mt-1 text-xs">{date ? formatDate(date) : 'N/A'}</div>
          </div>
        )
      },
    },
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
        align: 'center',
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
    ...(mayEdit
      ? [
          {
            key: 'aksi',
            label: 'Aksi',
            align: 'right' as const,
            stopRowClick: true,
            render: (row: RoutingDoc) => {
              const currentCell = historyByDoc[row.id]?.[currentSequenceByDoc[row.id] ?? -1]
              if (!currentCell) return <span className="text-muted-foreground">—</span>
              return (
                <Modal
                  title="Review tahap"
                  description={currentCell.status === 'Returned' ? 'Tahap ini sedang direvisi.' : undefined}
                  trigger={
                    <button
                      type="button"
                      className="inline-flex h-8 w-8 items-center justify-center rounded-lg border border-slate-300 bg-white text-slate-600 hover:bg-slate-50"
                      aria-label="Edit"
                    >
                      <Pencil size={14} aria-hidden />
                    </button>
                  }
                >
                  <StepReviewForm routingId={row.id} stepId={currentCell.id} defaultPic={currentCell.pic_name} />
                </Modal>
              )
            },
          } satisfies DataTableColumn<RoutingDoc>,
        ]
      : []),
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
