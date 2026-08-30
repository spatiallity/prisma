'use client'

import Link from 'next/link'
import { Badge } from '@/components/ui/badge'
import { DeleteButton } from '@/components/ui/delete-button'
import { DataTable, type DataTableColumn } from '@/components/ui/data-table'
import { formatDate, formatRupiah } from '@/lib/utils'
import { SPK_STATUS_TONE, daysLeft, formatArea, formatPercent } from '@/lib/spk'
import type { Database } from '@/lib/supabase/types'
import { deleteSpk } from './actions'

type SpkRow = Database['public']['Tables']['spks']['Row']

/**
 * Sorting only — search and status already live in SpkFilters (server-side,
 * so it stays fast at any row count); this just adds click-to-sort on top.
 */
export function SpkTable({
  spks,
  vendorName,
  progressBySpk,
  mayEdit,
}: {
  spks: SpkRow[]
  vendorName: Record<string, string>
  progressBySpk: Record<string, number>
  mayEdit: boolean
}) {
  const columns: DataTableColumn<SpkRow>[] = [
    {
      key: 'spk_number',
      label: 'SPK',
      sortAccessor: (row) => row.spk_number,
      render: (row) => (
        <>
          <Link href={`/spk/${row.id}`} className="font-bold text-primary hover:underline">
            {row.spk_number}
          </Link>
          {row.site_code && (
            <div className="text-xs font-semibold text-slate-500">{row.site_code}</div>
          )}
        </>
      ),
    },
    {
      key: 'work_name',
      label: 'Pekerjaan',
      className: 'max-w-xs',
      sortAccessor: (row) => row.work_name,
      render: (row) => (
        <>
          <span className="line-clamp-2 font-bold text-slate-900">{row.work_name}</span>
          {row.work_type && (
            <div className="text-xs text-muted-foreground">{row.work_type}</div>
          )}
        </>
      ),
    },
    {
      key: 'location',
      label: 'Lokasi',
      className: 'text-muted-foreground',
      sortAccessor: (row) => row.location,
      render: (row) => (
        <>
          {row.location ?? '—'}
          {row.kabupaten && <div className="text-xs">{row.kabupaten}</div>}
        </>
      ),
    },
    {
      key: 'area_ha',
      label: 'Luas',
      align: 'right',
      sortAccessor: (row) => row.area_ha,
      render: (row) => formatArea(row.area_ha),
    },
    {
      key: 'contract_value',
      label: 'Nilai kontrak',
      align: 'right',
      sortAccessor: (row) => Number(row.contract_value ?? 0),
      render: (row) => formatRupiah(row.contract_value),
    },
    {
      key: 'vendor',
      label: 'Vendor',
      className: 'text-muted-foreground',
      sortAccessor: (row) => (row.vendor_id ? (vendorName[row.vendor_id] ?? null) : null),
      render: (row) => (row.vendor_id ? (vendorName[row.vendor_id] ?? '—') : '—'),
    },
    {
      key: 'periode',
      label: 'Periode',
      className: 'whitespace-nowrap tnum text-muted-foreground',
      sortAccessor: (row) => row.start_date,
      render: (row) => {
        const remaining = daysLeft(row.end_date)
        const overdue = remaining !== null && remaining < 0 && row.status === 'On Going'
        return (
          <>
            {formatDate(row.start_date)} – {formatDate(row.end_date)}
            {overdue && (
              <div className="text-xs font-bold text-danger">Lewat {Math.abs(remaining)} hari</div>
            )}
          </>
        )
      },
    },
    {
      key: 'progress',
      label: 'Progress',
      align: 'right',
      className: 'font-bold',
      sortAccessor: (row) => progressBySpk[row.id] ?? 0,
      render: (row) => formatPercent(progressBySpk[row.id] ?? 0),
    },
    {
      key: 'status',
      label: 'Status',
      sortAccessor: (row) => row.status,
      render: (row) => <Badge tone={SPK_STATUS_TONE[row.status]}>{row.status}</Badge>,
    },
    ...(mayEdit
      ? [
          {
            key: 'aksi',
            label: 'Aksi',
            align: 'right' as const,
            render: (row: SpkRow) => (
              <DeleteButton
                action={deleteSpk}
                hiddenFields={{ id: row.id }}
                confirmText="SPK ini beserta seluruh activities, progress, jadwal, desain, routing, dan dokumen revenue-nya akan dihapus permanen."
              />
            ),
          } satisfies DataTableColumn<SpkRow>,
        ]
      : []),
  ]

  return (
    <DataTable
      columns={columns}
      rows={spks}
      rowKey={(row) => row.id}
      emptyTitle="Belum ada SPK"
    />
  )
}
