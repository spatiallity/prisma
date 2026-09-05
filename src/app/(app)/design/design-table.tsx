'use client'

import Link from 'next/link'
import { Badge } from '@/components/ui/badge'
import { DataTable, type DataTableColumn } from '@/components/ui/data-table'
import { cn, formatDate } from '@/lib/utils'
import { STAGE_TONE, daysInStage } from '@/lib/design'
import type { Database } from '@/lib/supabase/types'

type DesignRow = Database['public']['Tables']['designs']['Row']
type SpkLite = { id: string; spk_number: string; site_code: string | null; work_name: string }
type CurrentStage = {
  startedAt: string | null
  picPertamina: string | null
  rounds: number
}

export function DesignTable({
  designs,
  spkById,
  picName,
  currentByDesign,
}: {
  designs: DesignRow[]
  spkById: Record<string, SpkLite>
  picName: Record<string, string>
  currentByDesign: Record<string, CurrentStage>
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
      sortAccessor: (row) => (currentByDesign[row.id] ? row.current_stage : ''),
      render: (row) =>
        currentByDesign[row.id] ? (
          <Badge tone={STAGE_TONE[row.current_stage]}>{row.current_stage}</Badge>
        ) : (
          <Badge tone="neutral">Draft</Badge>
        ),
    },
    {
      key: 'pic',
      label: 'PIC',
      className: 'text-muted-foreground',
      sortAccessor: (row) => (row.pic_id ? (picName[row.pic_id] ?? null) : null),
      render: (row) => (row.pic_id ? (picName[row.pic_id] ?? '—') : '—'),
    },
    {
      key: 'pic_pertamina',
      label: 'PIC Pertamina',
      className: 'text-muted-foreground',
      sortAccessor: (row) => currentByDesign[row.id]?.picPertamina ?? null,
      render: (row) => currentByDesign[row.id]?.picPertamina ?? '—',
    },
    {
      key: 'keterangan',
      label: 'Keterangan',
      className: 'text-muted-foreground',
      render: (row) => {
        const current = currentByDesign[row.id]
        if (!current) return '—'
        return (
          <>
            {current.rounds > 0 ? `Revisi ke-${current.rounds}` : 'Submission pertama'}
            {current.startedAt && (
              <div className="text-xs">mulai {formatDate(current.startedAt)}</div>
            )}
          </>
        )
      },
    },
    {
      key: 'held',
      label: 'Di tahap ini',
      align: 'right',
      sortAccessor: (row) => (currentByDesign[row.id] ? daysInStage(row.updated_at) : null),
      render: (row) => {
        if (!currentByDesign[row.id]) return <span className="tnum">—</span>
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
