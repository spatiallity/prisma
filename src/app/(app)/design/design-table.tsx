'use client'

import { useState } from 'react'
import { Eye } from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { DataTable, type DataTableColumn } from '@/components/ui/data-table'
import { RowActions } from '@/components/ui/row-actions'
import { DeleteButton } from '@/components/ui/delete-button'
import { cn, formatDate } from '@/lib/utils'
import { STAGE_TONE, daysInStage, stageDisplayLabel } from '@/lib/design'
import type { Database, DesignPhase } from '@/lib/supabase/types'
import { DesignDetailModal } from './design-detail-modal'
import { deleteDesign } from './actions'
import type { PicOption } from './forms'

type DesignRow = Database['public']['Tables']['designs']['Row']
type SpkLite = { id: string; spk_number: string; site_code: string | null; work_name: string }
type CurrentStage = {
  startedAt: string | null
  picId: string | null
  picPertamina: string | null
  rounds: number
}
type Revision = {
  id: string
  stage: string
  revision_no: number
  pic_id: string | null
  pic_pertamina: string | null
  started_at: string | null
  completed_at: string | null
  notes: string | null
}

export function DesignTable({
  phase,
  designs,
  spkById,
  picName,
  currentByDesign,
  revisionsByDesign,
  siteplanApprovedBySpk,
  pics = [],
  mayEdit = false,
}: {
  phase: DesignPhase
  designs: DesignRow[]
  spkById: Record<string, SpkLite>
  picName: Record<string, string>
  currentByDesign: Record<string, CurrentStage>
  revisionsByDesign?: Record<string, Revision[]>
  /** Finalisasi only: when the sibling Desain Siteplan record was approved. */
  siteplanApprovedBySpk?: Record<string, string | null>
  pics?: PicOption[]
  mayEdit?: boolean
  /** The `?stage=` filter chip currently active — clicking a different chip
   *  re-renders this same table instance with a new `designs` set, so any
   *  popup left open must close instead of possibly matching a same-id row
   *  in the new set and popping back open on its own. */
  stageFilter?: string
}) {
  const [openId, setOpenId] = useState<string | null>(null)
  const openDesign = designs.find((d) => d.id === openId) ?? null

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
        const label = spk?.site_code ?? spk?.spk_number ?? 'SPK'
        const sub = spk?.site_code ? spk?.spk_number : null
        return (
          <div>
            <span className="font-bold text-primary">{label}</span>
            {sub && <div className="text-xs font-semibold text-slate-500">{sub}</div>}
          </div>
        )
      },
    },
    {
      key: 'stage',
      label: 'Tahap',
      sortAccessor: (row) => (currentByDesign[row.id] ? row.current_stage : ''),
      render: (row) =>
        currentByDesign[row.id] ? (
          <Badge tone={STAGE_TONE[row.current_stage]}>{stageDisplayLabel(row.current_stage)}</Badge>
        ) : (
          <Badge tone="neutral">Draft</Badge>
        ),
    },
    {
      key: 'pic',
      label: 'Drafter',
      className: 'text-muted-foreground',
      sortAccessor: (row) => {
        const picId = currentByDesign[row.id]?.picId ?? row.pic_id
        return picId ? (picName[picId] ?? null) : null
      },
      render: (row) => {
        const picId = currentByDesign[row.id]?.picId ?? row.pic_id
        return picId ? (picName[picId] ?? '—') : '—'
      },
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
          label: 'Desain Awal Selesai',
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
        const late = held !== null && held > 7 && row.current_stage !== 'Acc PIC Pertamina'
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
      stopRowClick: true,
      render: (row) => {
        const spk = spkById[row.spk_id]
        return (
          <RowActions>
            <button
              type="button"
              onClick={() => setOpenId(row.id)}
              className="flex items-center gap-2 rounded-md px-2 py-1.5 text-left text-xs font-bold text-slate-700 hover:bg-slate-50"
            >
              <Eye size={14} aria-hidden />
              Detail
            </button>
            {mayEdit && (
              <DeleteButton
                action={deleteDesign}
                hiddenFields={{ design_id: row.id }}
                label="Hapus Progress"
                confirmText={`Progres desain untuk ${spk?.site_code ?? spk?.spk_number ?? 'SPK ini'} akan dihapus permanen (seluruh riwayat tahap ikut terhapus). SPK-nya sendiri tidak terhapus — bisa dimulai ulang dari sini.`}
              />
            )}
          </RowActions>
        )
      },
    },
  ]

  return (
    <>
      <DataTable
        columns={columns}
        rows={designs}
        rowKey={(row) => row.id}
        onRowClick={(row) => setOpenId(row.id)}
        searchAccessor={(row) => {
          const spk = spkById[row.spk_id]
          return [spk?.spk_number, spk?.site_code, spk?.work_name].filter(Boolean).join(' ')
        }}
        searchPlaceholder="Cari SPK…"
        emptyTitle="Belum ada record desain"
        pageSize={100}
      />
      <DesignDetailModal
        open={openId !== null}
        onOpenChange={(v) => !v && setOpenId(null)}
        design={openDesign}
        title={openDesign ? (spkById[openDesign.spk_id]?.site_code ?? spkById[openDesign.spk_id]?.spk_number ?? 'Desain') : ''}
        revisions={openDesign ? (revisionsByDesign?.[openDesign.id] ?? []) : []}
        picName={picName}
        pics={pics}
        mayEdit={mayEdit}
        spkId={openDesign?.spk_id}
      />
    </>
  )
}
