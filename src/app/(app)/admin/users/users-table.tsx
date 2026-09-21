'use client'

import Link from 'next/link'
import { Pencil } from 'lucide-react'
import { Badge, StatusBadge } from '@/components/ui/badge'
import { DeleteButton } from '@/components/ui/delete-button'
import { DataTable, type DataTableColumn } from '@/components/ui/data-table'
import { formatDateTime } from '@/lib/utils'
import type { Database } from '@/lib/supabase/types'
import { deleteUserProfile } from './actions'

type UserRow = Database['public']['Tables']['users']['Row']

export function UsersTable({
  users,
  currentUserId,
  roleName,
  vendorName,
  mayEdit,
}: {
  users: UserRow[]
  currentUserId: string
  roleName: Record<string, string>
  vendorName: Record<string, string>
  mayEdit: boolean
}) {
  const columns: DataTableColumn<UserRow>[] = [
    {
      key: 'full_name',
      label: 'Nama',
      className: 'font-bold text-slate-900',
      sortAccessor: (row) => row.full_name,
      render: (row) => (
        <>
          {row.full_name}
          {row.id === currentUserId && (
            <Badge tone="primary" className="ml-2">
              Anda
            </Badge>
          )}
        </>
      ),
    },
    {
      key: 'email',
      label: 'Email',
      className: 'text-muted-foreground',
      sortAccessor: (row) => row.email,
      render: (row) => row.email,
    },
    {
      key: 'role',
      label: 'Role',
      sortAccessor: (row) => roleName[row.role_id] ?? null,
      render: (row) => roleName[row.role_id] ?? '—',
    },
    {
      key: 'vendor',
      label: 'Vendor',
      className: 'text-muted-foreground',
      sortAccessor: (row) => (row.vendor_id ? (vendorName[row.vendor_id] ?? null) : null),
      render: (row) => (row.vendor_id ? (vendorName[row.vendor_id] ?? '—') : '—'),
    },
    {
      key: 'status',
      label: 'Status',
      sortAccessor: (row) => row.status,
      render: (row) => <StatusBadge status={row.status} />,
    },
    {
      key: 'last_login_at',
      label: 'Login terakhir',
      className: 'tnum text-muted-foreground',
      sortAccessor: (row) => row.last_login_at,
      render: (row) => formatDateTime(row.last_login_at),
    },
    ...(mayEdit
      ? [
          {
            key: 'aksi',
            label: 'Aksi',
            align: 'right' as const,
            render: (row: UserRow) => (
              <div className="flex items-center justify-end gap-1">
                <Link
                  href={`/admin/users/${row.id}`}
                  className="inline-flex h-9 w-9 items-center justify-center rounded-lg border border-transparent text-primary hover:border-primary/20 hover:bg-primary-soft"
                  aria-label="Kelola user"
                  title="Kelola user"
                >
                  <Pencil size={16} aria-hidden />
                </Link>
                {row.id !== currentUserId && (
                  <DeleteButton action={deleteUserProfile} hiddenFields={{ id: row.id }} iconOnly />
                )}
              </div>
            ),
          } satisfies DataTableColumn<UserRow>,
        ]
      : []),
  ]

  return (
    <DataTable
      columns={columns}
      rows={users}
      rowKey={(row) => row.id}
      searchAccessor={(row) => [row.full_name, row.email].filter(Boolean).join(' ')}
      searchPlaceholder="Cari nama atau email…"
      emptyTitle="Belum ada user"
    />
  )
}
