'use client'

import { useMemo, useState } from 'react'
import { Badge } from '@/components/ui/badge'
import { DataTable, type DataTableColumn } from '@/components/ui/data-table'
import { SpkCell } from '@/components/ui/spk-cell'
import { cn, formatDate, formatRupiah } from '@/lib/utils'

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
export function FinancialReportTable({ rows }: { rows: FinancialRow[] }) {
  const [filter, setFilter] = useState<FilterKey>('all')
  const filtered = useMemo(() => rows.filter((r) => matches(r, filter)), [rows, filter])

  const columns: DataTableColumn<FinancialRow>[] = [
    {
      key: 'spk',
      label: 'SPK',
      sortAccessor: (row) => row.siteCode ?? row.spkNumber,
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
      sortAccessor: (row) => (row.opnameMarkedAt ? 1 : 0),
      render: (row) => (
        <>
          <Badge tone={row.opnameMarkedAt ? 'success' : 'neutral'}>{row.opnameMarkedAt ? 'Selesai' : 'Draft'}</Badge>
          {row.opnameValue != null && <div className="tnum text-xs text-muted-foreground">{formatRupiah(row.opnameValue)}</div>}
          {row.opnameMarkedAt && <div className="tnum text-xs text-muted-foreground">{formatDate(row.opnameMarkedAt)}</div>}
        </>
      ),
    },
    {
      key: 'pad',
      label: 'PAD',
      align: 'right',
      sortAccessor: (row) => (row.padMarkedAt ? 1 : 0),
      render: (row) => (
        <>
          <Badge tone={row.padMarkedAt ? 'success' : 'neutral'}>{row.padMarkedAt ? 'Selesai' : 'Draft'}</Badge>
          {row.padValue != null && <div className="tnum text-xs text-muted-foreground">{formatRupiah(row.padValue)}</div>}
          {row.padMarkedAt && <div className="tnum text-xs text-muted-foreground">{formatDate(row.padMarkedAt)}</div>}
        </>
      ),
    },
    {
      key: 'invoice',
      label: 'Invoice',
      align: 'right',
      sortAccessor: (row) => (row.invoiceDone ? 1 : 0),
      render: (row) => (
        <>
          <Badge tone={row.invoiceDone ? 'success' : 'neutral'}>{row.invoiceDone ? 'Selesai' : 'Draft'}</Badge>
          {row.invoiceNumber && <div className="text-xs text-muted-foreground">{row.invoiceNumber}</div>}
          {row.invoiceValue != null && <div className="tnum text-xs text-muted-foreground">{formatRupiah(row.invoiceValue)}</div>}
          {row.invoiceDate && <div className="tnum text-xs text-muted-foreground">{formatDate(row.invoiceDate)}</div>}
        </>
      ),
    },
    {
      key: 'denda',
      label: 'Denda',
      align: 'right',
      sortAccessor: (row) => row.dendaValue ?? 0,
      render: (row) =>
        row.dendaValue ? (
          <span className="tnum font-bold text-danger">{formatRupiah(row.dendaValue)}</span>
        ) : (
          <span className="tnum text-muted-foreground">—</span>
        ),
    },
    {
      key: 'outstanding',
      label: 'Outstanding',
      align: 'right',
      sortAccessor: (row) => row.nilaiSpk - (row.invoiceValue ?? 0),
      render: (row) => {
        const outstanding = row.nilaiSpk - (row.invoiceValue ?? 0)
        return (
          <span className={cn('tnum', outstanding > 0 && 'font-bold text-danger')}>
            {outstanding !== 0 ? formatRupiah(outstanding) : '—'}
          </span>
        )
      },
    },
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
        pageSize={100}
      />
    </div>
  )
}
