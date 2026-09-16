'use client'

import { useMemo, useState } from 'react'
import { Badge } from '@/components/ui/badge'
import { DataTable, type DataTableColumn } from '@/components/ui/data-table'
import { SpkCell } from '@/components/ui/spk-cell'
import { cn, formatDate, formatRupiah } from '@/lib/utils'
import { FinancialRowEditButton } from './row-edit'

export type FinancialRow = {
  spkId: string
  spkNumber: string
  siteCode: string | null
  status: string
  nilaiSpk: number
  tanggalMulai: string | null
  opnameMarkedAt: string | null
  opnameValue: number | null
  padMarkedAt: string | null
  padValue: number | null
  invoiceDone: boolean
  invoiceNumber: string | null
  invoiceValue: number | null
  invoiceDate: string | null
  dendaValue: number | null
}

type FilterKey = 'all' | 'invoiced' | 'pad_only' | 'opname_only'

const FILTERS: { key: FilterKey; label: string }[] = [
  { key: 'all', label: 'Semua' },
  { key: 'invoiced', label: 'Sudah Invoice' },
  { key: 'pad_only', label: 'Sudah PAD belum Invoice' },
  { key: 'opname_only', label: 'Sudah Opname belum PAD' },
]

function matches(row: FinancialRow, filter: FilterKey) {
  switch (filter) {
    case 'invoiced':
      return row.invoiceDone
    case 'pad_only':
      return !!row.padMarkedAt && !row.invoiceDone
    case 'opname_only':
      return !!row.opnameMarkedAt && !row.padMarkedAt
    default:
      return true
  }
}

/** Section 26.1 — one row per SPK, read live from the SPK itself (Nilai
 *  SPK), the design Opname stage, and the routing document's PAD mark /
 *  Invoiced step — not the old standalone Contract/PAD/Invoice lists. */
