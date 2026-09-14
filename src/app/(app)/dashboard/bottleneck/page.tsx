import type { Metadata } from 'next'
import Link from 'next/link'
import { PageHeader, EmptyState } from '@/components/ui/page-header'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Table, Td, Th, Tr } from '@/components/ui/table'
import { Badge } from '@/components/ui/badge'
import { Alert } from '@/components/ui/alert'
import { SpkCell } from '@/components/ui/spk-cell'
import { requirePermission } from '@/lib/auth/session'
import { createClient } from '@/lib/supabase/server'
import { cn } from '@/lib/utils'
import {
  AREA_LABEL,
  SEVERITY_RANK,
  SEVERITY_TONE,
  formatMetric,
} from '@/lib/dashboard'

export const metadata: Metadata = { title: 'Bottleneck' }

/** Where each area's problems are dealt with. */
const AREA_LINK: Record<string, string> = {
  design: '/design',
  routing: '/routing',
  financial: '/financial/invoice',
}

/**
 * Section 9 — every condition the system watches, in one list. The thresholds
 * live in app_settings, so what counts as late is configuration rather than
 * something compiled in.
 */
export default async function BottleneckPage() {
  await requirePermission('dashboard', 'view')

  const supabase = await createClient()
  const [{ data: rows, error }, { data: settings }] = await Promise.all([
    supabase.from('v_bottleneck').select('*'),
    supabase.from('app_settings').select('key, value, description'),
  ])

  const ranked = [...(rows ?? [])].sort(
    (a, b) => SEVERITY_RANK[a.severity] - SEVERITY_RANK[b.severity],
  )

  const perArea = new Map<string, number>()
  for (const row of ranked) {
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
            <CardDescription>Urut dari yang paling kritis.</CardDescription>
          </div>
          <Badge tone={ranked.length === 0 ? 'success' : 'danger'}>
            {ranked.length} aktif
          </Badge>
        </CardHeader>

        {ranked.length > 0 ? (
          <Table>
            <thead>
              <tr>
                <Th>Area</Th>
                <Th>Kondisi</Th>
                <Th>SPK</Th>
                <Th className="text-right">Ukuran</Th>
                <Th>Severity</Th>
              </tr>
            </thead>
            <tbody>
              {ranked.map((row, index) => (
                <Tr key={`${row.reason}-${row.spk_id ?? 'none'}-${index}`}>
                  <Td>
                    <Link
                      href={AREA_LINK[row.area] ?? '/dashboard'}
                      className="text-xs font-bold text-primary hover:underline"
                    >
                      {AREA_LABEL[row.area] ?? row.area}
                    </Link>
                  </Td>
                  <Td className="font-bold text-slate-900">{row.reason}</Td>
                  <Td>
                    {row.spk_id ? (
                      <SpkCell
                        id={row.spk_id}
                        spkNumber={row.spk_number ?? 'SPK'}
                        siteCode={row.site_code}
                      />
                    ) : (
                      <span className="text-muted-foreground">Seluruh project</span>
                    )}
                  </Td>
                  <Td className="tnum text-right text-muted-foreground">
                    {formatMetric(row.reason, row.metric) ?? '—'}
                  </Td>
                  <Td>
                    <Badge tone={SEVERITY_TONE[row.severity]}>{row.severity}</Badge>
                  </Td>
                </Tr>
              ))}
            </tbody>
          </Table>
        ) : (
          <EmptyState
            title="Tidak ada bottleneck"
            description="Semua kondisi berada dalam batas yang disetel."
          />
        )}
      </Card>

      <Card className="overflow-hidden">
        <CardHeader>
          <div>
            <CardTitle>Ambang batas</CardTitle>
            <CardDescription>
              Disimpan sebagai data di <span className="code">app_settings</span>,
              jadi mengubah batas bukan mengubah kode.
            </CardDescription>
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
