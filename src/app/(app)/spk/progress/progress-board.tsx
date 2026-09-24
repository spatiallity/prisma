'use client'

import { useState } from 'react'
import type { ReactNode } from 'react'
import Link from 'next/link'
import { CalendarDays, ExternalLink, MapPin, Ruler, UsersRound, WalletCards } from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { linkButtonClass } from '@/components/ui/button'
import { Card, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { EmptyState } from '@/components/ui/page-header'
import { Modal } from '@/components/ui/modal'
import { cn, formatDate, formatRupiah } from '@/lib/utils'
import { formatArea, spkStatusLabel } from '@/lib/spk'
import type { SpkStatus } from '@/lib/supabase/types'

export type ProgressColumnKey = 'terestris' | 'desain_awal' | 'finalisasi' | 'invoicing' | 'selesai'

export type ProgressRow = {
  id: string
  spk_number: string
  site_code: string | null
  work_name: string
  status: SpkStatus
  created_at: string
  start_date: string | null
  end_date: string | null
  contract_value: number | string | null
  area_ha: number | string | null
  work_type: string | null
  location: string | null
  location_type: string | null
  kabupaten: string | null
  provinsi: string | null
  terrain_survey_completed_at: string | null
  joint_check_date: string | null
  joint_check_completed_at?: string | null
  opname_marked_at: string | null
  pad_marked_at: string | null
  progress: ProgressStatus
}

export type ProgressStatus = {
  area: string
  stage: string
  pic: string | null
  /** PIC Pertamina assigned to the active design or routing stage. */
  assignee: string | null
  startedAt: string | null
  completedAt: string | null
  durationDays: number | null
}

export type ProgressColumn = {
  key: ProgressColumnKey
  label: string
  caption: string
  tone: {
    bar: string
    soft: string
    text: string
  }
  density: number
  rows: ProgressRow[]
}

export function ProgressBoard({ columns }: { columns: ProgressColumn[] }) {
  const [selected, setSelected] = useState<{ row: ProgressRow; column: ProgressColumn } | null>(null)
  const [workloadArea, setWorkloadArea] = useState<'design' | 'routing'>('design')
  const [selectedAssignee, setSelectedAssignee] = useState<string | null>(null)
  const filteredColumns = columns.map((column) => ({
    ...column,
    rows:
      selectedAssignee === null
        ? column.rows
        : column.rows.filter((row) => row.progress.assignee === selectedAssignee),
  })).map((column) => ({
    ...column,
    rows: [...column.rows].sort((a, b) =>
      (b.progress.startedAt ?? b.start_date ?? b.created_at).localeCompare(a.progress.startedAt ?? a.start_date ?? a.created_at),
    ),
  }))

  function selectWorkloadArea(area: 'design' | 'routing') {
    setWorkloadArea(area)
    setSelectedAssignee(null)
  }

  return (
    <>
      <PicWorkload
        columns={columns}
        area={workloadArea}
        selectedAssignee={selectedAssignee}
        onAreaChange={selectWorkloadArea}
        onAssigneeChange={setSelectedAssignee}
      />

      <div className="grid gap-4 lg:grid-cols-5">
        {filteredColumns.map((col) => (
          <Card key={col.key} className="flex max-h-[calc(100vh-240px)] min-h-[360px] flex-col overflow-hidden">
            <CardHeader className="shrink-0">
              <div>
                <CardTitle>{col.label}</CardTitle>
                <CardDescription>{col.caption}</CardDescription>
              </div>
              <Badge tone={col.key === 'selesai' ? 'success' : 'info'}>{col.rows.length}</Badge>
            </CardHeader>
            <div className="h-1.5 bg-slate-100">
              <div className={cn('h-full', col.tone.bar)} style={{ width: `${Math.max(4, col.density)}%` }} />
            </div>
            {col.rows.length > 0 ? (
              <ul className="min-h-0 flex-1 space-y-2 overflow-y-auto bg-slate-50 p-3">
                {col.rows.map((row) => (
                  <li key={row.id}>
                    <button
                      type="button"
                      onClick={() => setSelected({ row, column: col })}
                      className="w-full rounded-lg border border-slate-200 bg-surface px-3 py-3 text-left shadow-sm transition hover:border-primary/40 hover:shadow-md focus:ring-2 focus:ring-primary/30 focus:outline-none"
                    >
                      <div className="font-black text-primary">{row.site_code ?? row.spk_number}</div>
                      {row.site_code && (
                        <div className="tnum text-xs font-semibold text-slate-500">{row.spk_number}</div>
                      )}
                      <div className="mt-1 line-clamp-2 text-xs font-medium text-muted-foreground">{row.work_name}</div>
                      <div className="mt-2 line-clamp-1 text-xs font-bold text-slate-700">{row.progress.stage}</div>
                      <div className={cn('mt-2 inline-flex rounded-full px-2 py-0.5 text-[11px] font-black', col.tone.soft, col.tone.text)}>
                        {spkStatusLabel(row.status)}
                      </div>
                    </button>
                  </li>
                ))}
              </ul>
            ) : (
              <div className="flex-1 px-4 py-6">
                <EmptyState title="Kosong" />
              </div>
            )}
          </Card>
        ))}
      </div>

      <Modal
        open={selected !== null}
        onOpenChange={(open) => !open && setSelected(null)}
        title={selected ? (selected.row.site_code ?? selected.row.spk_number) : 'Detail SPK'}
        description={selected ? `${selected.row.spk_number} · ${selected.column.label}` : undefined}
        size="lg"
      >
        {selected && <ProgressDetail row={selected.row} column={selected.column} />}
      </Modal>
    </>
  )
}

function PicWorkload({
  columns,
  area,
  selectedAssignee,
  onAreaChange,
  onAssigneeChange,
}: {
  columns: ProgressColumn[]
  area: 'design' | 'routing'
  selectedAssignee: string | null
  onAreaChange: (area: 'design' | 'routing') => void
  onAssigneeChange: (assignee: string | null) => void
}) {
  const targetColumns = area === 'design' ? ['desain_awal', 'finalisasi'] : ['invoicing']
  const assignedRows = columns
    .filter((column) => targetColumns.includes(column.key))
    .flatMap((column) => column.rows)
    .filter((row) => row.progress.assignee)
  const workload = [...assignedRows.reduce((counts, row) => {
    const name = row.progress.assignee as string
    const current = counts.get(name) ?? { count: 0, maxDays: 0 }
    counts.set(name, {
      count: current.count + 1,
      maxDays: Math.max(current.maxDays, row.progress.durationDays ?? 0),
    })
    return counts
  }, new Map<string, { count: number; maxDays: number }>()).entries()].sort(
    (a, b) => b[1].maxDays - a[1].maxDays || b[1].count - a[1].count || a[0].localeCompare(b[0], 'id'),
  )
  const max = Math.max(1, ...workload.map(([, metrics]) => metrics.count))
  const areaLabel = area === 'design' ? 'Desain' : 'Routing Dokumen'

  return (
    <Card className="mb-5 overflow-hidden">
      <CardHeader className="border-b border-slate-100">
        <div>
          <CardTitle>Sebaran SPK per PIC Pertamina</CardTitle>
          <CardDescription>Jumlah pekerjaan aktif dan durasi terlama yang masih tertahan. Klik PIC untuk menyaring card SPK.</CardDescription>
        </div>
        <div className="flex rounded-lg bg-slate-100 p-1" role="tablist" aria-label="Jenis beban kerja PIC">
          {(['design', 'routing'] as const).map((tab) => {
            const active = area === tab
            return (
              <button
                key={tab}
                type="button"
                role="tab"
                aria-selected={active}
                onClick={() => onAreaChange(tab)}
                className={cn(
                  'rounded-md px-3 py-1.5 text-xs font-extrabold transition focus:ring-2 focus:ring-primary/30 focus:outline-none',
                  active ? 'bg-white text-primary shadow-sm' : 'text-slate-500 hover:text-slate-900',
                )}
              >
                {tab === 'design' ? 'Desain' : 'Routing Dokumen'}
              </button>
            )
          })}
        </div>
      </CardHeader>
      <div className="grid gap-4 p-4 lg:grid-cols-[minmax(0,1fr)_220px]">
        <div className="space-y-2.5">
          {workload.length > 0 ? workload.map(([name, metrics]) => {
            const active = selectedAssignee === name
            return (
              <button
                key={name}
                type="button"
                onClick={() => onAssigneeChange(active ? null : name)}
                className={cn(
                  'grid w-full grid-cols-[minmax(120px,220px)_1fr_auto_auto] items-center gap-3 rounded-md px-2 py-1.5 text-left transition focus:ring-2 focus:ring-primary/30 focus:outline-none',
                  active ? 'bg-primary-soft' : 'hover:bg-slate-50',
                )}
              >
                <span className="truncate text-sm font-bold text-slate-900">{name}</span>
                <span className="h-2 overflow-hidden rounded-full bg-slate-100">
                  <span className={cn('block h-full rounded-full', active ? 'bg-primary' : area === 'design' ? 'bg-info' : 'bg-brand-orange')} style={{ width: `${Math.max(8, (metrics.count / max) * 100)}%` }} />
                </span>
                <span className="tnum whitespace-nowrap text-xs font-bold text-muted-foreground">{metrics.maxDays} hari</span>
                <span className="tnum text-sm font-black text-slate-900">{metrics.count}</span>
              </button>
            )
          }) : (
            <div className="py-5 text-center text-sm font-semibold text-muted-foreground">Belum ada PIC pada SPK {areaLabel.toLowerCase()} yang berjalan.</div>
          )}
        </div>
        <div className="flex flex-col justify-between rounded-lg border border-slate-200 bg-slate-50 p-4">
          <div>
            <div className="flex items-center gap-2 text-xs font-extrabold tracking-wider text-slate-500 uppercase">
              <UsersRound size={15} className="text-primary" aria-hidden />
              SPK ditugaskan
            </div>
            <div className="tnum mt-2 text-3xl font-black text-slate-900">{assignedRows.length}</div>
            <div className="mt-1 text-xs font-semibold text-muted-foreground">pada {areaLabel.toLowerCase()}</div>
          </div>
          {selectedAssignee && (
            <button type="button" onClick={() => onAssigneeChange(null)} className="mt-4 text-left text-xs font-extrabold text-primary hover:underline">
              Tampilkan semua card
            </button>
          )}
        </div>
      </div>
    </Card>
  )
}

function ProgressDetail({ row, column }: { row: ProgressRow; column: ProgressColumn }) {
  const location = [row.location, row.kabupaten, row.provinsi].filter(Boolean).join(', ')

  return (
    <div className="space-y-4">
      <div className={cn('rounded-lg border px-4 py-3', column.tone.soft)}>
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <div className="text-sm font-black text-slate-900">{row.work_name}</div>
            <div className="mt-1 text-xs font-semibold text-muted-foreground">
              {row.work_type ?? 'Jenis pekerjaan belum diisi'}
            </div>
          </div>
          <Badge tone={row.status === 'Selesai' ? 'success' : 'primary'}>{spkStatusLabel(row.status)}</Badge>
        </div>
      </div>

      <div className="rounded-lg border border-slate-200 bg-slate-50 px-4 py-3">
        <div className="text-[11px] font-extrabold tracking-wider text-slate-500 uppercase">Progress saat ini</div>
        <div className="mt-1 flex flex-wrap items-center justify-between gap-2">
          <div>
            <div className="text-sm font-black text-slate-900">{row.progress.area}</div>
            <div className="text-xs font-semibold text-muted-foreground">{row.progress.stage}</div>
          </div>
          <div className={cn('rounded-full px-2.5 py-1 text-xs font-black', column.tone.soft, column.tone.text)}>
            {row.progress.durationDays === null ? '—' : `${row.progress.durationDays} hari`}
          </div>
        </div>
      </div>

      <div className="grid gap-3 sm:grid-cols-2">
        <Fact label="PIC tahap" value={row.progress.pic ?? 'PIC belum ditentukan'} />
        <Fact
          icon={<CalendarDays size={16} />}
          label="Periode tahap"
          value={formatProgressPeriod(row.progress.startedAt, row.progress.completedAt)}
        />
        <Fact icon={<WalletCards size={16} />} label="Nilai SPK" value={formatRupiah(row.contract_value)} />
        <Fact icon={<CalendarDays size={16} />} label="Jadwal SPK" value={`${formatDate(row.start_date)} - ${formatDate(row.end_date)}`} />
        <Fact icon={<Ruler size={16} />} label="Luas" value={formatArea(row.area_ha == null ? null : Number(row.area_ha))} />
        <Fact icon={<MapPin size={16} />} label="Lokasi" value={location || row.location_type || 'Belum diisi'} />
      </div>

      <div className="flex justify-end border-t border-slate-100 pt-4">
        <Link href={`/spk/${row.id}`} className={linkButtonClass}>
          <ExternalLink size={16} aria-hidden />
          Buka halaman detail
        </Link>
      </div>
    </div>
  )
}

function formatProgressPeriod(start: string | null, end: string | null) {
  if (!start && !end) return 'Belum ada tanggal'
  return `${start ? formatDate(start) : 'Belum mulai'} - ${end ? formatDate(end) : 'Sedang berjalan'}`
}

function Fact({ icon, label, value }: { icon?: ReactNode; label: string; value: string }) {
  return (
    <div className="rounded-lg border border-slate-200 bg-white px-4 py-3">
      <div className="flex items-center gap-2 text-xs font-extrabold tracking-wider text-slate-500 uppercase">
        <span className="text-primary">{icon}</span>
        {label}
      </div>
      <div className="mt-1 text-sm font-black text-slate-900">{value}</div>
    </div>
  )
}
