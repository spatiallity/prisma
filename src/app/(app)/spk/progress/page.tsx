import type { Metadata } from 'next'
import { PageHeader } from '@/components/ui/page-header'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { requirePermission } from '@/lib/auth/session'
import { createClient } from '@/lib/supabase/server'
import { cn } from '@/lib/utils'
import type { DesignStage } from '@/lib/supabase/types'
import { PHASE_LABEL, daysBetween, daysInStage, stageDisplayLabel } from '@/lib/design'
import { ProgressBoard, type ProgressColumn, type ProgressRow, type ProgressStatus } from './progress-board'

export const metadata: Metadata = { title: 'Progress SPK' }

type Column = 'terestris' | 'desain_awal' | 'finalisasi' | 'invoicing' | 'selesai'

const COLUMNS: { key: Column; label: string }[] = [
  { key: 'terestris', label: 'Survei Terestris' },
  { key: 'desain_awal', label: 'Desain Awal' },
  { key: 'finalisasi', label: 'Finalisasi Desain' },
  { key: 'invoicing', label: 'Invoicing' },
  { key: 'selesai', label: 'Selesai / Invoiced' },
]

const COLUMN_TONE: Record<Column, { bar: string; soft: string; text: string; caption: string }> = {
  terestris: {
    bar: 'bg-info',
    soft: 'bg-info/10',
    text: 'text-info',
    caption: 'Belum masuk desain aktif',
  },
  desain_awal: {
    bar: 'bg-primary',
    soft: 'bg-primary-soft',
    text: 'text-primary',
    caption: 'Desain siteplan berjalan',
  },
  finalisasi: {
    bar: 'bg-warning',
    soft: 'bg-warning/15',
    text: 'text-warning',
    caption: 'Finalisasi desain berjalan',
  },
  invoicing: {
    bar: 'bg-brand-orange',
    soft: 'bg-brand-orange/10',
    text: 'text-brand-orange',
    caption: 'Dokumen invoice sedang diproses',
  },
  selesai: {
    bar: 'bg-success',
    soft: 'bg-success/10',
    text: 'text-success',
    caption: 'Sudah selesai/invoiced',
  },
}

/**
 * A Kanban read of the same funnel the Dashboard tiles count — one column
 * per stage, one card per SPK, so where the backlog actually sits is
 * visible in one glance instead of six separate numbers. Bucketing goes by
 * the furthest stage reached (later wins), the same "what's the one
 * question this SPK is stuck on" read as loadStageBySpk, just collapsed to
 * five buckets instead of that function's much finer-grained labels.
 */
