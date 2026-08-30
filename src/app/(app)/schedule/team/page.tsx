import type { Metadata } from 'next'
import Link from 'next/link'
import { PageHeader, EmptyState } from '@/components/ui/page-header'
import { Card, CardHeader, CardTitle } from '@/components/ui/card'
import { Table, Td, Th, Tr } from '@/components/ui/table'
import { Badge } from '@/components/ui/badge'
import { requirePermission } from '@/lib/auth/session'
import { createClient } from '@/lib/supabase/server'
import { UPDATE_STATUS_TONE } from '@/lib/schedule'

export const metadata: Metadata = { title: 'Team Schedule' }

/** Section 10 — Today's Schedule, straight from v_today_schedule. */
export default async function TeamSchedulePage() {
  await requirePermission('schedule', 'view')

  const supabase = await createClient()
  const { data: rows } = await supabase
    .from('v_today_schedule')
    .select('*')
    .order('vendor_name')

  const today = new Intl.DateTimeFormat('id-ID', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  }).format(new Date())

  return (
    <>
      <PageHeader
        title="Team Schedule"
        description={`Pekerjaan hari ini — ${today}.`}
      />

      <Card className="overflow-hidden">
        <CardHeader>
          <div>
            <CardTitle>Hari ini</CardTitle>
          </div>
          <Badge tone="primary">{rows?.length ?? 0} pekerjaan</Badge>
        </CardHeader>

        {rows && rows.length > 0 ? (
          <Table>
            <thead>
              <tr>
                <Th>Vendor Jasa Survey</Th>
                <Th>Team</Th>
                <Th>SPK</Th>
                <Th>Aktivitas</Th>
                <Th className="text-right">Target</Th>
                <Th>Status</Th>
              </tr>
            </thead>
            <tbody>
              {rows.map((row) => (
                <Tr key={row.daily_plan_id}>
                  <Td className="font-bold text-slate-900">{row.vendor_name ?? '—'}</Td>
                  <Td className="text-muted-foreground">{row.team_name ?? '—'}</Td>
                  <Td>
                    <Link
                      href={`/spk/${row.spk_id}`}
                      className="font-bold text-primary hover:underline"
                    >
                      {row.site_code ?? row.spk_number}
                    </Link>
                  </Td>
                  <Td className="text-muted-foreground">{row.activity_name ?? '—'}</Td>
                  <Td className="tnum text-right">
                    {row.target_value !== null
                      ? `${row.target_value}${row.unit ? ` ${row.unit}` : ''}`
                      : '—'}
                  </Td>
                  <Td>
                    <Badge tone={UPDATE_STATUS_TONE[row.update_status]}>
                      {row.update_status}
                    </Badge>
                  </Td>
                </Tr>
              ))}
            </tbody>
          </Table>
        ) : (
          <EmptyState
            title="Tidak ada pekerjaan terjadwal hari ini"
            description="Buat Daily Plan dengan tanggal hari ini agar muncul di sini."
          />
        )}
      </Card>
    </>
  )
}
