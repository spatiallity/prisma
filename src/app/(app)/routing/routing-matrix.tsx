'use client'

import { useEffect, useRef, useState } from 'react'
import Link from 'next/link'
import { Pencil } from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { Modal } from '@/components/ui/modal'
import { DataTable, type DataTableColumn } from '@/components/ui/data-table'
import { AccordionChain, type AccordionStep } from '@/components/ui/step-chain'
import { cn, formatDate } from '@/lib/utils'
import { RoutingStepDateForm } from './forms'
import type { Database } from '@/lib/supabase/types'

type RoutingDoc = Database['public']['Tables']['spk_routing']['Row']
/** A placeholder row for an SPK that's eligible for routing (Finalisasi
 *  Desain opened) but has no spk_routing document yet — nothing to review,
 *  so the Aksi column is empty and every step column reads "—". */
type VirtualDoc = { id: string; spk_id: string; virtual: true }
type MatrixRow = RoutingDoc | VirtualDoc
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

  if (!isCurrent) return <Badge tone="neutral">Draft</Badge>

  return (
    <div>
      <Badge tone={isOverdue ? 'danger' : cell.status === 'Returned' ? 'warning' : 'primary'}>
        {isOverdue ? 'Lewat SLA' : cell.status === 'Returned' ? 'Revisi' : 'In Progress'}
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

/** The full chain, each step its own accordion row — shown as one popup
 *  instead of a separate page. Expand a row to fill its Tanggal mulai/selesai;
 *  the next row unlocks once this one has a Tanggal selesai. */
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
  const [openKey, setOpenKey] = useState<string | null>(null)
  const lastDocId = useRef<string | null>(null)

  const current = doc ? steps.find((s) => history[s.sequence] && history[s.sequence].status !== 'Completed') : undefined

  useEffect(() => {
    if (doc && doc.id !== lastDocId.current) {
      lastDocId.current = doc.id
      setOpenKey(current?.id ?? null)
    }
  }, [doc, current])

  if (!doc) return null

  const toggle = (key: string) => setOpenKey((prev) => (prev === key ? null : key))

  const accordionSteps: AccordionStep[] = steps.map((step, index) => {
    const cell = history[step.sequence]
    const previousCell = index > 0 ? history[steps[index - 1]!.sequence] : undefined
    const isCurrent = current?.id === step.id
    const finished = cell?.status === 'Completed'
    const rejected = cell?.status === 'Rejected'
    const revisions = cell ? (revisionsByStep[cell.id] ?? []) : []
    const state: AccordionStep['state'] = finished ? 'done' : rejected ? 'rejected' : isCurrent ? 'current' : 'pending'
    // Every step's row is pre-created at document creation, so "locked" can't
    // be "no row yet" — it's "the step before this one isn't Completed". Gate
    // on status, not completed_at: older, bulk-imported rows can carry status
    // 'Completed' with no completed_at ever recorded.
    const locked = index > 0 && previousCell?.status !== 'Completed'

    return {
      key: step.id,
      label: step.name,
      state,
      locked,
      summary: cell && (
        <>
          {cell.pic_name ?? 'PIC belum ditentukan'}
          {cell.started_at && ` · mulai ${formatDate(cell.started_at)}`}
          {cell.completed_at && ` → ${formatDate(cell.completed_at)}`}
          {cell.note && <div className="mt-1 text-sm text-slate-700">{cell.note}</div>}
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
      content: mayEdit && cell ? <RoutingStepDateForm routingId={doc.id} stepId={cell.id} entry={cell} /> : undefined,
    }
  })

  return (
    <Modal
      open={open}
      onOpenChange={onOpenChange}
      title={spk?.site_code ?? spk?.spk_number ?? 'Routing'}
      description={spk?.work_name}
      size="lg"
    >
      <div className="grid gap-4">
        {spk && (
          <div className="flex justify-end">
            <Link href={`/spk/${spk.id}`} className="text-sm font-bold text-primary hover:underline">
              Buka Detail SPK
            </Link>
          </div>
        )}
        <AccordionChain steps={accordionSteps} openKey={openKey} onToggle={toggle} />
      </div>
    </Modal>
  )
}

function isVirtual(row: MatrixRow): row is VirtualDoc {
  return 'virtual' in row && row.virtual
}

export function RoutingMatrix({
  docs,
  virtualSpkIds = [],
  spkById,
  steps,
  historyByDoc,
  currentSequenceByDoc,
  overdueByDoc,
  revisionsByStep,
  mayEdit,
  invoiceDraftedBySpk,
  opnameBySpk,
}: {
  docs: RoutingDoc[]
  /** SPKs eligible for routing with no spk_routing document yet. */
  virtualSpkIds?: string[]
  spkById: Record<string, SpkLite>
  /** Fixed columns, in sequence order — every document shares one template. */
  steps: StepColumn[]
  historyByDoc: Record<string, Record<number, HistoryCell>>
  currentSequenceByDoc: Record<string, number | undefined>
  overdueByDoc: Record<string, boolean>
  revisionsByStep: Record<string, Revision[]>
  mayEdit: boolean
  invoiceDraftedBySpk: Record<string, boolean>
  opnameBySpk: Record<string, string | null>
}) {
  const [openDocId, setOpenDocId] = useState<string | null>(null)
  const openDoc = docs.find((d) => d.id === openDocId) ?? null

  const rows: MatrixRow[] = [
    ...docs,
    ...virtualSpkIds.map((spkId): VirtualDoc => ({ id: `virtual-${spkId}`, spk_id: spkId, virtual: true })),
  ]

  const columns: DataTableColumn<MatrixRow>[] = [
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
      key: 'opname',
      label: 'Opname',
      align: 'center',
      className: 'text-muted-foreground',
      sortAccessor: (row) => (opnameBySpk[row.spk_id] ? 1 : 0),
      render: (row) => {
        const markedAt = opnameBySpk[row.spk_id]
        return (
          <div>
            <Badge tone={markedAt ? 'success' : 'neutral'}>{markedAt ? 'Done' : 'Draft'}</Badge>
            {markedAt && <div className="tnum mt-1 text-xs text-muted-foreground">{formatDate(markedAt)}</div>}
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
          {invoiceDraftedBySpk[row.spk_id] ? 'Done' : 'Draft'}
        </Badge>
      ),
    },
    ...steps.map(
      (step): DataTableColumn<MatrixRow> => ({
        key: step.id,
        label: step.name,
        align: 'center',
        render: (row) =>
          isVirtual(row) ? (
            <span className="text-muted-foreground">—</span>
          ) : (
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
      render: (row) =>
        isVirtual(row) ? null : (
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
        rows={rows}
        rowKey={(row) => row.id}
        onRowClick={(row) => !isVirtual(row) && setOpenDocId(row.id)}
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
