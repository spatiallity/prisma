'use client'

import { useState } from 'react'
import type { ReactNode } from 'react'
import Link from 'next/link'
import { CalendarDays, ExternalLink, MapPin, Ruler, WalletCards } from 'lucide-react'
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
  start_date: string | null
  end_date: string | null
  contract_value: number | string | null
  area_ha: number | string | null
  work_type: string | null
  location: string | null
  location_type: string | null
  kabupaten: string | null
  provinsi: string | null
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

  return (
    <>
      <div className="grid gap-4 lg:grid-cols-5">
        {columns.map((col) => (
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

      <div className="grid gap-3 sm:grid-cols-2">
        <Fact icon={<WalletCards size={16} />} label="Nilai SPK" value={formatRupiah(row.contract_value)} />
        <Fact icon={<CalendarDays size={16} />} label="Jadwal" value={`${formatDate(row.start_date)} - ${formatDate(row.end_date)}`} />
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

function Fact({ icon, label, value }: { icon: ReactNode; label: string; value: string }) {
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
