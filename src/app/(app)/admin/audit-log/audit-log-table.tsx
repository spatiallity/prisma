'use client'

import { Badge } from '@/components/ui/badge'
import { DataTable, type DataTableColumn } from '@/components/ui/data-table'
import { formatDateTime } from '@/lib/utils'
import type { Database } from '@/lib/supabase/types'

type AuditLogRow = Database['public']['Tables']['audit_logs']['Row']

const ACTION_TONE = {
  INSERT: 'success',
  UPDATE: 'info',
  DELETE: 'danger',
} as const

export function AuditLogTable({
  entries,
  actorName,
}: {
  entries: AuditLogRow[]
  actorName: Record<string, string>
}) {
  const columns: DataTableColumn<AuditLogRow>[] = [
    {
      key: 'changed_at',
      label: 'Waktu',
      className: 'whitespace-nowrap tnum text-muted-foreground',
      sortAccessor: (row) => row.changed_at,
      render: (row) => formatDateTime(row.changed_at),
    },
    {
      key: 'changed_by',
      label: 'User',
      sortAccessor: (row) => (row.changed_by ? (actorName[row.changed_by] ?? null) : null),
      render: (row) =>
        row.changed_by ? (actorName[row.changed_by] ?? 'Tidak dikenal') : 'Sistem',
    },
    {
      key: 'action',
      label: 'Aksi',
      sortAccessor: (row) => row.action,
      render: (row) => <Badge tone={ACTION_TONE[row.action]}>{row.action}</Badge>,
    },
    {
      key: 'table_name',
      label: 'Tabel',
      className: 'code text-xs',
      sortAccessor: (row) => row.table_name,
      render: (row) => row.table_name,
    },
    {
      key: 'changed_fields',
      label: 'Field berubah',
      className: 'max-w-md text-muted-foreground',
      render: (row) => (row.changed_fields?.length ? row.changed_fields.join(', ') : '—'),
    },
  ]

  return (
    <DataTable
      columns={columns}
      rows={entries}
      rowKey={(row) => String(row.id)}
      searchAccessor={(row) =>
        [
          row.table_name,
          row.action,
          row.changed_by ? actorName[row.changed_by] : null,
          row.changed_fields?.join(' '),
        ]
          .filter(Boolean)
          .join(' ')
      }
      searchPlaceholder="Cari tabel, user, atau field…"
      emptyTitle="Belum ada perubahan tercatat"
      emptyDescription="Trigger audit aktif di 33 tabel; entri muncul begitu data pertama diubah."
      defaultSort={{ key: 'changed_at', dir: 'desc' }}
    />
  )
}
