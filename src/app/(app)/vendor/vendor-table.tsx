'use client'

import Link from 'next/link'
import { StatusBadge } from '@/components/ui/badge'
import { DeleteButton } from '@/components/ui/delete-button'
import { DataTable, type DataTableColumn } from '@/components/ui/data-table'
import type { Database } from '@/lib/supabase/types'
import { deleteVendor } from './actions'

type VendorRow = Database['public']['Tables']['vendors']['Row']

export function VendorTable({
  vendors,
  teamsByVendor,
  membersByVendor,
  spkByVendor,
  mayEdit,
}: {
  vendors: VendorRow[]
  teamsByVendor: Record<string, number>
  membersByVendor: Record<string, number>
  spkByVendor: Record<string, number>
  mayEdit: boolean
}) {
  const columns: DataTableColumn<VendorRow>[] = [
    {
      key: 'name',
      label: 'Vendor',
      sortAccessor: (row) => row.name,
      render: (row) => (
        <>
          <Link href={`/vendor/${row.id}`} className="font-bold text-primary hover:underline">
            {row.name}
          </Link>
          <div className="code text-xs text-slate-500">{row.code}</div>
        </>
      ),
    },
    {
      key: 'contact_person',
      label: 'Contact person',
      className: 'text-muted-foreground',
      sortAccessor: (row) => row.contact_person,
      render: (row) => row.contact_person ?? '—',
    },
    {
      key: 'phone',
      label: 'Telepon',
      className: 'tnum text-muted-foreground',
      sortAccessor: (row) => row.phone,
      render: (row) => row.phone ?? '—',
    },
    {
      key: 'teams',
      label: 'Team',
      align: 'right',
      sortAccessor: (row) => teamsByVendor[row.id] ?? 0,
      render: (row) => teamsByVendor[row.id] ?? 0,
    },
    {
      key: 'members',
      label: 'Anggota',
      align: 'right',
      sortAccessor: (row) => membersByVendor[row.id] ?? 0,
      render: (row) => membersByVendor[row.id] ?? 0,
    },
    {
      key: 'spk_active',
      label: 'SPK aktif',
      align: 'right',
      sortAccessor: (row) => spkByVendor[row.id] ?? 0,
      render: (row) => spkByVendor[row.id] ?? 0,
    },
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
            render: (row: VendorRow) => (
              <DeleteButton action={deleteVendor} hiddenFields={{ id: row.id }} />
            ),
          } satisfies DataTableColumn<VendorRow>,
        ]
      : []),
  ]

  return (
    <DataTable
      columns={columns}
      rows={vendors}
      rowKey={(row) => row.id}
      searchAccessor={(row) => [row.name, row.code, row.contact_person, row.phone].filter(Boolean).join(' ')}
      searchPlaceholder="Cari nama, kode, atau contact person…"
      emptyTitle="Belum ada vendor"
    />
  )
}
