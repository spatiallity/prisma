'use client'

import Link from 'next/link'
import { Badge } from '@/components/ui/badge'
import { DataTable, type DataTableColumn } from '@/components/ui/data-table'
import { cn } from '@/lib/utils'
import { ROUTING_TONE, formatDays } from '@/lib/routing'
import type { Database } from '@/lib/supabase/types'

type RoutingDoc = Database['public']['Tables']['spk_routing']['Row']
type SpkLite = { id: string; spk_number: string; site_code: string | null }
type CurrentStage = { step_name: string; routing_history_id: string; is_overdue: boolean; elapsed_days: number | null; sla_days: number | null }

export function RoutingTable({
  docs,
  spkById,
  currentByDoc,
  picByStage,
  mode,
}: {
  docs: RoutingDoc[]
  spkById: Record<string, SpkLite>
  currentByDoc: Record<string, CurrentStage>
  picByStage: Record<string, string | null>
  mode: 'open' | 'pending' | 'history'
}) {
  const columns: DataTableColumn<RoutingDoc>[] = [
    {
      key: 'spk',
      label: 'SPK',
      sortAccessor: (row) => {
        const spk = spkById[row.spk_id]
        return spk?.site_code ?? spk?.spk_number ?? null
      },
      render: (row) => {
        const spk = spkById[row.spk_id]
        return (
          <Link href={`/routing/${row.id}`} className="font-bold text-primary hover:underline">
            {spk?.site_code ?? spk?.spk_number ?? 'SPK'}
          </Link>
        )
      },
    },
    {
      key: 'document_type',
      label: 'Dokumen',
      sortAccessor: (row) => row.document_type,
      render: (row) => (
        <>
          <span className="font-bold text-slate-900">{row.document_type}</span>
          {row.document_number && (
            <div className="text-xs text-muted-foreground">{row.document_number}</div>
          )}
        </>
      ),
    },
    {
      key: 'posisi',
      label: mode === 'history' ? 'Tahap terakhir' : 'Posisi sekarang',
      className: 'text-muted-foreground',
      sortAccessor: (row) => currentByDoc[row.id]?.step_name ?? null,
      render: (row) =>
        currentByDoc[row.id]?.step_name ?? (row.status === 'Completed' ? 'Selesai' : '—'),
    },
    {
      key: 'pic',
      label: 'PIC',
      className: 'text-muted-foreground',
      sortAccessor: (row) => {
        const current = currentByDoc[row.id]
        return current ? (picByStage[current.routing_history_id] ?? null) : null
      },
      render: (row) => {
        const current = currentByDoc[row.id]
        return current ? (picByStage[current.routing_history_id] ?? '—') : '—'
      },
    },
    {
      key: 'elapsed',
      label: 'Di tahap ini',
      align: 'right',
      sortAccessor: (row) => currentByDoc[row.id]?.elapsed_days ?? null,
      render: (row) => {
        const current = currentByDoc[row.id]
        const late = current?.is_overdue ?? false
        return (
          <span className={cn('tnum', late && 'font-bold text-danger')}>
            {formatDays(current?.elapsed_days ?? null)}
          </span>
        )
      },
    },
    {
      key: 'sla',
      label: 'SLA',
      align: 'right',
      className: 'tnum text-muted-foreground',
      sortAccessor: (row) => currentByDoc[row.id]?.sla_days ?? null,
      render: (row) => formatDays(currentByDoc[row.id]?.sla_days ?? null),
    },
    {
      key: 'status',
      label: 'Status',
      sortAccessor: (row) => row.status,
      render: (row) => {
        const late = currentByDoc[row.id]?.is_overdue ?? false
        return (
          <Badge tone={late ? 'danger' : ROUTING_TONE[row.status]}>
            {late ? 'Lewat SLA' : row.status}
          </Badge>
        )
      },
    },
  ]

  return (
    <DataTable
      columns={columns}
      rows={docs}
      rowKey={(row) => row.id}
      searchAccessor={(row) => {
        const spk = spkById[row.spk_id]
        return [row.document_type, row.document_number, spk?.spk_number, spk?.site_code]
          .filter(Boolean)
          .join(' ')
      }}
      searchPlaceholder="Cari dokumen atau SPK…"
      emptyTitle={mode === 'history' ? 'Belum ada dokumen selesai' : 'Tidak ada dokumen berjalan'}
      emptyDescription={
        mode === 'history'
          ? 'Dokumen akan muncul di sini setelah tahap terakhirnya selesai.'
          : 'Rutekan dokumen agar posisinya bisa dipantau.'
      }
    />
  )
}
