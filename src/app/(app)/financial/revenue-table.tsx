'use client'

import { Badge } from '@/components/ui/badge'
import { DataTable, type DataTableColumn } from '@/components/ui/data-table'
import { SpkCell } from '@/components/ui/spk-cell'
import { formatDate, formatRupiah } from '@/lib/utils'
import { DOC_STATUS_TONE, type REVENUE_META } from '@/lib/financial'
import type { FinancialDocStatus } from '@/lib/supabase/types'
import { RevenueDeleteButton, RevenueStatusToggle } from './revenue-form'
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
}

type SpkLite = { id: string; spk_number: string; site_code: string | null }

export function RevenueTable({
  kind,
  rows,
  spkById,
  meta,
  mayEdit,
}: {
  kind: RevenueKind
  rows: DocRow[]
  spkById: Record<string, SpkLite>
  meta: (typeof REVENUE_META)[RevenueKind]
  mayEdit: boolean
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
      label: meta.dateLabel,
      className: 'tnum text-muted-foreground',
      sortAccessor: (row) => row.date,
      render: (row) => formatDate(row.date),
    },
    {
      key: 'value',
      label: meta.valueLabel,
      align: 'right',
      className: 'font-bold',
      sortAccessor: (row) => row.value,
      render: (row) => formatRupiah(row.value),
    },
    {
      key: 'extra',
      label: 'Keterangan',
      className: 'text-muted-foreground',
      render: (row) => (
        <>
          {row.extra ?? '—'}
          {row.notes && <div className="text-xs">{row.notes}</div>}
        </>
      ),
    },
    {
      key: 'status',
      label: 'Status',
      sortAccessor: (row) => row.status,
      render: (row) => <Badge tone={DOC_STATUS_TONE[row.status]}>{row.status}</Badge>,
    },
    ...(mayEdit
      ? [
          {
            key: 'aksi',
            label: 'Aksi',
            align: 'right' as const,
            render: (row: DocRow) => (
              <div className="flex items-center justify-end gap-3">
                <RevenueStatusToggle kind={kind} id={row.id} status={row.status} />
                <RevenueDeleteButton kind={kind} id={row.id} spkId={row.spkId} />
              </div>
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
