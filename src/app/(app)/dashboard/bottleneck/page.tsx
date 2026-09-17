import type { Metadata } from 'next'
import { PageHeader } from '@/components/ui/page-header'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Alert } from '@/components/ui/alert'
import { requirePermission } from '@/lib/auth/session'
import { createClient } from '@/lib/supabase/server'
import { cn } from '@/lib/utils'
import { AREA_LABEL, type BottleneckDesignContext, bottleneckSinceDate } from '@/lib/dashboard'
import { daysInStage, PHASE_LABEL, stageDisplayLabel } from '@/lib/design'
import { BottleneckTable, type BottleneckRow } from './bottleneck-table'

export const metadata: Metadata = { title: 'Bottleneck' }

/**
 * Section 9 — every condition the system watches, in one list. The thresholds
 * live in app_settings, so what counts as late is configuration rather than
 * something compiled in.
 */
export default async function BottleneckPage() {
  await requirePermission('dashboard', 'view')

  const supabase = await createClient()
  const [
    { data: rows, error },
    { data: activeDesigns },
    { data: spkMarks },
    { data: designRevisions },
    { data: routingDocs },
    { data: routingHistory },
  ] =
    await Promise.all([
      supabase.from('v_bottleneck').select('*'),
      supabase.from('designs').select('id, spk_id, phase, current_stage, updated_at').eq('status', 'Active'),
      supabase.from('spks').select('id, opname_marked_at, pad_marked_at'),
      supabase
        .from('design_revisions')
        .select('design_id, stage, started_at, completed_at, updated_at')
        .eq('status', 'Active'),
      supabase.from('spk_routing').select('id, spk_id'),
      supabase
        .from('routing_history')
        .select('spk_routing_id, step_name, started_at, completed_at, updated_at'),
    ])

  // Same lookups the Dashboard's Bottleneck card uses to say what actually
  // happened — here they feed the Tanggal/Hari columns instead of a sentence.
  const designsBySpk = new Map<string, BottleneckDesignContext[]>()
  for (const d of activeDesigns ?? []) {
    const list = designsBySpk.get(d.spk_id) ?? []
    list.push({ phase: d.phase, current_stage: d.current_stage, updated_at: d.updated_at })
    designsBySpk.set(d.spk_id, list)
  }
  const opnameMarkedAtBySpk = new Map((spkMarks ?? []).map((s) => [s.id, s.opname_marked_at]))
  const padMarkedAtBySpk = new Map((spkMarks ?? []).map((s) => [s.id, s.pad_marked_at]))
  const isMoneyReason = (reason: string) => /saldo|payment|dibayar|diterima/i.test(reason)

  type LastProcess = { process: string; date: string | null }
  const lastProcessBySpk = new Map<string, LastProcess>()
  const addLastProcess = (spkId: string, candidate: LastProcess) => {
    const previous = lastProcessBySpk.get(spkId)
    if (!previous || (candidate.date ?? '') > (previous.date ?? '')) {
      lastProcessBySpk.set(spkId, candidate)
    }
  }
  const designById = new Map((activeDesigns ?? []).map((design) => [design.id, design]))
  for (const design of activeDesigns ?? []) {
    addLastProcess(design.spk_id, {
      process: `${PHASE_LABEL[design.phase]} · ${stageDisplayLabel(design.current_stage)}`,
      date: design.updated_at,
    })
  }
  for (const revision of designRevisions ?? []) {
    const design = designById.get(revision.design_id)
    if (!design) continue
    addLastProcess(design.spk_id, {
      process: `${PHASE_LABEL[design.phase]} · ${stageDisplayLabel(revision.stage)}`,
      date: revision.completed_at ?? revision.started_at ?? revision.updated_at,
    })
  }

  const routingSpkById = new Map((routingDocs ?? []).map((doc) => [doc.id, doc.spk_id]))
  for (const step of routingHistory ?? []) {
    const spkId = routingSpkById.get(step.spk_routing_id)
    if (!spkId) continue
    addLastProcess(spkId, {
      process: `Dokumen invoice · ${step.step_name}`,
      date: step.completed_at ?? step.started_at ?? step.updated_at,
    })
  }
  for (const spk of spkMarks ?? []) {
    if (spk.opname_marked_at) addLastProcess(spk.id, { process: 'Opname', date: spk.opname_marked_at })
    if (spk.pad_marked_at) addLastProcess(spk.id, { process: 'PAD', date: spk.pad_marked_at })
  }

  const tableRows: BottleneckRow[] = (rows ?? []).map((row, index) => {
    const tanggal = bottleneckSinceDate(row, designsBySpk, opnameMarkedAtBySpk, padMarkedAtBySpk)
    const hari = tanggal
      ? daysInStage(tanggal)
      : !isMoneyReason(row.reason) && row.metric !== null
        ? Math.floor(row.metric)
        : null
    return {
      key: `${row.reason}-${row.spk_id ?? 'none'}-${index}`,
      area: row.area,
      reason: row.reason,
      spk_id: row.spk_id,
      spk_number: row.spk_number,
      site_code: row.site_code,
      severity: row.severity,
      tanggal,
      hari,
      prosesTerakhir: row.spk_id ? (lastProcessBySpk.get(row.spk_id)?.process ?? null) : null,
      tanggalProsesTerakhir: row.spk_id ? (lastProcessBySpk.get(row.spk_id)?.date ?? null) : null,
    }
  })

  const perArea = new Map<string, number>()
  for (const row of tableRows) {
    perArea.set(row.area, (perArea.get(row.area) ?? 0) + 1)
  }

  const critical = tableRows.filter((row) => row.severity === 'critical').length
  const warning = tableRows.filter((row) => row.severity === 'warning').length
  const oldest = tableRows
    .filter((row) => row.hari !== null)
    .sort((a, b) => (b.hari ?? 0) - (a.hari ?? 0))[0]
  const topReasons = [...tableRows.reduce((acc, row) => {
    acc.set(row.reason, (acc.get(row.reason) ?? 0) + 1)
    return acc
  }, new Map<string, number>()).entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, 3)

  const areas = ['design', 'routing', 'financial']

  return (
    <>
      <PageHeader
        title="Bottleneck Monitoring"
        description="Kondisi yang perlu dicek hari ini."
      />

      {error && (
        <Alert tone="danger" className="mb-4" title="Gagal memuat data">
          {error.message}
        </Alert>
      )}

      <div className="mb-5 grid gap-4 lg:grid-cols-[1.35fr_1fr]">
        <Card className="overflow-hidden">
          <CardHeader>
            <div>
              <CardTitle>Prioritas Hari Ini</CardTitle>
              <CardDescription>Ringkasan kondisi yang paling perlu dicek.</CardDescription>
            </div>
            <Badge tone={critical > 0 ? 'danger' : tableRows.length > 0 ? 'warning' : 'success'}>
              {tableRows.length} aktif
            </Badge>
          </CardHeader>
          <CardContent className="grid gap-4 sm:grid-cols-3">
            {[
              { label: 'Critical', value: critical, tone: 'text-danger', helper: 'perlu dicek dulu' },
              { label: 'Warning', value: warning, tone: 'text-warning', helper: 'pantau hari ini' },
              {
                label: 'Tertahan Terlama',
                value: oldest?.hari !== null && oldest?.hari !== undefined ? oldest.hari : 0,
                tone: 'text-info',
                helper: oldest ? `${oldest.site_code ?? oldest.spk_number ?? 'SPK'} · hari` : 'tidak ada data',
              },
            ].map((item) => (
              <div key={item.label} className="rounded-lg border border-slate-200 bg-slate-50 p-4">
                <div className="text-[11px] font-extrabold tracking-wider text-slate-500 uppercase">
                  {item.label}
                </div>
                <div className={cn('tnum mt-1 text-3xl font-black', item.tone)}>{item.value}</div>
                <div className="mt-1 text-xs font-semibold text-muted-foreground">{item.helper}</div>
              </div>
            ))}
          </CardContent>
        </Card>

        <Card className="overflow-hidden">
          <CardHeader>
            <div>
              <CardTitle>Penyebab Terbanyak</CardTitle>
              <CardDescription>Dipakai untuk menentukan fokus pengecekan.</CardDescription>
            </div>
          </CardHeader>
          <CardContent className="grid gap-3">
            {topReasons.length > 0 ? (
              topReasons.map(([reason, count]) => (
                <div key={reason} className="flex items-start justify-between gap-3 rounded-lg border border-slate-200 px-3 py-2.5">
                  <span className="min-w-0 text-sm font-bold text-slate-800">{reason}</span>
                  <span className="tnum shrink-0 rounded-full bg-primary-soft px-2 py-0.5 text-xs font-black text-primary">
                    {count}
                  </span>
                </div>
              ))
            ) : (
              <div className="rounded-lg border border-dashed border-slate-200 bg-slate-50 px-4 py-5 text-sm font-semibold text-muted-foreground">
                Belum ada pola bottleneck.
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      <div className="mb-5 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {areas.map((area) => {
          const count = perArea.get(area) ?? 0
          return (
            <Card key={area} className="overflow-hidden">
              <CardContent className="p-4">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <div className="text-[11px] font-extrabold tracking-wider text-slate-500 uppercase">
                      {AREA_LABEL[area] ?? area}
                    </div>
                    <div className="mt-1 text-xs font-semibold text-muted-foreground">
                      {count === 0 ? 'Tidak ada hambatan aktif' : 'Butuh tindak lanjut'}
                    </div>
                  </div>
                  <div
                    className={cn(
                      'tnum text-3xl font-black',
                      count === 0 ? 'text-success' : 'text-slate-900',
                    )}
                  >
                    {count}
                  </div>
                </div>
                <div className="mt-4 h-1.5 overflow-hidden rounded-full bg-slate-100">
                  <div
                    className={cn('h-full rounded-full', count === 0 ? 'bg-success' : 'bg-primary')}
                    style={{ width: `${count === 0 ? 100 : Math.min(100, 24 + count * 12)}%` }}
                  />
                </div>
              </CardContent>
            </Card>
          )
        })}
      </div>

      <Card className="mb-5 overflow-hidden">
        <CardHeader>
          <div>
            <CardTitle>Semua bottleneck</CardTitle>
            <CardDescription>Urutkan prioritas, area, atau lama tertahan untuk menentukan fokus kerja.</CardDescription>
          </div>
          <Badge tone={tableRows.length === 0 ? 'success' : 'danger'}>
            {tableRows.length} aktif
          </Badge>
        </CardHeader>

        <BottleneckTable rows={tableRows} />
      </Card>
    </>
  )
}
