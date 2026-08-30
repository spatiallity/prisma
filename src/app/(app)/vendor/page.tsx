import type { Metadata } from 'next'
import { PageHeader, EmptyState } from '@/components/ui/page-header'
import { Card } from '@/components/ui/card'
import { Alert } from '@/components/ui/alert'
import { requirePermission } from '@/lib/auth/session'
import { createClient } from '@/lib/supabase/server'
import { can } from '@/lib/auth/permissions'
import { AddVendorButton } from './add-vendor-button'
import { VendorTable } from './vendor-table'

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

  const teamsByVendor: Record<string, number> = {}
  const vendorByTeam = new Map<string, string>()
  for (const team of teams ?? []) {
    teamsByVendor[team.vendor_id] = (teamsByVendor[team.vendor_id] ?? 0) + 1
    vendorByTeam.set(team.id, team.vendor_id)
  }

  const membersByVendor: Record<string, number> = {}
  for (const member of members ?? []) {
    const vendorId = vendorByTeam.get(member.team_id)
    if (vendorId) {
      membersByVendor[vendorId] = (membersByVendor[vendorId] ?? 0) + 1
    }
  }

  const spkByVendor: Record<string, number> = {}
  for (const assignment of assignments ?? []) {
    spkByVendor[assignment.vendor_id] = (spkByVendor[assignment.vendor_id] ?? 0) + 1
  }

  return (
    <>
      <PageHeader
        title="Vendor Jasa Survey"
        description="Master vendor beserta team dan anggotanya."
        actions={mayEdit && <AddVendorButton />}
      />

      {error && (
        <Alert tone="danger" className="mb-4" title="Gagal memuat data">
          {error.message}
        </Alert>
      )}

      <Card className="overflow-hidden">
        {vendors && vendors.length > 0 ? (
          <VendorTable
            vendors={vendors}
            teamsByVendor={teamsByVendor}
            membersByVendor={membersByVendor}
            spkByVendor={spkByVendor}
            mayEdit={mayEdit}
          />
        ) : (
          <EmptyState
            title="Belum ada vendor"
            description="Tambahkan Vendor Jasa Survey sebelum menugaskan pekerjaan lapangan."
            action={mayEdit ? <AddVendorButton /> : undefined}
          />
        )}
      </Card>
    </>
  )
}
