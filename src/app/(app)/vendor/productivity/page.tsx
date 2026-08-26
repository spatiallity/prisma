import type { Metadata } from 'next'
import Link from 'next/link'
import { PageHeader, EmptyState } from '@/components/ui/page-header'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Table, Td, Th, Tr } from '@/components/ui/table'
import { requirePermission } from '@/lib/auth/session'
import { createClient } from '@/lib/supabase/server'

export const metadata: Metadata = { title: 'Productivity' }

const number = new Intl.NumberFormat('id-ID', { maximumFractionDigits: 2 })

/** Section 20 — Terestris 1,8 Ha/day, Stake Out 15 patok/day. All computed. */
export default async function ProductivityPage() {
  await requirePermission('vendor', 'view')

  const supabase = await createClient()
  const { data: rows } = await supabase
    .from('v_productivity')
    .select('*')
    .order('per_day', { ascending: false })

  const spkIds = [...new Set((rows ?? []).map((r) => r.spk_id))]
  const vendorIds = [...new Set((rows ?? []).map((r) => r.vendor_id).filter(Boolean))] as string[]
  const teamIds = [...new Set((rows ?? []).map((r) => r.team_id).filter(Boolean))] as string[]

  const [{ data: spks }, { data: vendors }, { data: teams }] = await Promise.all([
    spkIds.length
      ? supabase.from('spks').select('id, spk_number, site_code').in('id', spkIds)
      : Promise.resolve({ data: [] }),
    vendorIds.length
      ? supabase.from('vendors').select('id, name').in('id', vendorIds)
      : Promise.resolve({ data: [] }),
    teamIds.length
      ? supabase.from('vendor_teams').select('id, name').in('id', teamIds)
      : Promise.resolve({ data: [] }),
  ])

  const spkById = new Map((spks ?? []).map((s) => [s.id, s]))
  const vendorName = new Map((vendors ?? []).map((v) => [v.id, v.name]))
  const teamName = new Map((teams ?? []).map((t) => [t.id, t.name]))

  // Per-activity roll-up across every team, for the summary strip.
  const byActivity = new Map<string, { unit: string | null; total: number; days: number }>()
  for (const row of rows ?? []) {
    const key = row.activity_name ?? 'Tanpa aktivitas'
    const current = byActivity.get(key) ?? { unit: row.unit, total: 0, days: 0 }
    current.total += Number(row.total_actual)
    current.days += Number(row.working_days)
    byActivity.set(key, current)
  }

  return (
    <>
      <PageHeader
        title="Productivity"
        description="Hasil per hari kerja, dihitung dari Daily Progress (Section 20)."
      />

      {byActivity.size > 0 && (
        <div className="mb-5 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {[...byActivity.entries()].slice(0, 4).map(([name, stat]) => (
            <Card key={name}>
              <CardContent className="p-4">
                <div className="truncate text-[11px] font-extrabold tracking-wider text-slate-500 uppercase">
                  {name}
                </div>
                <div className="tnum mt-1 text-2xl font-black text-slate-900">
                  {stat.days > 0 ? number.format(stat.total / stat.days) : '—'}
                  <span className="ml-1 text-sm font-bold text-muted-foreground">
                    {stat.unit ? `${stat.unit}/hari` : '/hari'}
                  </span>
                </div>
                <div className="mt-0.5 text-xs text-muted-foreground">
                  {number.format(stat.total)}
                  {stat.unit ? ` ${stat.unit}` : ''} dalam {stat.days} hari kerja
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      <Card className="overflow-hidden">
        <CardHeader>
          <div>
            <CardTitle>Per team</CardTitle>
            <CardDescription>
              Hari kerja dihitung dari tanggal unik yang punya laporan, bukan dari
              rentang kalender.
            </CardDescription>
          </div>
        </CardHeader>

        {rows && rows.length > 0 ? (
          <Table>
            <thead>
              <tr>
                <Th>Vendor</Th>
                <Th>Team</Th>
                <Th>SPK</Th>
                <Th>Aktivitas</Th>
                <Th className="text-right">Hari kerja</Th>
                <Th className="text-right">Total aktual</Th>
                <Th className="text-right">Per hari</Th>
              </tr>
            </thead>
            <tbody>
              {rows.map((row, index) => {
                const spk = spkById.get(row.spk_id)
                return (
                  <Tr key={`${row.spk_activity_id}-${row.team_id}-${index}`}>
                    <Td className="font-bold text-slate-900">
                      {row.vendor_id ? (vendorName.get(row.vendor_id) ?? '—') : '—'}
                    </Td>
                    <Td className="text-muted-foreground">
                      {row.team_id ? (teamName.get(row.team_id) ?? '—') : '—'}
                    </Td>
                    <Td>
                      <Link
                        href={`/spk/${row.spk_id}`}
                        className="font-bold text-primary hover:underline"
                      >
                        {spk?.site_code ?? spk?.spk_number ?? 'SPK'}
                      </Link>
                    </Td>
                    <Td className="text-muted-foreground">{row.activity_name ?? '—'}</Td>
                    <Td className="tnum text-right">{row.working_days}</Td>
                    <Td className="tnum text-right">
                      {number.format(Number(row.total_actual))}
                      {row.unit ? ` ${row.unit}` : ''}
                    </Td>
                    <Td className="tnum text-right font-bold text-slate-900">
                      {row.per_day === null
                        ? '—'
                        : `${number.format(Number(row.per_day))}${row.unit ? ` ${row.unit}` : ''}/hari`}
                    </Td>
                  </Tr>
                )
              })}
            </tbody>
          </Table>
        ) : (
          <EmptyState
            title="Belum ada data produktivitas"
            description="Produktivitas muncul setelah ada Daily Progress yang tercatat."
          />
        )}
      </Card>
    </>
  )
}
