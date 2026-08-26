import type { Metadata } from 'next'
import Link from 'next/link'
import { Plus } from 'lucide-react'
import { PageHeader, EmptyState } from '@/components/ui/page-header'
import { Card } from '@/components/ui/card'
import { Table, Td, Th, Tr } from '@/components/ui/table'
import { StatusBadge } from '@/components/ui/badge'
import { Alert } from '@/components/ui/alert'
import { linkButtonClass } from '@/components/ui/button'
import { requirePermission } from '@/lib/auth/session'
import { createClient } from '@/lib/supabase/server'
import { can } from '@/lib/auth/permissions'

export const metadata: Metadata = { title: 'Vendor Jasa Survey' }

export default async function VendorListPage() {
  const user = await requirePermission('vendor', 'view')
  const mayEdit = can(user.permissions, 'vendor', 'edit')

  const supabase = await createClient()
  const [{ data: vendors, error }, { data: teams }, { data: members }, { data: assignments }] =
    await Promise.all([
      supabase.from('vendors').select('*').order('name'),
      supabase.from('vendor_teams').select('id, vendor_id').eq('status', 'Active'),
      supabase.from('vendor_members').select('id, team_id').eq('status', 'Active'),
      supabase.from('spk_assignments').select('vendor_id').eq('status', 'Active'),
    ])

  const teamsByVendor = new Map<string, number>()
  const vendorByTeam = new Map<string, string>()
  for (const team of teams ?? []) {
    teamsByVendor.set(team.vendor_id, (teamsByVendor.get(team.vendor_id) ?? 0) + 1)
    vendorByTeam.set(team.id, team.vendor_id)
  }

  const membersByVendor = new Map<string, number>()
  for (const member of members ?? []) {
    const vendorId = vendorByTeam.get(member.team_id)
    if (vendorId) {
      membersByVendor.set(vendorId, (membersByVendor.get(vendorId) ?? 0) + 1)
    }
  }

  const spkByVendor = new Map<string, number>()
  for (const assignment of assignments ?? []) {
    spkByVendor.set(assignment.vendor_id, (spkByVendor.get(assignment.vendor_id) ?? 0) + 1)
  }

  return (
    <>
      <PageHeader
        title="Vendor Jasa Survey"
        description="Master vendor beserta team dan anggotanya (Section 19)."
        actions={
          mayEdit && (
            <Link href="/vendor/new" className={linkButtonClass}>
              <Plus size={16} aria-hidden />
              Tambah vendor
            </Link>
          )
        }
      />

      {error && (
        <Alert tone="danger" className="mb-4" title="Gagal memuat data">
          {error.message}
        </Alert>
      )}

      <Card className="overflow-hidden">
        {vendors && vendors.length > 0 ? (
          <Table>
            <thead>
              <tr>
                <Th>Vendor</Th>
                <Th>Contact person</Th>
                <Th>Telepon</Th>
                <Th className="text-right">Team</Th>
                <Th className="text-right">Anggota</Th>
                <Th className="text-right">SPK aktif</Th>
                <Th>Status</Th>
              </tr>
            </thead>
            <tbody>
              {vendors.map((vendor) => (
                <Tr key={vendor.id}>
                  <Td>
                    <Link
                      href={`/vendor/${vendor.id}`}
                      className="font-bold text-primary hover:underline"
                    >
                      {vendor.name}
                    </Link>
                    <div className="font-mono text-xs text-slate-500">{vendor.code}</div>
                  </Td>
                  <Td className="text-muted-foreground">{vendor.contact_person ?? '—'}</Td>
                  <Td className="tnum text-muted-foreground">{vendor.phone ?? '—'}</Td>
                  <Td className="tnum text-right">{teamsByVendor.get(vendor.id) ?? 0}</Td>
                  <Td className="tnum text-right">{membersByVendor.get(vendor.id) ?? 0}</Td>
                  <Td className="tnum text-right">{spkByVendor.get(vendor.id) ?? 0}</Td>
                  <Td>
                    <StatusBadge status={vendor.status} />
                  </Td>
                </Tr>
              ))}
            </tbody>
          </Table>
        ) : (
          <EmptyState
            title="Belum ada vendor"
            description="Tambahkan Vendor Jasa Survey sebelum menugaskan pekerjaan lapangan."
            action={
              mayEdit ? (
                <Link href="/vendor/new" className={linkButtonClass}>
                  <Plus size={16} aria-hidden />
                  Tambah vendor
                </Link>
              ) : undefined
            }
          />
        )}
      </Card>
    </>
  )
}