export default async function SpkProgressPage() {
  await requirePermission('spk', 'view')
  const supabase = await createClient()

  const [
    { data: spks, error },
    { data: activeDesigns },
    { data: designRevisions },
    { data: designPics },
    { data: routingDocs },
    { data: routingHistory },
  ] = await Promise.all([
    supabase
      .from('spks')
      .select('id, spk_number, site_code, work_name, status, start_date, end_date, contract_value, area_ha, work_type, location, location_type, kabupaten, provinsi')
      .in('status', ['On Going', 'Selesai'])
      .order('spk_number'),
    supabase.from('designs').select('id, spk_id, phase, current_stage, updated_at').eq('status', 'Active'),
    supabase
      .from('design_revisions')
      .select('design_id, stage, pic_id, pic_pertamina, started_at, completed_at, created_at')
      .eq('status', 'Active')
      .order('created_at', { ascending: false }),
    supabase.from('design_pics').select('id, full_name'),
    supabase.from('spk_routing').select('id, spk_id, updated_at'),
    supabase
      .from('routing_history')
      .select('spk_routing_id, step_name, sequence, status, pic_name, started_at, completed_at, updated_at'),
  ])

  const designsBySpk = new Map<string, { phase: 'siteplan' | 'finalisasi'; current_stage: DesignStage }[]>()
  for (const d of activeDesigns ?? []) {
    const list = designsBySpk.get(d.spk_id) ?? []
    list.push({ phase: d.phase, current_stage: d.current_stage })
    designsBySpk.set(d.spk_id, list)
  }
  const routedSpkIds = new Set((routingDocs ?? []).map((r) => r.spk_id))

  const picNameById = new Map((designPics ?? []).map((pic) => [pic.id, pic.full_name]))
  const currentRevisionByDesign = new Map<string, NonNullable<typeof designRevisions>[number]>()
  for (const revision of designRevisions ?? []) {
    const design = (activeDesigns ?? []).find((item) => item.id === revision.design_id)
    if (design && design.current_stage === revision.stage && !currentRevisionByDesign.has(design.id)) {
      currentRevisionByDesign.set(design.id, revision)
    }
  }
  const routingHistoryByDoc = new Map<string, NonNullable<typeof routingHistory>>()
  for (const history of routingHistory ?? []) {
    const list = routingHistoryByDoc.get(history.spk_routing_id) ?? []
    list.push(history)
    routingHistoryByDoc.set(history.spk_routing_id, list)
  }

  function bucketFor(spk: { id: string; status: string }): Column {
    if (spk.status === 'Selesai') return 'selesai'
    if (routedSpkIds.has(spk.id)) return 'invoicing'
    const designs = designsBySpk.get(spk.id) ?? []
    if (designs.some((d) => d.phase === 'finalisasi' && d.current_stage !== 'Acc PIC Pertamina')) {
      return 'finalisasi'
    }
    if (designs.some((d) => d.phase === 'siteplan' && d.current_stage !== 'Opname')) {
      return 'desain_awal'
    }
    return 'terestris'
  }

  function designProgress(design: NonNullable<typeof activeDesigns>[number]): ProgressStatus {
    const revision = currentRevisionByDesign.get(design.id)
    const internalPic = revision?.pic_id ? (picNameById.get(revision.pic_id) ?? null) : null
    const pic = [internalPic, revision?.pic_pertamina].filter(Boolean).join(' · ') || null
    const startedAt = revision?.started_at ?? null
    const completedAt = revision?.completed_at ?? null
    return {
      area: PHASE_LABEL[design.phase],
      stage: stageDisplayLabel(design.current_stage),
      pic,
      startedAt,
      completedAt,
      durationDays: completedAt ? daysBetween(startedAt, completedAt) : daysInStage(startedAt ?? design.updated_at),
    }
  }

  function routingProgress(spkId: string): ProgressStatus {
    const docs = (routingDocs ?? []).filter((doc) => doc.spk_id === spkId)
    const doc = docs[0]
    const history = doc ? (routingHistoryByDoc.get(doc.id) ?? []) : []
    const current = [...history]
      .filter((step) => step.status !== 'Completed')
      .sort((a, b) => a.sequence - b.sequence)[0] ?? [...history].sort((a, b) => b.sequence - a.sequence)[0]
    const startedAt = current?.started_at ?? doc?.updated_at ?? null
    const completedAt = current?.completed_at ?? null
    return {
      area: 'Dokumen Invoice',
      stage: current?.step_name ?? 'Penyusunan dokumen invoice',
      pic: current?.pic_name ?? null,
      startedAt,
      completedAt,
      durationDays: completedAt ? daysBetween(startedAt, completedAt) : daysInStage(startedAt),
    }
  }

  function progressFor(spk: NonNullable<typeof spks>[number], bucket: Column): ProgressStatus {
    if (bucket === 'desain_awal') {
      const design = (designsBySpk.get(spk.id) ?? []).find((item) => item.phase === 'siteplan')
      const source = (activeDesigns ?? []).find((item) => item.spk_id === spk.id && item.phase === design?.phase)
      if (source) return designProgress(source)
    }
    if (bucket === 'finalisasi') {
      const source = (activeDesigns ?? []).find((item) => item.spk_id === spk.id && item.phase === 'finalisasi')
      if (source) return designProgress(source)
    }
    if (bucket === 'invoicing') return routingProgress(spk.id)
    if (bucket === 'terestris') {
      return {
        area: 'Survei Lapangan',
        stage: 'Survei Terestris',
        pic: null,
        startedAt: spk.start_date,
        completedAt: null,
        durationDays: daysInStage(spk.start_date),
      }
    }
    return {
      area: 'Selesai',
      stage: 'Selesai / Invoiced',
      pic: null,
      startedAt: null,
      completedAt: spk.end_date,
      durationDays: null,
    }
  }

  const progressRows: ProgressRow[] = (spks ?? []).map((spk) => {
    const bucket = bucketFor(spk)
    return { ...spk, progress: progressFor(spk, bucket) }
  })
  const bySpk = progressRows.reduce<Record<Column, ProgressRow[]>>(
    (acc, s) => {
      acc[bucketFor(s)].push(s)
      return acc
    },
    { terestris: [], desain_awal: [], finalisasi: [], invoicing: [], selesai: [] },
  )
  const total = spks?.length ?? 0
  const maxBucket = Math.max(1, ...COLUMNS.map((col) => bySpk[col.key].length))
  const activeTotal = total - bySpk.selesai.length
  const boardColumns: ProgressColumn[] = COLUMNS.map((col) => {
    const rows = bySpk[col.key]
    return {
      key: col.key,
      label: col.label,
      caption: COLUMN_TONE[col.key].caption,
      tone: {
        bar: COLUMN_TONE[col.key].bar,
        soft: COLUMN_TONE[col.key].soft,
        text: COLUMN_TONE[col.key].text,
      },
      density: Math.round((rows.length / maxBucket) * 100),
      rows,
    }
  })

  return (
    <>
      <PageHeader
        title="Progress SPK"
        description="Posisi setiap SPK dari Survei Terestris sampai Selesai/Invoiced."
      />

      <div className="mb-5 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {[
          { label: 'Total SPK', value: total, helper: 'On Going + Selesai', tone: 'text-slate-900' },
          { label: 'Masih berjalan', value: activeTotal, helper: 'belum selesai/invoiced', tone: 'text-primary' },
          { label: 'Dokumen invoice', value: bySpk.invoicing.length, helper: 'sedang diproses', tone: 'text-brand-orange' },
          { label: 'Selesai', value: bySpk.selesai.length, helper: 'sudah completed', tone: 'text-success' },
        ].map((item) => (
          <Card key={item.label} className="overflow-hidden">
            <CardContent className="p-4">
              <div className="text-[11px] font-extrabold tracking-wider text-slate-500 uppercase">
                {item.label}
              </div>
              <div className={cn('tnum mt-1 text-3xl font-black', item.tone)}>{item.value}</div>
              <div className="mt-1 text-xs font-semibold text-muted-foreground">{item.helper}</div>
            </CardContent>
          </Card>
        ))}
      </div>

      <Card className="mb-5 overflow-hidden">
        <CardHeader>
          <div>
            <CardTitle>Distribusi Tahapan</CardTitle>
            <CardDescription>Komposisi SPK berdasarkan tahap terjauh yang sudah dicapai.</CardDescription>
          </div>
        </CardHeader>
        <CardContent className="grid gap-3">
          {COLUMNS.map((col) => {
            const rows = bySpk[col.key]
            const percent = total > 0 ? Math.round((rows.length / total) * 100) : 0
            return (
              <div key={col.key} className="grid gap-2 sm:grid-cols-[180px_1fr_70px] sm:items-center">
                <div>
                  <div className="text-sm font-bold text-slate-900">{col.label}</div>
                  <div className="text-xs font-semibold text-muted-foreground">{COLUMN_TONE[col.key].caption}</div>
                </div>
                <div className="h-2.5 overflow-hidden rounded-full bg-slate-100">
                  <div
                    className={cn('h-full rounded-full', COLUMN_TONE[col.key].bar)}
                    style={{ width: `${Math.max(3, percent)}%` }}
                  />
                </div>
                <div className="tnum text-right text-sm font-black text-slate-900">
                  {rows.length} <span className="text-xs font-bold text-muted-foreground">({percent}%)</span>
                </div>
              </div>
            )
          })}
        </CardContent>
      </Card>

      <ProgressBoard columns={boardColumns} />

      {error && (
        <p className="mt-4 text-sm font-semibold text-danger">Gagal memuat data: {error.message}</p>
      )}
    </>
  )
}
