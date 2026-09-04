import type { Metadata } from 'next'
import Link from 'next/link'
import { notFound } from 'next/navigation'
import { ArrowLeft } from 'lucide-react'
import { PageHeader, EmptyState } from '@/components/ui/page-header'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Table, Td, Th, Tr } from '@/components/ui/table'
import { StatusBadge } from '@/components/ui/badge'
import { requirePermission } from '@/lib/auth/session'
import { createClient } from '@/lib/supabase/server'
import { can } from '@/lib/auth/permissions'
import { formatDate } from '@/lib/utils'
import { updateVendor } from '../actions'
import { VendorForm } from '../vendor-form'
import {
  AddMemberButton,
  AddTeamButton,
  DeleteEntry,
  EditMemberButton,
  EditTeamButton,
  StatusToggle,
} from '../team-forms'

export const metadata: Metadata = { title: 'Detail vendor' }

export default async function VendorDetailPage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const user = await requirePermission('vendor', 'view')
  const { id } = await params
  const mayEdit = can(user.permissions, 'vendor', 'edit')

  const supabase = await createClient()
  const { data: vendor } = await supabase
    .from('vendors')
    .select('*')
    .eq('id', id)
    .maybeSingle()

  if (!vendor) notFound()

  const { data: teams } = await supabase
    .from('vendor_teams')
    .select('*')
    .eq('vendor_id', id)
    .order('name')

  const teamIds = (teams ?? []).map((team) => team.id)

  const [{ data: members }, { data: assignments }] = await Promise.all([
    teamIds.length
      ? supabase.from('vendor_members').select('*').in('team_id', teamIds).order('full_name')
      : Promise.resolve({ data: [] }),
    supabase
      .from('spk_assignments')
      .select('*')
      .eq('vendor_id', id)
      .order('created_at', { ascending: false }),
  ])

  const spkIds = [...new Set((assignments ?? []).map((a) => a.spk_id))]
  const { data: spks } = spkIds.length
    ? await supabase.from('spks').select('id, spk_number, work_name').in('id', spkIds)
    : { data: [] }

  const spkById = new Map((spks ?? []).map((s) => [s.id, s]))
  const teamName = new Map((teams ?? []).map((t) => [t.id, t.name]))
  const activeTeams = (teams ?? []).filter((team) => team.status === 'Active')

  return (
    <>
      <Link
        href="/vendor"
        className="mb-4 inline-flex items-center gap-1.5 text-sm font-semibold text-muted-foreground hover:text-primary"
      >
        <ArrowLeft size={16} aria-hidden />
        Kembali ke daftar vendor
      </Link>

      <PageHeader
        title={vendor.name}
        description={`${vendor.code}${vendor.contact_person ? ` · ${vendor.contact_person}` : ''}`}
        actions={<StatusBadge status={vendor.status} />}
      />

      <div className="grid gap-5 lg:grid-cols-3">
        <div className="grid content-start gap-5 lg:col-span-2">
          <Card>
            <CardHeader>
              <div>
                <CardTitle>Team</CardTitle>
                <CardDescription>
                  Satu vendor bisa menjalankan beberapa team pada SPK berbeda.
                </CardDescription>
              </div>
              {mayEdit && <AddTeamButton vendorId={vendor.id} />}
            </CardHeader>
            <CardContent className="p-0">
              {teams && teams.length > 0 ? (
                <Table>
                  <thead>
                    <tr>
                      <Th>Team</Th>
                      <Th className="text-right">Anggota</Th>
                      <Th>Status</Th>
                      {mayEdit && <Th className="text-right">Aksi</Th>}
                    </tr>
                  </thead>
                  <tbody>
                    {teams.map((team) => (
                      <Tr key={team.id}>
                        <Td className="font-bold text-slate-900">{team.name}</Td>
                        <Td className="tnum text-right">
                          {(members ?? []).filter(
                            (m) => m.team_id === team.id && m.status === 'Active',
                          ).length}
                        </Td>
                        <Td>
                          <StatusBadge status={team.status} />
                        </Td>
                        {mayEdit && (
                          <Td className="text-right">
                            <div className="flex items-center justify-end gap-3">
                              <EditTeamButton team={team} vendorId={vendor.id} />
                              <StatusToggle
                                kind="team"
                                id={team.id}
                                vendorId={vendor.id}
                                status={team.status}
                              />
                              <DeleteEntry kind="team" id={team.id} vendorId={vendor.id} />
                            </div>
                          </Td>
                        )}
                      </Tr>
                    ))}
                  </tbody>
                </Table>
              ) : (
                <EmptyState title="Belum ada team" />
              )}

            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Anggota team</CardTitle>
              {mayEdit && activeTeams.length > 0 && (
                <AddMemberButton vendorId={vendor.id} teams={activeTeams} />
              )}
            </CardHeader>
            <CardContent className="p-0">
              {members && members.length > 0 ? (
                <Table>
                  <thead>
                    <tr>
                      <Th>Nama</Th>
                      <Th>Team</Th>
                      <Th>Posisi</Th>
                      <Th>Telepon</Th>
                      <Th>Status</Th>
                      {mayEdit && <Th className="text-right">Aksi</Th>}
                    </tr>
                  </thead>
                  <tbody>
                    {members.map((member) => (
                      <Tr key={member.id}>
                        <Td className="font-bold text-slate-900">{member.full_name}</Td>
                        <Td className="text-muted-foreground">
                          {teamName.get(member.team_id) ?? '—'}
                        </Td>
                        <Td className="text-muted-foreground">{member.position ?? '—'}</Td>
                        <Td className="tnum text-muted-foreground">{member.phone ?? '—'}</Td>
                        <Td>
                          <StatusBadge status={member.status} />
                        </Td>
                        {mayEdit && (
                          <Td className="text-right">
                            <div className="flex items-center justify-end gap-3">
                              <EditMemberButton
                                member={member}
                                vendorId={vendor.id}
                                teams={teams ?? []}
                              />
                              <StatusToggle
                                kind="member"
                                id={member.id}
                                vendorId={vendor.id}
                                status={member.status}
                              />
                              <DeleteEntry kind="member" id={member.id} vendorId={vendor.id} />
                            </div>
                          </Td>
                        )}
                      </Tr>
                    ))}
                  </tbody>
                </Table>
              ) : (
                <EmptyState title="Belum ada anggota" />
              )}

            </CardContent>
          </Card>

          {mayEdit && (
            <Card>
              <CardHeader>
                <CardTitle>Data vendor</CardTitle>
              </CardHeader>
              <CardContent>
                <VendorForm
                  action={updateVendor}
                  submitLabel="Simpan perubahan"
                  vendor={vendor}
                />
              </CardContent>
            </Card>
          )}
        </div>

        <Card>
          <CardHeader>
            <div>
              <CardTitle>SPK yang ditugaskan</CardTitle>
              <CardDescription>
                Menentukan SPK mana yang terlihat oleh akun vendor ini.
              </CardDescription>
            </div>
          </CardHeader>
          <CardContent className="p-0">
            {assignments && assignments.length > 0 ? (
              <ul className="divide-y divide-slate-100">
                {assignments.map((assignment) => {
                  const spk = spkById.get(assignment.spk_id)
                  return (
                    <li key={assignment.id} className="px-5 py-3">
                      <div className="flex items-start justify-between gap-2">
                        <Link
                          href={`/spk/${assignment.spk_id}`}
                          className="text-sm font-bold text-primary hover:underline"
                        >
                          {spk?.spk_number ?? 'SPK'}
                        </Link>
                        <StatusBadge status={assignment.status} />
                      </div>
                      <div className="text-xs text-muted-foreground">
                        {spk?.work_name}
                      </div>
                      <div className="text-xs text-muted-foreground">
                        {assignment.team_id
                          ? (teamName.get(assignment.team_id) ?? 'Team')
                          : 'Seluruh vendor'}
                        {assignment.assigned_from && (
                          <>
                            {' · '}
                            {formatDate(assignment.assigned_from)} –{' '}
                            {formatDate(assignment.assigned_to)}
                          </>
                        )}
                      </div>
                    </li>
                  )
                })}
              </ul>
            ) : (
              <EmptyState
                title="Belum ditugaskan"
                description="Buat assignment agar vendor ini bisa melihat SPK-nya."
              />
            )}
          </CardContent>
        </Card>
      </div>
    </>
  )
}
