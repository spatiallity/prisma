'use client'

import { useEffect, useRef, useState } from 'react'
import Link from 'next/link'
import { Eye } from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { Modal } from '@/components/ui/modal'
import { DataTable, type DataTableColumn } from '@/components/ui/data-table'
import { AccordionChain, NotesList, type AccordionStep } from '@/components/ui/step-chain'
import { RowActions } from '@/components/ui/row-actions'
import { DeleteButton } from '@/components/ui/delete-button'
import { cn, formatDate } from '@/lib/utils'
import { daysBetween, daysInStage } from '@/lib/design'
import { RoutingStepDateForm } from './forms'
import { rollbackRoutingStep } from './actions'
import { OpnamePadRow } from '../spk/[id]/opname-pad-mark'
import { markOpname, markPad, unmarkOpname, unmarkPad } from '../spk/actions'
import type { Database } from '@/lib/supabase/types'

type RoutingDoc = Database['public']['Tables']['spk_routing']['Row']
/** A placeholder row for a legacy SPK with PAD but no spk_routing document
 *  yet — nothing to review,
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
  invoice_number: string | null
  invoice_value: number | null
  invoice_date: string | null
}
type Revision = { id: string; note: string | null; resubmit_at: string }

/** A step's state for one document, shown without a modal of its own — the
 *  whole row opens the full chain + edit popup now. */
function StepCell({
  cell,
  stepName,
  isCurrent,
  isOverdue,
}: {
  cell: HistoryCell | undefined
  stepName: string
  isCurrent: boolean
  isOverdue: boolean
}) {
  if (!cell) return <span className="text-muted-foreground">—</span>

  if (stepName === 'Invoiced') {
    const alreadyInvoiced = cell.status === 'Completed'
    const inProgress = isCurrent && !alreadyInvoiced
    return (
      <div>
        <Badge tone={alreadyInvoiced ? 'success' : inProgress ? 'primary' : 'neutral'}>{alreadyInvoiced ? 'Invoiced' : inProgress ? 'Sedang Berjalan' : 'Belum'}</Badge>
        {(cell.invoice_date ?? cell.started_at) && <div className="tnum text-xs text-muted-foreground">{formatDate(cell.invoice_date ?? cell.started_at)}</div>}
        {alreadyInvoiced && (!cell.invoice_date || cell.invoice_value === null) && (
          <div className="mt-1 text-[11px] font-semibold text-warning">Data belum lengkap</div>
        )}
      </div>
    )
  }

  if (cell.status === 'Completed') {
    return (
      <div>
        <Badge tone="success">Selesai</Badge>
        {cell.completed_at && <div className="tnum text-xs text-muted-foreground">{formatDate(cell.completed_at)}</div>}
      </div>
    )
  }

  if (!isCurrent) return <Badge tone="neutral">Belum</Badge>

  return (
    <div>
      <Badge tone={isOverdue ? 'danger' : cell.status === 'Returned' ? 'warning' : 'primary'}>
        {isOverdue ? 'Lewat SLA' : cell.status === 'Returned' ? 'Revisi' : 'Sedang Berjalan'}
      </Badge>
      {cell.started_at && (
        <div className={cn('tnum text-xs', isOverdue ? 'font-bold text-danger' : 'text-muted-foreground')}>
          {formatDate(cell.started_at)}
        </div>
      )}
    </div>
  )
}

/** The full chain, each step its own accordion row, plus Opname/PAD at the
 *  top — one popup instead of a separate page, and the only edit control on
 *  the row (the table's own Opname/PAD columns are read-only display). A
 *  virtual row (no spk_routing document yet) still opens this to mark
 *  Opname/PAD; it just has no accordion since there's no document yet.
 *  Expand a step row to fill its Tanggal mulai/selesai; the next one
 *  unlocks once this one has a Tanggal selesai. */
