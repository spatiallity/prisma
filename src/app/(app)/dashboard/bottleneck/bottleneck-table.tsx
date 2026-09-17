'use client'

import Link from 'next/link'
import { Badge } from '@/components/ui/badge'
import { DataTable, type DataTableColumn } from '@/components/ui/data-table'
import { SpkCell } from '@/components/ui/spk-cell'
import { AREA_LABEL, SEVERITY_RANK, SEVERITY_TONE } from '@/lib/dashboard'
import { formatDate } from '@/lib/utils'
import type { NotificationSeverity } from '@/lib/supabase/types'

export type BottleneckRow = {
  key: string
  area: string
  reason: string
  spk_id: string | null
  spk_number: string | null
  site_code: string | null
  severity: NotificationSeverity
  tanggal: string | null
  hari: number | null
  prosesTerakhir: string | null
  tanggalProsesTerakhir: string | null
}

/** Where each area's problems are dealt with. */
const AREA_LINK: Record<string, string> = {
  design: '/design',
  routing: '/routing',
  financial: '/financial/invoice',
}

/** Same DataTable every other list uses — numbered rows, sortable columns,
 *  search — instead of a bespoke table just for this page. Ukuran (a mixed
 *  rupiah/days figure depending on the reason) is gone; Tanggal/Hari say
 *  the same thing consistently for every reason that has a clear "since
 *  when" (see bottleneckSinceDate). */
export function BottleneckTable({ rows }: { rows: BottleneckRow[] }) {
  const columns: DataTableColumn<BottleneckRow>[] = [
    {
      key: 'spk',
      label: 'SPK',
      sortAccessor: (row) => row.site_code ?? row.spk_number,
      render: (row) =>
        row.spk_id ? (
          <SpkCell id={row.spk_id} spkNumber={row.spk_number ?? 'SPK'} siteCode={row.site_code} />
        ) : (
          <span className="text-muted-foreground">Seluruh project</span>
        ),
    },
    {
      key: 'area',
      label: 'Area',
      sortAccessor: (row) => row.area,
      render: (row) => (
        <Link href={AREA_LINK[row.area] ?? '/dashboard'} className="text-xs font-bold text-primary hover:underline">
          {AREA_LABEL[row.area] ?? row.area}
        </Link>
      ),
    },
    {
      key: 'reason',
      label: 'Keterangan',
      className: 'min-w-[150px]',
      sortAccessor: (row) => row.reason,
      render: (row) => <span className="font-bold text-slate-900">{row.reason}</span>,
    },
    {
      key: 'proses-terakhir',
      label: 'Proses terakhir',
      className: 'min-w-[190px]',
      sortAccessor: (row) => row.prosesTerakhir,
      render: (row) => <span className="text-sm font-bold text-slate-800">{row.prosesTerakhir ?? '—'}</span>,
    },
    {
      key: 'tanggal-proses-terakhir',
      label: 'Update terakhir',
      className: 'tnum whitespace-nowrap text-muted-foreground',
      sortAccessor: (row) => row.tanggalProsesTerakhir,
      render: (row) => (row.tanggalProsesTerakhir ? formatDate(row.tanggalProsesTerakhir) : '—'),
    },
    {
      key: 'tanggal',
      label: 'Mulai tertahan',
      className: 'tnum whitespace-nowrap text-muted-foreground',
      sortAccessor: (row) => row.tanggal,
      render: (row) => (row.tanggal ? formatDate(row.tanggal) : '—'),
    },
    {
      key: 'hari',
      label: 'Hari',
      align: 'right',
      sortAccessor: (row) => row.hari,
      render: (row) => (row.hari !== null ? `${row.hari} hari` : '—'),
    },
    {
      key: 'severity',
      label: 'Severity',
      sortAccessor: (row) => SEVERITY_RANK[row.severity],
      render: (row) => <Badge tone={SEVERITY_TONE[row.severity]}>{row.severity}</Badge>,
    },
  ]

  return (
    <DataTable
      columns={columns}
      rows={rows}
      rowKey={(row) => row.key}
      searchAccessor={(row) => [row.reason, row.spk_number, row.site_code].filter(Boolean).join(' ')}
      searchPlaceholder="Cari SPK atau kondisi…"
      emptyTitle="Tidak ada bottleneck"
      emptyDescription="Semua kondisi berada dalam batas yang disetel."
      defaultSort={{ key: 'severity', dir: 'asc' }}
      pageSize={100}
    />
  )
}
