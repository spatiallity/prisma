'use client'

import Link from 'next/link'
import { Pencil } from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { DeleteButton } from '@/components/ui/delete-button'
import { DataTable, type DataTableColumn } from '@/components/ui/data-table'
import { RowActions } from '@/components/ui/row-actions'
import { SpkCell } from '@/components/ui/spk-cell'
import { formatDate, formatRupiah } from '@/lib/utils'
import { SPK_STATUS_TONE, daysLeft, formatArea, spkStatusLabel } from '@/lib/spk'
import type { Database } from '@/lib/supabase/types'
import type { SpkStage } from '@/lib/spk-stage'
import { deleteSpk } from './actions'

type SpkRow = Database['public']['Tables']['spks']['Row']
export type { SpkStage }

/**
 * Sorting only — search and status already live in SpkFilters (server-side,
 * so it stays fast at any row count); this just adds click-to-sort on top.
 */
export function SpkTable({
  spks,
  stageBySpk,
  mayEdit,
}: {
  spks: SpkRow[]
  stageBySpk: Record<string, SpkStage>
  mayEdit: boolean
}) {
  const columns: DataTableColumn<SpkRow>[] = [
    {
      key: 'spk_number',
      label: 'SPK',
      sortAccessor: (row) => row.site_code ?? row.spk_number,
      render: (row) => <SpkCell id={row.id} spkNumber={row.spk_number} siteCode={row.site_code} />,
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
      key: 'volume',
      label: 'Volume Pekerjaan',
      align: 'right',
      sortAccessor: (row) => (row.work_type === 'Stake Out' ? row.stake_out_patok : row.area_ha),
      renderTotal: (rows) => formatArea(rows.reduce((sum, r) => sum + Number(r.area_ha ?? 0), 0)),
      render: (row) =>
        row.work_type === 'Stake Out'
          ? row.stake_out_patok != null
            ? `${row.stake_out_patok} patok`
            : '—'
          : formatArea(row.area_ha),
    },
    {
      key: 'contract_value',
      label: 'Nilai kontrak',
      align: 'right',
      sortAccessor: (row) => Number(row.contract_value ?? 0),
      renderTotal: (rows) => formatRupiah(rows.reduce((sum, r) => sum + Number(r.contract_value ?? 0), 0)),
      render: (row) => formatRupiah(row.contract_value),
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
      className: 'text-muted-foreground',
      sortAccessor: (row) => stageBySpk[row.id]?.label ?? null,
      render: (row) => {
        const stage = stageBySpk[row.id]
        if (!stage) return '—'
        return (
          <>
            <span className="font-bold text-slate-900">{stage.label}</span>
            {stage.date && (
              <div className="tnum text-xs text-muted-foreground">{formatDate(stage.date)}</div>
            )}
          </>
        )
      },
    },
    {
      key: 'status',
      label: 'Status',
      sortAccessor: (row) => row.status,
      render: (row) => <Badge tone={SPK_STATUS_TONE[row.status]}>{spkStatusLabel(row.status)}</Badge>,
    },
    ...(mayEdit
      ? [
          {
            key: 'aksi',
            label: 'Aksi',
            align: 'right' as const,
            render: (row: SpkRow) => (
              <RowActions>
                <Link
                  href={`/spk/${row.id}/edit`}
                  className="flex items-center gap-2 rounded-md px-2 py-1.5 text-left text-xs font-bold text-slate-700 hover:bg-slate-50"
                >
                  <Pencil size={14} aria-hidden />
                  Edit
                </Link>
                <DeleteButton
                  action={deleteSpk}
                  hiddenFields={{ id: row.id }}
                  confirmText="SPK ini beserta seluruh activities, progress, jadwal, desain, routing, dan dokumen revenue-nya akan dihapus permanen."
                />
              </RowActions>
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
      pageSize={100}
    />
  )
}
