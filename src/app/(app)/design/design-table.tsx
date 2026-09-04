'use client'

import Link from 'next/link'
import { Badge } from '@/components/ui/badge'
import { DataTable, type DataTableColumn } from '@/components/ui/data-table'
import { cn } from '@/lib/utils'
import { STAGE_TONE, daysInStage } from '@/lib/design'
import type { Database } from '@/lib/supabase/types'

type DesignRow = Database['public']['Tables']['designs']['Row']
type SpkLite = { id: string; spk_number: string; site_code: string | null; work_name: string }

export function DesignTable({
  designs,
  spkById,
  picName,
}: {
  designs: DesignRow[]
  spkById: Record<string, SpkLite>
  picName: Record<string, string>
}) {
  const columns: DataTableColumn<DesignRow>[] = [
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
          <Link href={`/design/${row.id}`} className="font-bold text-primary hover:underline">
            {spk?.site_code ?? spk?.spk_number ?? 'SPK'}
          </Link>
        )
      },
    },
    {
      key: 'title',
      label: 'Judul',
      className: 'max-w-xs',
      sortAccessor: (row) => row.title ?? spkById[row.spk_id]?.work_name ?? null,
      render: (row) => (
        <span className="line-clamp-1 font-bold text-slate-900">
          {row.title ?? spkById[row.spk_id]?.work_name ?? '—'}
        </span>
      ),
    },
    {
      key: 'stage',
      label: 'Tahap',
      sortAccessor: (row) => row.current_stage,
      render: (row) => <Badge tone={STAGE_TONE[row.current_stage]}>{row.current_stage}</Badge>,
    },
    {
      key: 'pic',
      label: 'PIC',
      className: 'text-muted-foreground',
      sortAccessor: (row) => (row.pic_id ? (picName[row.pic_id] ?? null) : null),
      render: (row) => (row.pic_id ? (picName[row.pic_id] ?? '—') : '—'),
    },
    {
      key: 'held',
      label: 'Di tahap ini',
      align: 'right',
      sortAccessor: (row) => daysInStage(row.updated_at),
      render: (row) => {
        const held = daysInStage(row.updated_at)
        const late = held !== null && held > 7 && row.current_stage !== 'Submit Peta'
        return (
          <span className={cn('tnum', late && 'font-bold text-danger')}>
            {held === null ? '—' : `${held} hari`}
          </span>
        )
      },
    },
  ]

  return (
    <DataTable
      columns={columns}
      rows={designs}
      rowKey={(row) => row.id}
      searchAccessor={(row) => {
        const spk = spkById[row.spk_id]
        return [row.title, spk?.spk_number, spk?.site_code, spk?.work_name].filter(Boolean).join(' ')
      }}
      searchPlaceholder="Cari judul atau SPK…"
      emptyTitle="Belum ada record desain"
    />
  )
}
