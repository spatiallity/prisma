'use client'

import Link from 'next/link'
import { Pencil } from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { DataTable, type DataTableColumn } from '@/components/ui/data-table'
import { SpkCell } from '@/components/ui/spk-cell'
import { cn, formatDate } from '@/lib/utils'
import { STAGE_TONE, daysInStage } from '@/lib/design'
import type { Database, DesignPhase } from '@/lib/supabase/types'

type DesignRow = Database['public']['Tables']['designs']['Row']
type SpkLite = { id: string; spk_number: string; site_code: string | null; work_name: string }
type CurrentStage = {
  startedAt: string | null
  picPertamina: string | null
  rounds: number
}

export function DesignTable({
  phase,
  designs,
  spkById,
  picName,
  currentByDesign,
  siteplanApprovedBySpk,
}: {
  phase: DesignPhase
  designs: DesignRow[]
  spkById: Record<string, SpkLite>
  picName: Record<string, string>
  currentByDesign: Record<string, CurrentStage>
  /** Finalisasi only: when the sibling Desain Siteplan record was approved. */
  siteplanApprovedBySpk?: Record<string, string | null>
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
          <SpkCell
            id={row.id}
            spkNumber={spk?.spk_number ?? 'SPK'}
            siteCode={spk?.site_code ?? null}
            href={`/design/${row.id}`}
          />
        )
      },
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
      label: 'Drafter',
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
    phase === 'siteplan'
      ? {
          key: 'topo',
          label: 'Data topografi masuk',
          className: 'tnum text-muted-foreground',
          sortAccessor: (row) => row.topo_data_received_at,
          render: (row) => (row.topo_data_received_at ? formatDate(row.topo_data_received_at) : '—'),
        }
      : {
          key: 'siteplan_approved',
          label: 'Desain Awal Approved',
          className: 'tnum text-muted-foreground',
          sortAccessor: (row) => siteplanApprovedBySpk?.[row.spk_id] ?? null,
          render: (row) => {
            const at = siteplanApprovedBySpk?.[row.spk_id]
            return at ? formatDate(at) : '—'
          },
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
    {
      key: 'aksi',
      label: 'Aksi',
      align: 'right',
      render: (row) => (
        <Link
          href={`/design/${row.id}`}
          className="inline-flex h-8 w-8 items-center justify-center rounded-lg border border-slate-300 bg-white text-slate-600 hover:bg-slate-50"
          aria-label="Edit"
        >
          <Pencil size={14} aria-hidden />
        </Link>
      ),
    },
  ]

  return (
    <DataTable
      columns={columns}
      rows={designs}
      rowKey={(row) => row.id}
      searchAccessor={(row) => {
        const spk = spkById[row.spk_id]
        return [spk?.spk_number, spk?.site_code, spk?.work_name].filter(Boolean).join(' ')
      }}
      searchPlaceholder="Cari SPK…"
      emptyTitle="Belum ada record desain"
      pageSize={100}
    />
  )
}
