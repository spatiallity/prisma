'use client'

import { useState } from 'react'
import { Pencil } from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { Modal } from '@/components/ui/modal'
import { DataTable, type DataTableColumn } from '@/components/ui/data-table'
import { StepChain, chainBadge, type ChainStep } from '@/components/ui/step-chain'
import { cn, formatDate, formatDateTime } from '@/lib/utils'
import { StepReviewForm } from './forms'
import type { Database } from '@/lib/supabase/types'

type RoutingDoc = Database['public']['Tables']['spk_routing']['Row']
type SpkLite = { id: string; spk_number: string; site_code: string | null; work_name?: string }
type StepColumn = { id: string; name: string; sequence: number }
type HistoryCell = {
  id: string
  status: Database['public']['Tables']['routing_history']['Row']['status']
  started_at: string | null
  completed_at: string | null
  pic_name: string | null
  note: string | null
}
type Revision = { id: string; note: string | null; resubmit_at: string }

/** A step's state for one document, shown without a modal of its own — the
 *  whole row opens the full chain + edit popup now. */
function StepCell({
  cell,
  isCurrent,
  isOverdue,
}: {
  cell: HistoryCell | undefined
  isCurrent: boolean
  isOverdue: boolean
}) {
  if (!cell) return <span className="text-muted-foreground">—</span>

  if (cell.status === 'Completed') {
    return (
      <div>
        <Badge tone="success">Done</Badge>
        {cell.pic_name && <div className="mt-1 text-xs text-muted-foreground">{cell.pic_name}</div>}
        {cell.completed_at && <div className="tnum text-xs text-muted-foreground">{formatDate(cell.completed_at)}</div>}
      </div>
    )
  }

  if (!isCurrent) return <Badge tone="neutral">Not Yet</Badge>

  return (
    <div>
      <Badge tone={isOverdue ? 'danger' : cell.status === 'Returned' ? 'warning' : 'primary'}>
        {isOverdue ? 'Lewat SLA' : cell.status}
      </Badge>
      {cell.pic_name && <div className="mt-1 text-xs text-muted-foreground">{cell.pic_name}</div>}
      {cell.started_at && (
        <div className={cn('tnum text-xs', isOverdue ? 'font-bold text-danger' : 'text-muted-foreground')}>
          {formatDate(cell.started_at)}
        </div>
      )}
    </div>
  )
}

/** The full chain (like /routing/[id]) plus, when editable, the review form
 *  for the current step — shown as one popup instead of a separate page. */
