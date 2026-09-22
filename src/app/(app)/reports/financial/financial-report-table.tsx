'use client'

import { useMemo, useState } from 'react'
import { Badge } from '@/components/ui/badge'
import { DataTable, type DataTableColumn } from '@/components/ui/data-table'
import { SpkCell } from '@/components/ui/spk-cell'
import { cn, formatDate, formatRupiah } from '@/lib/utils'
import { spkStatusLabel } from '@/lib/spk'
import type { SpkStatus } from '@/lib/supabase/types'
import { FinancialRowEditButton } from './row-edit'

export type FinancialRow = {
  spkId: string
  spkNumber: string
  siteCode: string | null
  status: SpkStatus
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
  { key: 'invoiced', label: 'Sudah Invoiced' },
  { key: 'pad_only', label: 'Sudah PAD belum Invoiced' },
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
  const filterCounts = useMemo(
    () => Object.fromEntries(FILTERS.map((f) => [f.key, rows.filter((row) => matches(row, f.key)).length])) as Record<FilterKey, number>,
    [rows],
  )

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
          <div className="text-xs text-muted-foreground">{spkStatusLabel(row.status)}</div>
        </>
      ),
    },
    {
      key: 'progress',
      label: 'Alur bayar',
      sortAccessor: (row) => {
        if (row.invoiceDone) return 4
        if (row.padMarkedAt) return 3
        if (row.opnameMarkedAt) return 2
        return 1
      },
      render: (row) => {
        const steps = [
          { label: 'Opname', done: !!row.opnameMarkedAt },
          { label: 'PAD', done: !!row.padMarkedAt },
          { label: 'Invoiced', done: row.invoiceDone },
        ]
        return (
          <div className="min-w-[170px]">
            <div className="flex gap-1">
              {steps.map((step) => (
                <div
                  key={step.label}
                  className={cn('h-2 flex-1 rounded-full', step.done ? 'bg-success' : 'bg-slate-200')}
                  title={step.label}
                />
              ))}
            </div>
            <div className="mt-1 text-xs font-semibold text-muted-foreground">
              {row.invoiceDone ? 'Invoiced selesai' : row.padMarkedAt ? 'Menunggu invoiced' : row.opnameMarkedAt ? 'Menunggu PAD' : 'Menunggu opname'}
            </div>
          </div>
        )
      },
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
      label: 'Invoiced',
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
      <div className="flex flex-wrap items-center gap-2 border-b border-slate-100 bg-slate-50/60 p-3">
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
            <span className={cn('tnum ml-2 rounded-full px-2 py-0.5', filter === f.key ? 'bg-white/70' : 'bg-slate-100')}>
              {filterCounts[f.key]}
            </span>
          </button>
        ))}
      </div>
      <DataTable
        columns={columns}
        rows={filtered}
        rowKey={(row) => row.spkId}
        searchAccessor={(row) => [row.spkNumber, row.siteCode, row.invoiceNumber].filter(Boolean).join(' ')}
        searchPlaceholder="Cari SPK…"
        emptyTitle="Tidak ada SPK yang cocok"
        defaultSort={{ key: 'pad', dir: 'desc' }}
        pageSize={100}
      />
    </div>
  )
}