function RoutingDetailModal({
  open,
  onOpenChange,
  doc,
  spk,
  steps,
  history,
  revisionsByStep,
  mayEdit,
  opnameMarkedAt,
  opnameValue,
  padMarkedAt,
  padValue,
  dendaValue,
  allowBlankDates = false,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  doc: RoutingDoc | null
  spk: SpkLite | undefined
  steps: StepColumn[]
  history: Record<number, HistoryCell>
  revisionsByStep: Record<string, Revision[]>
  mayEdit: boolean
  opnameMarkedAt: string | null
  opnameValue: number | null
  padMarkedAt: string | null
  padValue: number | null
  dendaValue: number | null
  allowBlankDates?: boolean
}) {
  const [openKey, setOpenKey] = useState<string | null>(null)
  const lastDocId = useRef<string | null>(null)

  const current = doc ? steps.find((s) => history[s.sequence] && history[s.sequence].status !== 'Completed') : undefined
  const rollbackStepId = current?.id ?? steps.at(-1)?.id

  useEffect(() => {
    const key = doc?.id ?? null
    if (key !== lastDocId.current) {
      lastDocId.current = key
      const frame = requestAnimationFrame(() => setOpenKey(current?.id ?? null))
      return () => cancelAnimationFrame(frame)
    }
  }, [doc, current])

  if (!spk) return null

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
          {(() => {
            const spent = cell.completed_at
              ? daysBetween(cell.started_at, cell.completed_at)
              : isCurrent
                ? daysInStage(cell.started_at)
                : null
            return (
              spent !== null && (
                <span className="text-slate-500"> · {spent} hari{!cell.completed_at && ' (berjalan)'}</span>
              )
            )
          })()}
          <NotesList text={cell.note} />
          {revisions.length > 0 && (
            <ul className="mt-2 grid gap-1.5 border-l-2 border-warning/40 pl-3">
              {revisions.map((revision, i) => (
                <li key={revision.id} className="text-xs">
                  <span className="font-bold text-warning">Revisi {i + 1}</span>
                  <NotesList text={revision.note} />
                  <span className="text-muted-foreground"> · disubmit ulang {formatDate(revision.resubmit_at)}</span>
                </li>
              ))}
            </ul>
          )}
        </>
      ),
      content:
        mayEdit && doc && cell ? (
          <RoutingStepDateForm
            routingId={doc.id}
            stepId={cell.id}
            stepName={step.name}
            entry={cell}
            previousCompletedAt={previousCell?.completed_at}
            dendaValue={dendaValue}
            allowBlankDates={allowBlankDates}
            canRollback={index > 0 && step.id === rollbackStepId}
            onSaved={() => setOpenKey(null)}
          />
        ) : undefined,
    }
  })

  return (
    <Modal
      open={open}
      onOpenChange={onOpenChange}
      title={spk.site_code ?? spk.spk_number ?? 'Routing'}
      description={spk.work_name}
      size="lg"
    >
      <div className="grid gap-4">
        <div className="flex justify-end">
          <Link href={`/spk/${spk.id}`} className="text-sm font-bold text-primary hover:underline">
            Buka Detail SPK
          </Link>
        </div>

        <div className="grid gap-3 rounded-lg border border-slate-200 p-3 sm:grid-cols-2">
          <div className="flex items-center justify-between gap-2">
            <div>
              <div className="text-xs font-extrabold tracking-wider text-slate-500 uppercase">Opname</div>
              <Badge tone={opnameMarkedAt ? 'success' : 'neutral'}>{opnameMarkedAt ? 'Selesai' : 'Belum'}</Badge>
              {opnameMarkedAt && <div className="tnum mt-1 text-xs text-muted-foreground">{formatDate(opnameMarkedAt)}</div>}
            </div>
            {mayEdit && (
              <OpnamePadRow
                label="Opname"
                spkId={spk.id}
                markedAt={opnameMarkedAt}
                markAction={markOpname}
                unmarkAction={unmarkOpname}
                valueLabel="Nilai Opname"
                value={opnameValue}
              />
            )}
          </div>
          <div className="flex items-center justify-between gap-2">
            <div>
              <div className="text-xs font-extrabold tracking-wider text-slate-500 uppercase">PAD</div>
              <Badge tone={padMarkedAt ? 'success' : 'neutral'}>{padMarkedAt ? 'Selesai' : 'Belum'}</Badge>
              {padMarkedAt && <div className="tnum mt-1 text-xs text-muted-foreground">{formatDate(padMarkedAt)}</div>}
            </div>
            {mayEdit && (
              <OpnamePadRow
                label="PAD"
                spkId={spk.id}
                markedAt={padMarkedAt}
                disabled={!opnameMarkedAt}
                disabledHint="Opname dulu"
                markAction={markPad}
                unmarkAction={unmarkPad}
                valueLabel="Nilai PAD"
                value={padValue}
              />
            )}
          </div>
        </div>

        {doc ? (
          <AccordionChain steps={accordionSteps} openKey={openKey} onToggle={toggle} />
        ) : (
          <p className="text-sm text-muted-foreground">
            Belum ada dokumen invoice. SPK ini sudah siap masuk persiapan invoice.
          </p>
        )}
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
  allowBlankDates = false,
  opnameBySpk,
  opnameValueBySpk,
  padBySpk,
  padValueBySpk,
  dendaValueBySpk,
  stepFilter,
  initialOpenRowId,
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
  allowBlankDates?: boolean
  opnameBySpk: Record<string, string | null>
  opnameValueBySpk: Record<string, number | null>
  padBySpk: Record<string, string | null>
  padValueBySpk: Record<string, number | null>
  dendaValueBySpk: Record<string, number | null>
  /** The `?step=` filter chip currently active — clicking a different chip
   *  re-renders this same table instance with a new `docs` set, so any popup
   *  left open must close instead of possibly matching a same-id row in the
   *  new set and popping back open on its own. */
  stepFilter?: string
  /** Set by Add Data so the new routing document opens immediately. */
  initialOpenRowId?: string
}) {
  const [openRowId, setOpenRowId] = useState<string | null>(initialOpenRowId ?? null)

  useEffect(() => {
    if (initialOpenRowId && docs.some((doc) => doc.id === initialOpenRowId)) {
      setOpenRowId(initialOpenRowId)
    }
  }, [docs, initialOpenRowId])

  const rows = rowsWithVirtual(docs, virtualSpkIds)
  const openRow = rows.find((r) => r.id === openRowId) ?? null
  const openDoc = openRow && !isVirtual(openRow) ? openRow : null
  const openSpkId = openRow?.spk_id

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
      sortAccessor: (row) => opnameBySpk[row.spk_id],
      render: (row) => {
        const markedAt = opnameBySpk[row.spk_id]
        return (
          <div>
            <Badge tone={markedAt ? 'success' : 'neutral'}>{markedAt ? 'Selesai' : 'Belum'}</Badge>
            {markedAt && <div className="tnum mt-1 text-xs text-muted-foreground">{formatDate(markedAt)}</div>}
          </div>
        )
      },
    },
    {
      key: 'pad',
      label: 'PAD',
      align: 'center',
      className: 'text-muted-foreground',
      sortAccessor: (row) => padBySpk[row.spk_id],
      render: (row) => {
        const markedAt = padBySpk[row.spk_id]
        return (
          <div>
            <Badge tone={markedAt ? 'success' : 'neutral'}>{markedAt ? 'Selesai' : 'Belum'}</Badge>
            {markedAt && <div className="tnum mt-1 text-xs text-muted-foreground">{formatDate(markedAt)}</div>}
          </div>
        )
      },
    },
    ...steps.map(
      (step): DataTableColumn<MatrixRow> => ({
        key: step.id,
        label: step.name,
        align: 'center',
        sortAccessor: (row) => {
          if (isVirtual(row)) return null
          const cell = historyByDoc[row.id]?.[step.sequence]
          return cell?.completed_at ?? cell?.started_at ?? null
        },
        render: (row) =>
          isVirtual(row) ? (
            <span className="text-muted-foreground">—</span>
          ) : (
            <StepCell
              cell={historyByDoc[row.id]?.[step.sequence]}
              stepName={step.name}
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
      render: (row) => {
        const spk = spkById[row.spk_id]
        const currentSequence = currentSequenceByDoc[row.id] ?? steps.at(-1)?.sequence
        const currentStepIndex = steps.findIndex((step) => step.sequence === currentSequence)
        const currentStep = currentStepIndex >= 0 ? steps[currentStepIndex] : undefined
        const currentHistory = currentStep ? historyByDoc[row.id]?.[currentStep.sequence] : undefined
        return (
          <RowActions>
            <button
              type="button"
              onClick={() => setOpenRowId(row.id)}
              className="flex items-center gap-2 rounded-md px-2 py-1.5 text-left text-xs font-bold text-slate-700 hover:bg-slate-50"
            >
              <Eye size={14} aria-hidden />
              Detail
            </button>
            {mayEdit && !isVirtual(row) && currentHistory && currentStepIndex > 0 && (
              <DeleteButton
                action={rollbackRoutingStep}
                hiddenFields={{ routing_id: row.id, step_id: currentHistory.id }}
                label="Batalkan tahap terakhir"
                itemLabel={`tahap ${currentStep?.name ?? 'saat ini'}`}
                confirmText={`Tahap ${currentStep?.name ?? 'saat ini'} untuk ${spk?.site_code ?? spk?.spk_number ?? 'SPK ini'} akan dikosongkan dan dikembalikan ke tahap sebelumnya. Riwayat tahap lain tetap tersimpan.`}
              />
            )}
          </RowActions>
        )
      },
    },
  ]

  return (
    <>
      <DataTable
        columns={columns}
        rows={rows}
        rowKey={(row) => row.id}
        onRowClick={(row) => setOpenRowId(row.id)}
        searchAccessor={(row) => {
          const spk = spkById[row.spk_id]
          return [spk?.spk_number, spk?.site_code].filter(Boolean).join(' ')
        }}
        searchPlaceholder="Cari SPK…"
        emptyTitle="Tidak ada dokumen berjalan"
        emptyDescription="Buat dokumen invoice agar posisinya bisa dipantau."
        defaultSort={{ key: 'opname', dir: 'desc' }}
        pageSize={100}
      />
      <RoutingDetailModal
        open={openRowId !== null}
        onOpenChange={(v) => !v && setOpenRowId(null)}
        doc={openDoc}
        spk={openSpkId ? spkById[openSpkId] : undefined}
        steps={steps}
        history={openDoc ? (historyByDoc[openDoc.id] ?? {}) : {}}
        revisionsByStep={revisionsByStep}
        mayEdit={mayEdit}
        opnameMarkedAt={openSpkId ? (opnameBySpk[openSpkId] ?? null) : null}
        opnameValue={openSpkId ? (opnameValueBySpk[openSpkId] ?? null) : null}
        padMarkedAt={openSpkId ? (padBySpk[openSpkId] ?? null) : null}
        padValue={openSpkId ? (padValueBySpk[openSpkId] ?? null) : null}
        dendaValue={openSpkId ? (dendaValueBySpk[openSpkId] ?? null) : null}
        allowBlankDates={allowBlankDates}
      />
    </>
  )
}

function rowsWithVirtual(docs: RoutingDoc[], virtualSpkIds: string[]): MatrixRow[] {
  return [
    ...docs,
    ...virtualSpkIds.map((spkId): VirtualDoc => ({ id: `virtual-${spkId}`, spk_id: spkId, virtual: true })),
  ]
}
