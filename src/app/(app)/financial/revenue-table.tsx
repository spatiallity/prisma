'use client'

import { Badge } from '@/components/ui/badge'
import { DataTable, type DataTableColumn } from '@/components/ui/data-table'
import { SpkCell } from '@/components/ui/spk-cell'
import { RowActions } from '@/components/ui/row-actions'
import { formatDate, formatRupiah } from '@/lib/utils'
import {
  DOC_STATUS_TONE,
  financialDisplayStatus,
  financialStatusLabel,
  type REVENUE_META,
} from '@/lib/financial'
import type { FinancialDocStatus } from '@/lib/supabase/types'
import { EditRevenueButton, RevenueDeleteButton, RevenueStatusToggle, type Choice } from './revenue-form'
import type { RevenueKind } from '@/lib/financial'

export type DocRow = {
  id: string
  spkId: string
  number: string | null
  value: number
  date: string | null
  status: FinancialDocStatus
  extra: string | null
  notes: string | null
  amendmentNo?: number
  dendaValue?: number | null
  dueDate?: string | null
  parentId?: string | null
}

type SpkLite = { id: string; spk_number: string; site_code: string | null; start_date?: string | null }

export function RevenueTable({
  kind,
  rows,
  spkById,
  meta,
  mayEdit,
  spks,
  parents,
}: {
  kind: RevenueKind
  rows: DocRow[]
  spkById: Record<string, SpkLite>
  meta: (typeof REVENUE_META)[RevenueKind]
  mayEdit: boolean
  spks: Choice[]
  parents: Choice[]
}) {
  const columns: DataTableColumn<DocRow>[] = [
    {
      key: 'spk',
      label: 'SPK',
      sortAccessor: (row) => {
        const spk = spkById[row.spkId]
        return spk?.site_code ?? spk?.spk_number ?? null
      },
      render: (row) => {
        const spk = spkById[row.spkId]
        return (
          <SpkCell id={row.spkId} spkNumber={spk?.spk_number ?? 'SPK'} siteCode={spk?.site_code ?? null} />
        )
      },
    },
    {
      key: 'number',
      label: meta.numberLabel,
      className: 'font-bold text-slate-900',
      sortAccessor: (row) => row.number,
      render: (row) => row.number ?? '—',
    },
    {
      key: 'date',
      label: kind === 'contract' ? 'Tanggal mulai pekerjaan' : meta.dateLabel,
      className: 'tnum text-muted-foreground',
      sortAccessor: (row) =>
        kind === 'contract' ? spkById[row.spkId]?.start_date ?? null : row.date,
      render: (row) =>
        formatDate(kind === 'contract' ? spkById[row.spkId]?.start_date ?? null : row.date),
    },
    {
      key: 'value',
      label: meta.valueLabel,
      align: 'right',
      className: 'font-bold',
      sortAccessor: (row) => row.value,
      render: (row) => formatRupiah(row.value),
    },
    ...(kind === 'contract'
      ? []
      : [
          {
            key: 'extra',
            label: 'Keterangan',
            className: 'text-muted-foreground',
            render: (row: DocRow) => (
              <>
                {row.extra ?? '—'}
                {row.notes && <div className="text-xs">{row.notes}</div>}
              </>
            ),
          } satisfies DataTableColumn<DocRow>,
          {
            key: 'status',
            label: 'Status',
            sortAccessor: (row: DocRow) =>
              financialDisplayStatus(row.status, {
                invoiceDate: kind === 'invoice' ? row.date : 'filled',
              }),
            render: (row: DocRow) => {
              const status = financialDisplayStatus(row.status, {
                invoiceDate: kind === 'invoice' ? row.date : 'filled',
              })
              return <Badge tone={DOC_STATUS_TONE[status]}>{financialStatusLabel(status)}</Badge>
            },
          } satisfies DataTableColumn<DocRow>,
        ]),
    ...(mayEdit
      ? [
          {
            key: 'aksi',
            label: 'Aksi',
            align: 'right' as const,
            render: (row: DocRow) => (
              <RowActions>
                <EditRevenueButton kind={kind} spks={spks} parents={parents} initial={row} />
                <RevenueStatusToggle kind={kind} id={row.id} status={row.status} />
                <RevenueDeleteButton kind={kind} id={row.id} spkId={row.spkId} />
              </RowActions>
            ),
          } satisfies DataTableColumn<DocRow>,
        ]
      : []),
  ]

  return (
    <DataTable
      columns={columns}
      rows={rows}
      rowKey={(row) => row.id}
      searchAccessor={(row) => {
        const spk = spkById[row.spkId]
        return [row.number, spk?.spk_number, spk?.site_code, row.notes].filter(Boolean).join(' ')
      }}
      searchPlaceholder={`Cari nomor, SPK, atau catatan…`}
      emptyTitle={`Belum ada ${meta.label}`}
      emptyDescription={meta.description}
      pageSize={100}
    />
  )
}
