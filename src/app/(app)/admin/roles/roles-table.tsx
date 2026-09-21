'use client'

import Link from 'next/link'
import { Pencil } from 'lucide-react'
import { Badge, StatusBadge } from '@/components/ui/badge'
import { DataTable, type DataTableColumn } from '@/components/ui/data-table'
import { DeleteButton } from '@/components/ui/delete-button'
import type { Database } from '@/lib/supabase/types'
import { deleteRole } from './actions'

type RoleRow = Database['public']['Tables']['roles']['Row']

export function RolesTable({
  roles,
  grantCount,
  userCount,
  mayEdit,
  mayManageRoles,
}: {
  roles: RoleRow[]
  grantCount: Record<string, number>
  userCount: Record<string, number>
  mayEdit: boolean
  mayManageRoles: boolean
}) {
  const columns: DataTableColumn<RoleRow>[] = [
    {
      key: 'name',
      label: 'Role',
      className: 'font-bold text-slate-900',
      sortAccessor: (row) => row.name,
      render: (row) => (
        <>
          {row.name}
          <Badge className="ml-2 code">{row.code}</Badge>
        </>
      ),
    },
    {
      key: 'description',
      label: 'Deskripsi',
      className: 'max-w-md text-muted-foreground',
      render: (row) => row.description ?? '—',
    },
    {
      key: 'permissions',
      label: 'Permission',
      align: 'right',
      sortAccessor: (row) => grantCount[row.id] ?? 0,
      render: (row) => grantCount[row.id] ?? 0,
    },
    {
      key: 'users',
      label: 'User aktif',
      align: 'right',
      sortAccessor: (row) => userCount[row.id] ?? 0,
      render: (row) => userCount[row.id] ?? 0,
    },
    {
      key: 'status',
      label: 'Status',
      sortAccessor: (row) => row.status,
      render: (row) => <StatusBadge status={row.status} />,
    },
    {
      key: 'aksi',
      label: 'Aksi',
      align: 'right',
      render: (row) => (
        <div className="flex justify-end gap-1">
          <Link
            href={`/admin/roles/${row.id}`}
            className="inline-flex h-9 w-9 items-center justify-center rounded-lg border border-transparent text-primary hover:border-primary/20 hover:bg-primary-soft"
            aria-label={mayEdit ? 'Atur permission' : 'Lihat permission'}
            title={mayEdit ? 'Atur permission' : 'Lihat permission'}
          >
            <Pencil size={16} aria-hidden />
          </Link>
          {mayManageRoles && !['administration', 'drafter', 'management', 'operational', 'project_manager', 'super_admin', 'tester', 'vendor'].includes(row.code) && (
            <DeleteButton
              action={deleteRole}
              hiddenFields={{ id: row.id }}
              itemLabel={`role ${row.name}`}
              confirmText={`Hapus role ${row.name}? Role ini beserta seluruh permission-nya akan dihapus permanen.`}
              iconOnly
            />
          )}
        </div>
      ),
    },
  ]

  return (
    <DataTable
      columns={columns}
      rows={roles}
      rowKey={(row) => row.id}
      searchAccessor={(row) => [row.name, row.code, row.description].filter(Boolean).join(' ')}
      searchPlaceholder="Cari nama atau kode role…"
      emptyTitle="Belum ada role"
    />
  )
}
