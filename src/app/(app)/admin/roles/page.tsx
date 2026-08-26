import type { Metadata } from 'next'
import Link from 'next/link'
import { PageHeader } from '@/components/ui/page-header'
import { Card } from '@/components/ui/card'
import { Table, Td, Th, Tr } from '@/components/ui/table'
import { Badge, StatusBadge } from '@/components/ui/badge'
import { Alert } from '@/components/ui/alert'
import { requirePermission } from '@/lib/auth/session'
import { createClient } from '@/lib/supabase/server'
import { can } from '@/lib/auth/permissions'

export const metadata: Metadata = { title: 'Role & Permission' }

export default async function RolesPage() {
  const current = await requirePermission('user_management', 'view')
  const mayEdit = can(current.permissions, 'user_management', 'edit')

  const supabase = await createClient()
  const [{ data: roles, error }, { data: grants }, { data: users }] = await Promise.all([
    supabase.from('roles').select('*').order('name'),
    supabase.from('role_permissions').select('role_id'),
    supabase.from('users').select('role_id').eq('status', 'Active'),
  ])

  const grantCount = new Map<string, number>()
  for (const grant of grants ?? []) {
    grantCount.set(grant.role_id, (grantCount.get(grant.role_id) ?? 0) + 1)
  }

  const userCount = new Map<string, number>()
  for (const user of users ?? []) {
    userCount.set(user.role_id, (userCount.get(user.role_id) ?? 0) + 1)
  }

  return (
    <>
      <PageHeader
        title="Role & Permission"
        description="Matrix Section 6 tersimpan sebagai data, bukan kode. Perubahan di sini langsung mengubah RLS."
      />

      {error && (
        <Alert tone="danger" className="mb-4" title="Gagal memuat data">
          {error.message}
        </Alert>
      )}

      <Card className="overflow-hidden">
        <Table>
          <thead>
            <tr>
              <Th>Role</Th>
              <Th>Deskripsi</Th>
              <Th className="text-right">Permission</Th>
              <Th className="text-right">User aktif</Th>
              <Th>Status</Th>
              <Th className="text-right">Aksi</Th>
            </tr>
          </thead>
          <tbody>
            {(roles ?? []).map((role) => (
              <Tr key={role.id}>
                <Td className="font-bold text-slate-900">
                  {role.name}
                  <Badge className="ml-2 code">{role.code}</Badge>
                </Td>
                <Td className="max-w-md text-muted-foreground">{role.description ?? '—'}</Td>
                <Td className="tnum text-right">{grantCount.get(role.id) ?? 0}</Td>
                <Td className="tnum text-right">{userCount.get(role.id) ?? 0}</Td>
                <Td>
                  <StatusBadge status={role.status} />
                </Td>
                <Td className="text-right">
                  <Link
                    href={`/admin/roles/${role.id}`}
                    className="text-sm font-medium text-primary hover:underline"
                  >
                    {mayEdit ? 'Atur permission' : 'Lihat permission'}
                  </Link>
                </Td>
              </Tr>
            ))}
          </tbody>
        </Table>
      </Card>
    </>
  )
}
