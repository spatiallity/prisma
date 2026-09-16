import type { Metadata } from 'next'
import { PageHeader, EmptyState } from '@/components/ui/page-header'
import { Card, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { SpkCell } from '@/components/ui/spk-cell'
import { requirePermission } from '@/lib/auth/session'
import { createClient } from '@/lib/supabase/server'
import type { DesignStage } from '@/lib/supabase/types'

export const metadata: Metadata = { title: 'Progress SPK' }

type Column = 'terestris' | 'desain_awal' | 'finalisasi' | 'invoicing' | 'selesai'

const COLUMNS: { key: Column; label: string }[] = [
  { key: 'terestris', label: 'Survei Terestris' },
  { key: 'desain_awal', label: 'Desain Awal' },
  { key: 'finalisasi', label: 'Finalisasi Desain' },
  { key: 'invoicing', label: 'Invoicing' },
  { key: 'selesai', label: 'Selesai / Invoiced' },
]

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

  const [{ data: spks, error }, { data: activeDesigns }, { data: routingDocs }] = await Promise.all([
    supabase
      .from('spks')
      .select('id, spk_number, site_code, work_name, status')
      .in('status', ['On Going', 'Selesai'])
      .order('spk_number'),
    supabase.from('designs').select('spk_id, phase, current_stage').eq('status', 'Active'),
    supabase.from('spk_routing').select('spk_id'),
  ])

  const designsBySpk = new Map<string, { phase: 'siteplan' | 'finalisasi'; current_stage: DesignStage }[]>()
  for (const d of activeDesigns ?? []) {
    const list = designsBySpk.get(d.spk_id) ?? []
    list.push({ phase: d.phase, current_stage: d.current_stage })
    designsBySpk.set(d.spk_id, list)
  }
  const routedSpkIds = new Set((routingDocs ?? []).map((r) => r.spk_id))

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

  type Row = NonNullable<typeof spks>[number]
  const bySpk = (spks ?? []).reduce<Record<Column, Row[]>>(
    (acc, s) => {
      acc[bucketFor(s)].push(s)
      return acc
    },
    { terestris: [], desain_awal: [], finalisasi: [], invoicing: [], selesai: [] },
  )

  return (
    <>
      <PageHeader
        title="Progress SPK"
        description="Setiap SPK, di tahap mana dia sedang berada — Survei Terestris sampai Selesai/Invoiced."
      />

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-5">
        {COLUMNS.map((col) => {
          const rows = bySpk[col.key]
          return (
            <Card key={col.key} className="flex max-h-[calc(100vh-220px)] flex-col overflow-hidden">
              <CardHeader className="shrink-0">
                <div>
                  <CardTitle>{col.label}</CardTitle>
                </div>
                <Badge tone="info">{rows.length}</Badge>
              </CardHeader>
              {rows.length > 0 ? (
                <ul className="min-h-0 flex-1 divide-y divide-slate-100 overflow-y-auto">
                  {rows.map((row) => (
                    <li key={row.id} className="px-4 py-3">
                      <SpkCell id={row.id} spkNumber={row.spk_number} siteCode={row.site_code} />
                      <div className="line-clamp-1 text-xs text-muted-foreground">{row.work_name}</div>
                    </li>
                  ))}
                </ul>
              ) : (
                <div className="flex-1 px-4 py-6">
                  <EmptyState title="Kosong" />
                </div>
              )}
            </Card>
          )
        })}
      </div>

      {error && (
        <p className="mt-4 text-sm font-semibold text-danger">Gagal memuat data: {error.message}</p>
      )}
    </>
  )
}