export function FinancialReportTable({ rows, mayEdit }: { rows: FinancialRow[]; mayEdit: boolean }) {
  const [filter, setFilter] = useState<FilterKey>('all')
  const filtered = useMemo(() => rows.filter((r) => matches(r, filter)), [rows, filter])

  const columns: DataTableColumn<FinancialRow>[] = [
    {
      key: 'spk',
      label: 'SPK',
      sortAccessor: (row) => row.siteCode ?? row.spkNumber,
      renderTotal: (rows) => (
        <span className="text-xs font-extrabold tracking-wider uppercase">Total ({rows.length} SPK)</span>
      ),
      render: (row) => (
        <>
          <SpkCell id={row.spkId} spkNumber={row.spkNumber} siteCode={row.siteCode} href={`/spk/${row.spkId}?tab=financial`} />
          <div className="text-xs text-muted-foreground">{row.status}</div>
        </>
      ),
    },
    {
      key: 'nilai_spk',
      label: 'Nilai SPK',
      align: 'right',
      sortAccessor: (row) => row.nilaiSpk,
      renderTotal: (rows) => formatRupiah(rows.reduce((sum, r) => sum + r.nilaiSpk, 0)),
      render: (row) => (
        <>
          <div className="tnum font-bold text-slate-900">{formatRupiah(row.nilaiSpk)}</div>
          {row.tanggalMulai && <div className="tnum text-xs text-muted-foreground">{formatDate(row.tanggalMulai)}</div>}
        </>
      ),
    },
    {
      key: 'opname',
      label: 'Opname',
      align: 'right',
      sortAccessor: (row) => row.opnameMarkedAt,
      renderTotal: (rows) => formatRupiah(rows.reduce((sum, r) => sum + (r.opnameValue ?? 0), 0)),
      render: (row) => (
        <>
          <Badge tone={row.opnameMarkedAt ? 'success' : 'neutral'}>{row.opnameMarkedAt ? 'Selesai' : 'Belum'}</Badge>
          {row.opnameValue != null && <div className="tnum text-xs text-muted-foreground">{formatRupiah(row.opnameValue)}</div>}
          {row.opnameMarkedAt && <div className="tnum text-xs text-muted-foreground">{formatDate(row.opnameMarkedAt)}</div>}
        </>
      ),
    },
    {
      key: 'pad',
      label: 'PAD',
      align: 'right',
      sortAccessor: (row) => row.padMarkedAt,
      renderTotal: (rows) => formatRupiah(rows.reduce((sum, r) => sum + (r.padValue ?? 0), 0)),
      render: (row) => (
        <>
          <Badge tone={row.padMarkedAt ? 'success' : 'neutral'}>{row.padMarkedAt ? 'Selesai' : 'Belum'}</Badge>
          {row.padValue != null && <div className="tnum text-xs text-muted-foreground">{formatRupiah(row.padValue)}</div>}
          {row.padMarkedAt && <div className="tnum text-xs text-muted-foreground">{formatDate(row.padMarkedAt)}</div>}
        </>
      ),
    },
    {
      key: 'denda',
      label: 'Denda',
      align: 'right',
      sortAccessor: (row) => row.dendaValue ?? 0,
      renderTotal: (rows) => {
        const total = rows.reduce((sum, r) => sum + (r.dendaValue ?? 0), 0)
        return total > 0 ? <span className="text-danger">{formatRupiah(total)}</span> : '—'
      },
      render: (row) =>
        row.dendaValue ? (
          <span className="tnum font-bold text-danger">{formatRupiah(row.dendaValue)}</span>
        ) : (
          <span className="tnum text-muted-foreground">—</span>
        ),
    },
    {
      key: 'invoice',
      label: 'Invoice',
      align: 'right',
      sortAccessor: (row) => row.invoiceDate,
      renderTotal: (rows) => formatRupiah(rows.reduce((sum, r) => sum + (r.invoiceValue ?? 0), 0)),
      render: (row) => (
        <>
          <Badge tone={row.invoiceDone ? 'success' : 'neutral'}>{row.invoiceDone ? 'Selesai' : 'Belum'}</Badge>
          {row.invoiceNumber && <div className="text-xs text-muted-foreground">{row.invoiceNumber}</div>}
          {row.invoiceValue != null && <div className="tnum text-xs text-muted-foreground">{formatRupiah(row.invoiceValue)}</div>}
          {row.invoiceDate && <div className="tnum text-xs text-muted-foreground">{formatDate(row.invoiceDate)}</div>}
        </>
      ),
    },
    ...(mayEdit
      ? [
          {
            key: 'aksi',
            label: 'Aksi',
            align: 'right' as const,
            stopRowClick: true,
            render: (row: FinancialRow) => (
              <div className="flex justify-end">
                <FinancialRowEditButton row={row} />
              </div>
            ),
          } satisfies DataTableColumn<FinancialRow>,
        ]
      : []),
  ]

  return (
    <div>
      <div className="flex flex-wrap gap-2 border-b border-slate-100 p-3">
        {FILTERS.map((f) => (
          <button
            key={f.key}
            type="button"
            onClick={() => setFilter(f.key)}
            className={cn(
              'rounded-full border px-3 py-1.5 text-xs font-bold transition-colors',
              filter === f.key
                ? 'border-primary bg-primary-soft text-primary'
                : 'border-slate-200 bg-surface text-slate-600 hover:border-primary/40',
            )}
          >
            {f.label}
          </button>
        ))}
      </div>
      <DataTable
        columns={columns}
        rows={filtered}
        rowKey={(row) => row.spkId}
        searchAccessor={(row) => [row.spkNumber, row.siteCode].filter(Boolean).join(' ')}
        searchPlaceholder="Cari SPK…"
        emptyTitle="Tidak ada SPK yang cocok"
        defaultSort={{ key: 'pad', dir: 'desc' }}
        pageSize={100}
      />
    </div>
  )
}
