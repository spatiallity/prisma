import type { Metadata } from 'next'
import Link from 'next/link'
import { PageHeader, EmptyState } from '@/components/ui/page-header'
import { Card } from '@/components/ui/card'
import { Table, Td, Th, Tr } from '@/components/ui/table'
import { StatusBadge } from '@/components/ui/badge'
import { requirePermission } from '@/lib/auth/session'
import { createClient } from '@/lib/supabase/server'

export const metadata: Metadata = { title: 'Team' }

/** Every team across all vendors — the per-vendor view lives on /vendor/[id]. */
export default async function TeamListPage() {
  await requirePermission('vendor', 'view')

  const supabase = await createClient()
  const [{ data: teams }, { data: vendors }, { data: members }, { data: assignments }] =
    await Promise.all([
      supabase.from('vendor_teams').select('*').order('name'),
      supabase.from('vendors').select('id, name, code'),
      supabase.from('vendor_members').select('id, team_id').eq('status', 'Active'),
      supabase.from('spk_assignments').select('team_id').eq('status', 'Active'),
    ])

  const vendorById = new Map((vendors ?? []).map((v) => [v.id, v]))

  const memberCount = new Map<string, number>()
  for (const member of members ?? []) {
    memberCount.set(member.team_id, (memberCount.get(member.team_id) ?? 0) + 1)
  }

  const spkCount = new Map<string, number>()
  for (const assignment of assignments ?? []) {
    if (!assignment.team_id) continue
    spkCount.set(assignment.team_id, (spkCount.get(assignment.team_id) ?? 0) + 1)
  }

  return (
    <>
      <PageHeader
        title="Team"
        description="Seluruh team vendor. Tambah atau nonaktifkan team dari halaman vendornya."
      />

      <Card className="overflow-hidden">
        {teams && teams.length > 0 ? (
          <Table>
            <thead>
              <tr>
                <Th>Team</Th>
                <Th>Vendor</Th>
                <Th className="text-right">Anggota aktif</Th>
                <Th className="text-right">SPK aktif</Th>
                <Th>Status</Th>
              </tr>
            </thead>
            <tbody>
              {teams.map((team) => {
                const vendor = vendorById.get(team.vendor_id)
                return (
                  <Tr key={team.id}>
                    <Td className="font-bold text-slate-900">{team.name}</Td>
                    <Td>
                      <Link
                        href={`/vendor/${team.vendor_id}`}
                        className="font-semibold text-primary hover:underline"
                      >
                        {vendor?.name ?? '—'}
                      </Link>
                    </Td>
                    <Td className="tnum text-right">{memberCount.get(team.id) ?? 0}</Td>
                    <Td className="tnum text-right">{spkCount.get(team.id) ?? 0}</Td>
                    <Td>
                      <StatusBadge status={team.status} />
                    </Td>
                  </Tr>
                )
              })}
            </tbody>
          </Table>
        ) : (
          <EmptyState
            title="Belum ada team"
            description="Buka salah satu vendor untuk menambahkan team pertamanya."
          />
        )}
      </Card>
    </>
  )
}
