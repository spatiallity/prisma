import type { Metadata } from 'next'
import Link from 'next/link'
import { PageHeader } from '@/components/ui/page-header'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Table, Td, Th, Tr } from '@/components/ui/table'
import { Badge } from '@/components/ui/badge'
import { requirePermission } from '@/lib/auth/session'
import { createClient } from '@/lib/supabase/server'
import { can } from '@/lib/auth/permissions'
import { cn, formatRupiah } from '@/lib/utils'
import { formatPercent } from '@/lib/spk'
import { filterLeafAccounts } from '@/lib/financial'
import { SEVERITY_RANK } from '@/lib/dashboard'

export const metadata: Metadata = { title: 'Project Report' }

/**
 * Section 7 Reports — the whole project on one page: how much work exists, how
 * far it has got, where it is stuck, and what it is worth. Every figure comes
 * from a view, so this page has no arithmetic of its own beyond summing rows.
 */
export default async function ProjectReportPage() {
  const user = await requirePermission('report', 'view')
  const seeFinancial = can(user.permissions, 'spending', 'view')

  const supabase = await createClient()
  const [{ data: kpi }, { data: progress }, { data: bottlenecks }, { data: akunSummary }] =
    await Promise.all([
      supabase.from('v_dashboard_kpi').select('*').maybeSingle(),
      supabase.from('v_spk_progress').select('*'),
      supabase.from('v_bottleneck').select('*'),
      seeFinancial
        ? supabase.from('v_finance_akun_summary').select('*')
        : Promise.resolve({ data: [] }),
    ])

  const ongoing = (progress ?? []).filter((p) => p.status === 'On Going')
  const averageProgress =
    ongoing.length > 0
      ? ongoing.reduce((sum, p) => sum + Number(p.overall_progress), 0) / ongoing.length
      : 0

  const perArea = new Map<string, number>()
  for (const row of bottlenecks ?? []) {
    perArea.set(row.area, (perArea.get(row.area) ?? 0) + 1)
  }
  const critical = (bottlenecks ?? []).filter((b) => b.severity === 'critical').length

  const leafAkun = filterLeafAccounts(akunSummary ?? [])
  const rabTotals = leafAkun.reduce(
    (acc, a) => ({
      anggaran: acc.anggaran + Number(a.anggaran_rp ?? 0),
      realisasi: acc.realisasi + Number(a.realisasi_total),
    }),
    { anggaran: 0, realisasi: 0 },
  )
  const rabPercent =
    rabTotals.anggaran > 0 ? (rabTotals.realisasi / rabTotals.anggaran) * 100 : null

  const worst = [...(bottlenecks ?? [])]
    .sort((a, b) => SEVERITY_RANK[a.severity] - SEVERITY_RANK[b.severity])
    .slice(0, 5)

  return (
    <>
      <PageHeader
        title="Project Report"
        description="Ringkasan seluruh project — pipeline SPK, progress rata-rata, bottleneck, dan posisi financial."
      />

      <div className="mb-5 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Stat label="Total SPK" value={String(kpi?.total_spk ?? 0)} foot={`${kpi?.spk_selesai ?? 0} selesai`} />
        <Stat label="SPK berjalan" value={String(kpi?.spk_on_going ?? 0)} foot="On Going" />
        <Stat
          label="Progress rata-rata"
          value={formatPercent(averageProgress)}
          foot="SPK berjalan saja"
        />
        <Stat
          label="Bottleneck"
          value={String(bottlenecks?.length ?? 0)}
          foot={`${critical} kritis`}
          tone={critical > 0 ? 'danger' : undefined}
        />
      </div>

      <div className="grid gap-5 lg:grid-cols-3">
        <Card className="overflow-hidden lg:col-span-2">
          <CardHeader>
            <div>
              <CardTitle>Pipeline SPK</CardTitle>
              <CardDescription>
                Berapa SPK yang sudah sampai tiap tahap administrasi.
              </CardDescription>
            </div>
          </CardHeader>
          <CardContent className="grid gap-3">
            {[
              { label: 'Total SPK', value: kpi?.total_spk ?? 0 },
              { label: 'On Going', value: kpi?.spk_on_going ?? 0 },
              { label: 'Masuk Routing', value: kpi?.spk_routing ?? 0 },
              { label: 'PAD terbit', value: kpi?.spk_pad ?? 0 },
              { label: 'Invoice terbit', value: kpi?.spk_invoice ?? 0 },
              { label: 'Sudah dibayar', value: kpi?.spk_payment ?? 0 },
            ].map((step) => {
              const peak = Math.max(1, kpi?.total_spk ?? 1)
              return (
                <div key={step.label} className="grid gap-1">
                  <div className="flex items-baseline justify-between gap-3">
                    <span className="text-xs font-extrabold tracking-wider text-slate-500 uppercase">
                      {step.label}
                    </span>
                    <span className="tnum text-sm font-bold text-slate-900">
                      {step.value}
                    </span>
                  </div>
                  <div className="h-1.5 overflow-hidden rounded-full bg-slate-100">
                    <div
                      className="h-full rounded-full bg-primary"
                      style={{ width: `${(step.value / peak) * 100}%` }}
                    />
                  </div>
                </div>
              )
            })}
          </CardContent>
        </Card>

        <div className="grid content-start gap-5">
          <Card className="overflow-hidden">
            <CardHeader>
              <CardTitle>Bottleneck per area</CardTitle>
            </CardHeader>
            <Table>
              <tbody>
                {['operational', 'design', 'routing', 'financial'].map((area) => (
                  <Tr key={area}>
                    <Td className="font-bold text-slate-900 capitalize">{area}</Td>
                    <Td className="tnum text-right">{perArea.get(area) ?? 0}</Td>
                  </Tr>
                ))}
              </tbody>
            </Table>
          </Card>

          {seeFinancial && (
            <Card>
              <CardHeader>
                <div>
                  <CardTitle>RAB — Anggaran vs Realisasi</CardTitle>
                  <CardDescription>{leafAkun.length} kode akun</CardDescription>
                </div>
              </CardHeader>
              <CardContent className="grid gap-2">
                <Row label="Anggaran" value={formatRupiah(rabTotals.anggaran)} />
                <Row label="Realisasi" value={formatRupiah(rabTotals.realisasi)} />
                <Row
                  label="Sisa"
                  value={formatRupiah(rabTotals.anggaran - rabTotals.realisasi)}
                  tone={rabTotals.anggaran - rabTotals.realisasi < 0 ? 'danger' : 'success'}
                />
                <div className="flex items-baseline justify-between gap-3">
                  <span className="text-sm text-muted-foreground">Terpakai</span>
                  <Badge tone={rabPercent !== null && rabPercent > 100 ? 'danger' : 'info'}>
                    {rabPercent === null ? '—' : `${rabPercent.toFixed(1)}%`}
                  </Badge>
                </div>
              </CardContent>
            </Card>
          )}
        </div>
      </div>

      {worst.length > 0 && (
        <Card className="mt-5 overflow-hidden">
          <CardHeader>
            <div>
              <CardTitle>Perlu perhatian lebih dulu</CardTitle>
              <CardDescription>Lima kondisi paling kritis.</CardDescription>
            </div>
            <Link
              href="/dashboard/bottleneck"
              className="text-xs font-bold text-primary hover:underline"
            >
              Semua bottleneck
            </Link>
          </CardHeader>
          <Table>
            <thead>
              <tr>
                <Th>Area</Th>
                <Th>Kondisi</Th>
                <Th>SPK</Th>
                <Th>Severity</Th>
              </tr>
            </thead>
            <tbody>
              {worst.map((row, index) => (
                <Tr key={`${row.reason}-${index}`}>
                  <Td className="capitalize text-muted-foreground">{row.area}</Td>
                  <Td className="font-bold text-slate-900">{row.reason}</Td>
                  <Td>
                    {row.spk_id ? (
                      <Link
                        href={`/spk/${row.spk_id}`}
                        className="font-bold text-primary hover:underline"
                      >
                        {row.spk_number ?? 'SPK'}
                      </Link>
                    ) : (
                      <span className="text-muted-foreground">Seluruh project</span>
                    )}
                  </Td>
                  <Td>
                    <Badge tone={row.severity === 'critical' ? 'danger' : 'warning'}>
                      {row.severity}
                    </Badge>
                  </Td>
                </Tr>
              ))}
            </tbody>
          </Table>
        </Card>
      )}
    </>
  )
}

function Stat({
  label,
  value,
  foot,
  tone,
}: {
  label: string
  value: string
  foot?: string
  tone?: 'danger'
}) {
  return (
    <Card>
      <CardContent className="p-4">
        <div className="text-[11px] font-extrabold tracking-wider text-slate-500 uppercase">
          {label}
        </div>
        <div
          className={cn(
            'tnum mt-1 text-2xl font-black',
            tone === 'danger' ? 'text-danger' : 'text-slate-900',
          )}
        >
          {value}
        </div>
        {foot && <div className="mt-1 text-xs text-muted-foreground">{foot}</div>}
      </CardContent>
    </Card>
  )
}

function Row({
  label,
  value,
  tone,
}: {
  label: string
  value: string
  tone?: 'success' | 'danger'
}) {
  return (
    <div className="flex items-baseline justify-between gap-3">
      <span className="text-sm text-muted-foreground">{label}</span>
      <span
        className={cn(
          'tnum font-bold',
          tone === 'danger'
            ? 'text-danger'
            : tone === 'success'
              ? 'text-success'
              : 'text-slate-900',
        )}
      >
        {value}
      </span>
    </div>
  )
}
