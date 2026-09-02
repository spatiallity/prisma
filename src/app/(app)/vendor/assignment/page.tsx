import type { Metadata } from 'next'
import Link from 'next/link'
import { PageHeader, EmptyState } from '@/components/ui/page-header'
import { Card } from '@/components/ui/card'
import { Table, Td, Th, Tr } from '@/components/ui/table'
import { StatusBadge } from '@/components/ui/badge'
import { requirePermission } from '@/lib/auth/session'
import { createClient } from '@/lib/supabase/server'
import { can } from '@/lib/auth/permissions'
import { formatDate } from '@/lib/utils'
import { AssignmentDeleteButton, AssignmentStatusToggle } from './assignment-form'
import { AddAssignmentButton } from './add-assignment-button'

export const metadata: Metadata = { title: 'Assignment' }

export default async function AssignmentPage() {
  const user = await requirePermission('vendor', 'view')
  const mayEdit = can(user.permissions, 'vendor', 'edit')

  const supabase = await createClient()
  const [{ data: assignments }, { data: spks }, { data: vendors }, { data: teams }] =
    await Promise.all([
      supabase.from('spk_assignments').select('*').order('created_at', { ascending: false }),
      supabase
        .from('spks')
        .select('id, spk_number, work_name, status')
        .in('status', ['Draft', 'On Going'])
        .order('spk_number'),
      supabase.from('vendors').select('id, name, code').eq('status', 'Active').order('name'),
      supabase
        .from('vendor_teams')
        .select('id, vendor_id, name')
        .eq('status', 'Active')
        .order('name'),
    ])

  const spkById = new Map((spks ?? []).map((s) => [s.id, s]))
  const vendorName = new Map((vendors ?? []).map((v) => [v.id, v.name]))
  const teamName = new Map((teams ?? []).map((t) => [t.id, t.name]))

  return (
    <>
      <PageHeader
        title="Assignment"
        description="Menugaskan vendor atau team ke sebuah SPK. Ini yang menentukan SPK mana yang terlihat oleh akun vendor."
        actions={
          mayEdit && (
            <AddAssignmentButton
              spks={(spks ?? []).map((s) => ({
                id: s.id,
                label: `${s.spk_number} — ${s.work_name}`,
              }))}
              vendors={(vendors ?? []).map((v) => ({
                id: v.id,
                label: `${v.name} (${v.code})`,
              }))}
              teams={(teams ?? []).map((t) => ({
                id: t.id,
                vendorId: t.vendor_id,
                label: t.name,
              }))}
            />
          )
        }
      />

      <Card className="overflow-hidden">
        {assignments && assignments.length > 0 ? (
          <Table>
            <thead>
              <tr>
                <Th>SPK</Th>
                <Th>Vendor</Th>
                <Th>Team</Th>
                <Th>Periode</Th>
                <Th>Status</Th>
                {mayEdit && <Th className="text-right">Aksi</Th>}
              </tr>
            </thead>
            <tbody>
              {assignments.map((assignment) => {
                const spk = spkById.get(assignment.spk_id)
                return (
                  <Tr key={assignment.id}>
                    <Td>
                      <Link
                        href={`/spk/${assignment.spk_id}`}
                        className="font-bold text-primary hover:underline"
                      >
                        {spk?.spk_number ?? 'SPK'}
                      </Link>
                      {spk?.work_name && (
                        <div className="line-clamp-1 text-xs text-muted-foreground">
                          {spk.work_name}
                        </div>
                      )}
                    </Td>
                    <Td className="font-bold text-slate-900">
                      {vendorName.get(assignment.vendor_id) ?? '—'}
                    </Td>
                    <Td className="text-muted-foreground">
                      {assignment.team_id
                        ? (teamName.get(assignment.team_id) ?? '—')
                        : 'Seluruh vendor'}
                    </Td>
                    <Td className="tnum whitespace-nowrap text-muted-foreground">
                      {assignment.assigned_from
                        ? `${formatDate(assignment.assigned_from)} – ${formatDate(assignment.assigned_to)}`
                        : '—'}
                    </Td>
                    <Td>
                      <StatusBadge status={assignment.status} />
                    </Td>
                    {mayEdit && (
                      <Td className="text-right">
                        <div className="flex items-center justify-end gap-3">
                          <AssignmentStatusToggle
                            id={assignment.id}
                            spkId={assignment.spk_id}
                            vendorId={assignment.vendor_id}
                            status={assignment.status}
                          />
                          <AssignmentDeleteButton
                            id={assignment.id}
                            spkId={assignment.spk_id}
                            vendorId={assignment.vendor_id}
                          />
                        </div>
                      </Td>
                    )}
                  </Tr>
                )
              })}
            </tbody>
          </Table>
        ) : (
          <EmptyState
            title="Belum ada assignment"
            description="Tugaskan vendor ke SPK agar mereka bisa mengisi Daily Plan dan Daily Progress."
          />
        )}
      </Card>
    </>
  )
}