function RoutingDetailModal({
  open,
  onOpenChange,
  doc,
  spk,
  steps,
  history,
  revisionsByStep,
  mayEdit,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  doc: RoutingDoc | null
  spk: SpkLite | undefined
  steps: StepColumn[]
  history: Record<number, HistoryCell>
  revisionsByStep: Record<string, Revision[]>
  mayEdit: boolean
}) {
  if (!doc) return null

  const current = steps.find((s) => history[s.sequence] && history[s.sequence].status !== 'Completed')

  const chainSteps: ChainStep[] = steps.map((step) => {
    const cell = history[step.sequence]
    const isCurrent = current?.id === step.id
    const finished = cell?.status === 'Completed'
    const rejected = cell?.status === 'Rejected'
    const revisions = cell ? (revisionsByStep[cell.id] ?? []) : []

    return {
      key: step.id,
      label: step.name,
      state: finished ? 'done' : rejected ? 'rejected' : isCurrent ? 'current' : 'pending',
      badge: cell && chainBadge(finished ? 'done' : rejected ? 'rejected' : isCurrent ? 'current' : 'pending', cell.status),
      sub: (
        <>
          {cell?.pic_name ?? 'PIC belum ditentukan'}
          {cell?.started_at && ` · mulai ${formatDateTime(cell.started_at)}`}
          {cell?.completed_at && ` → ${formatDateTime(cell.completed_at)}`}
          {cell?.note && <div className="mt-1 text-sm text-slate-700">{cell.note}</div>}
          {revisions.length > 0 && (
            <ul className="mt-2 grid gap-1.5 border-l-2 border-warning/40 pl-3">
              {revisions.map((revision, i) => (
                <li key={revision.id} className="text-xs">
                  <span className="font-bold text-warning">Revisi {i + 1}</span>{' '}
                  <span className="text-slate-700">{revision.note}</span>
                  <span className="text-muted-foreground"> · disubmit ulang {formatDate(revision.resubmit_at)}</span>
                </li>
              ))}
            </ul>
          )}
        </>
      ),
    }
  })

  const currentCell = current ? history[current.sequence] : undefined

  return (
    <Modal
      open={open}
      onOpenChange={onOpenChange}
      title={spk?.site_code ?? spk?.spk_number ?? 'Routing'}
      description={spk?.work_name}
      size="lg"
    >
      <div className="grid gap-5">
        <StepChain steps={chainSteps} />
        {mayEdit && current && currentCell && (
          <div className="border-t border-slate-100 pt-4">
            <div className="mb-2 text-sm font-bold text-slate-900">Review {current.name}</div>
            <StepReviewForm routingId={doc.id} stepId={currentCell.id} defaultPic={currentCell.pic_name} />
          </div>
        )}
      </div>
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
  revisionsByStep,
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
  revisionsByStep: Record<string, Revision[]>
  mayEdit: boolean
  invoiceDraftedBySpk: Record<string, boolean>
}) {
  const [openDocId, setOpenDocId] = useState<string | null>(null)
  const openDoc = docs.find((d) => d.id === openDocId) ?? null

  const columns: DataTableColumn<RoutingDoc>[] = [
    {
      key: 'spk',
      label: 'SPK',
      sortAccessor: (row) => {
        const spk = spkById[row.spk_id]
        return spk?.site_code ?? spk?.spk_number ?? null
      },
      render: (row) => {
        const spk = spkById[row.spk_id]
        const label = spk?.site_code ?? spk?.spk_number ?? 'SPK'
        const sub = spk?.site_code ? spk?.spk_number : null
        return (
          <div>
            <span className="font-bold text-primary">{label}</span>
            {sub && <div className="text-xs font-semibold text-slate-500">{sub}</div>}
          </div>
        )
      },
    },
    {
      key: 'drafting_invoice',
      label: 'Drafting Invoice',
      align: 'center',
      className: 'text-muted-foreground',
      sortAccessor: (row) => (invoiceDraftedBySpk[row.spk_id] ? 1 : 0),
      render: (row) => (
        <Badge tone={invoiceDraftedBySpk[row.spk_id] ? 'success' : 'neutral'}>
          {invoiceDraftedBySpk[row.spk_id] ? 'Done' : 'Belum'}
        </Badge>
      ),
    },
    ...steps.map(
      (step): DataTableColumn<RoutingDoc> => ({
        key: step.id,
        label: step.name,
        align: 'center',
        render: (row) => (
          <StepCell
            cell={historyByDoc[row.id]?.[step.sequence]}
            isCurrent={currentSequenceByDoc[row.id] === step.sequence}
            isOverdue={currentSequenceByDoc[row.id] === step.sequence && !!overdueByDoc[row.id]}
          />
        ),
      }),
    ),
    {
      key: 'aksi',
      label: 'Aksi',
      align: 'right',
      stopRowClick: true,
      render: (row) => (
        <button
          type="button"
          onClick={() => setOpenDocId(row.id)}
          className="inline-flex h-8 w-8 items-center justify-center rounded-lg border border-slate-300 bg-white text-slate-600 hover:bg-slate-50"
          aria-label="Detail"
        >
          <Pencil size={14} aria-hidden />
        </button>
      ),
    },
  ]

  return (
    <>
      <DataTable
        columns={columns}
        rows={docs}
        rowKey={(row) => row.id}
        onRowClick={(row) => setOpenDocId(row.id)}
        searchAccessor={(row) => {
          const spk = spkById[row.spk_id]
          return [spk?.spk_number, spk?.site_code].filter(Boolean).join(' ')
        }}
        searchPlaceholder="Cari SPK…"
        emptyTitle="Tidak ada dokumen berjalan"
        emptyDescription="Rutekan dokumen agar posisinya bisa dipantau."
        pageSize={100}
      />
      <RoutingDetailModal
        open={openDocId !== null}
        onOpenChange={(v) => !v && setOpenDocId(null)}
        doc={openDoc}
        spk={openDoc ? spkById[openDoc.spk_id] : undefined}
        steps={steps}
        history={openDoc ? (historyByDoc[openDoc.id] ?? {}) : {}}
        revisionsByStep={revisionsByStep}
        mayEdit={mayEdit}
      />
    </>
  )
}
