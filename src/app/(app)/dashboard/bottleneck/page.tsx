import type { Metadata } from 'next'
import { PageHeader, EmptyState } from '@/components/ui/page-header'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Table, Td, Th, Tr } from '@/components/ui/table'
import { Badge } from '@/components/ui/badge'
import { Alert } from '@/components/ui/alert'
import { requirePermission } from '@/lib/auth/session'
import { createClient } from '@/lib/supabase/server'
import { cn } from '@/lib/utils'
import { AREA_LABEL, type BottleneckDesignContext, bottleneckSinceDate } from '@/lib/dashboard'
import { daysInStage } from '@/lib/design'
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
  const [{ data: rows, error }, { data: settings }, { data: activeDesigns }, { data: spkMarks }] =
    await Promise.all([
      supabase.from('v_bottleneck').select('*'),
      supabase.from('app_settings').select('key, value, description'),
      supabase.from('designs').select('spk_id, phase, current_stage, updated_at').eq('status', 'Active'),
      supabase.from('spks').select('id, opname_marked_at, pad_marked_at'),
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
    }
  })

  const perArea = new Map<string, number>()
  for (const row of tableRows) {
    perArea.set(row.area, (perArea.get(row.area) ?? 0) + 1)
  }

  const areas = ['design', 'routing', 'financial']

  return (
    <>
      <PageHeader
        title="Bottleneck Monitoring"
        description="Kondisi yang membutuhkan perhatian."
      />

      {error && (
        <Alert tone="danger" className="mb-4" title="Gagal memuat data">
          {error.message}
        </Alert>
      )}

      <div className="mb-5 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {areas.map((area) => {
          const count = perArea.get(area) ?? 0
          return (
            <Card key={area}>
              <CardContent className="p-4">
                <div className="text-[11px] font-extrabold tracking-wider text-slate-500 uppercase">
                  {AREA_LABEL[area] ?? area}
                </div>
                <div
                  className={cn(
                    'tnum mt-1 text-2xl font-black',
                    count === 0 ? 'text-success' : 'text-slate-900',
                  )}
                >
                  {count}
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
          </div>
          <Badge tone={tableRows.length === 0 ? 'success' : 'danger'}>
            {tableRows.length} aktif
          </Badge>
        </CardHeader>

        <BottleneckTable rows={tableRows} />
      </Card>

      <Card className="overflow-hidden">
        <CardHeader>
          <div>
            <CardTitle>Ambang batas</CardTitle>
          </div>
        </CardHeader>
        {settings && settings.length > 0 ? (
          <Table>
            <thead>
              <tr>
                <Th>Kunci</Th>
                <Th>Nilai</Th>
                <Th>Keterangan</Th>
              </tr>
            </thead>
            <tbody>
              {settings.map((setting) => (
                <Tr key={setting.key}>
                  <Td>
                    <span className="code text-xs">{setting.key}</span>
                  </Td>
                  <Td className="tnum font-bold">{setting.value}</Td>
                  <Td className="text-muted-foreground">{setting.description ?? '—'}</Td>
                </Tr>
              ))}
            </tbody>
          </Table>
        ) : (
          <EmptyState title="Belum ada ambang batas tersimpan" />
        )}
      </Card>
    </>
  )
}
