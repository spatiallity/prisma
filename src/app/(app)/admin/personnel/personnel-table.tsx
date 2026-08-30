'use client'

import { StatusBadge } from '@/components/ui/badge'
import { DeleteButton } from '@/components/ui/delete-button'
import { DataTable, type DataTableColumn } from '@/components/ui/data-table'
import { formatDate, formatRupiah } from '@/lib/utils'
import type { Database } from '@/lib/supabase/types'
import { EditPersonnelButton, PersonnelStatusToggle } from './forms'
import { deletePersonnel } from './actions'

type PersonnelRow = Database['public']['Tables']['personnel']['Row']
type Spend = { count: number; total: number }

export function PersonnelTable({
  personnel,
  spend,
  seeCost,
  mayEdit,
}: {
  personnel: PersonnelRow[]
  spend: Record<string, Spend>
  seeCost: boolean
  mayEdit: boolean
}) {
  const columns: DataTableColumn<PersonnelRow>[] = [
    {
      key: 'full_name',
      label: 'Nama',
      className: 'font-bold text-slate-900',
      sortAccessor: (row) => row.full_name,
      render: (row) => row.full_name,
    },
    {
      key: 'code',
      label: 'Kode',
      sortAccessor: (row) => row.code,
      render: (row) =>
        row.code ? (
          <span className="code text-xs">{row.code}</span>
        ) : (
          <span className="text-muted-foreground">—</span>
        ),
    },
    {
      key: 'position',
      label: 'Posisi',
      className: 'text-muted-foreground',
      sortAccessor: (row) => row.position,
      render: (row) => row.position ?? '—',
    },
    {
      key: 'join_date',
      label: 'Masuk',
      className: 'tnum text-muted-foreground',
      sortAccessor: (row) => row.join_date,
      render: (row) => formatDate(row.join_date),
    },
    ...(seeCost
      ? [
          {
            key: 'cost_count',
            label: 'Entri biaya',
            align: 'right' as const,
            sortAccessor: (row: PersonnelRow) => spend[row.id]?.count ?? 0,
            render: (row: PersonnelRow) => spend[row.id]?.count ?? 0,
          } satisfies DataTableColumn<PersonnelRow>,
          {
            key: 'cost_total',
            label: 'Total biaya',
            align: 'right' as const,
            className: 'font-bold',
            sortAccessor: (row: PersonnelRow) => spend[row.id]?.total ?? 0,
            render: (row: PersonnelRow) => {
              const total = spend[row.id]?.total ?? 0
              return total > 0 ? formatRupiah(total) : '—'
            },
          } satisfies DataTableColumn<PersonnelRow>,
        ]
      : []),
    {
      key: 'status',
      label: 'Status',
      sortAccessor: (row) => row.status,
      render: (row) => <StatusBadge status={row.status} />,
    },
    ...(mayEdit
      ? [
          {
            key: 'aksi',
            label: 'Aksi',
            align: 'right' as const,
            render: (row: PersonnelRow) => (
              <div className="flex items-center justify-end gap-3">
                <EditPersonnelButton personnel={row} />
                <PersonnelStatusToggle id={row.id} status={row.status} />
                <DeleteButton action={deletePersonnel} hiddenFields={{ id: row.id }} />
              </div>
            ),
          } satisfies DataTableColumn<PersonnelRow>,
        ]
      : []),
  ]

  return (
    <DataTable
      columns={columns}
      rows={personnel}
      rowKey={(row) => row.id}
      searchAccessor={(row) => [row.full_name, row.code, row.position].filter(Boolean).join(' ')}
      searchPlaceholder="Cari nama, kode, atau posisi…"
      emptyTitle="Belum ada personel"
    />
  )
}
