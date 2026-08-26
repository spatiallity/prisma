import type { Metadata } from 'next'
import { linkButtonClass } from '@/components/ui/button'
import Link from 'next/link'
import { Plus } from 'lucide-react'
import { PageHeader, EmptyState } from '@/components/ui/page-header'
import { Card } from '@/components/ui/card'
import { Table, Td, Th, Tr } from '@/components/ui/table'
import { Badge, StatusBadge } from '@/components/ui/badge'
import { Alert } from '@/components/ui/alert'
import { requirePermission } from '@/lib/auth/session'
import { createClient } from '@/lib/supabase/server'
import { can } from '@/lib/auth/permissions'
import { formatDateTime } from '@/lib/utils'

export const metadata: Metadata = { title: 'User' }

export default async function UsersPage({
  searchParams,
}: {
  searchParams: Promise<{ created?: string }>
}) {
  const current = await requirePermission('user_management', 'view')
  const { created } = await searchParams
  const mayEdit = can(current.permissions, 'user_management', 'edit')

  const supabase = await createClient()
  const [{ data: users, error }, { data: roles }, { data: vendors }] = await Promise.all([
    supabase.from('users').select('*').order('full_name'),
    supabase.from('roles').select('id, name'),
    supabase.from('vendors').select('id, name'),
  ])

  const roleName = new Map((roles ?? []).map((role) => [role.id, role.name]))
  const vendorName = new Map((vendors ?? []).map((vendor) => [vendor.id, vendor.name]))

  return (
    <>
      <PageHeader
        title="User"
        description="Akun aplikasi beserta role-nya. Kredensial sendiri dikelola Supabase Auth."
        actions={
          mayEdit && (
            <Link
              href="/admin/users/new"
              className={linkButtonClass}
            >
              <Plus className="h-4 w-4" aria-hidden />
              Tambah user
            </Link>
          )
        }
      />

      {created && (
        <Alert tone="success" className="mb-4">
          User baru berhasil dibuat.
        </Alert>
      )}
      {error && (
        <Alert tone="danger" className="mb-4" title="Gagal memuat data">
          {error.message}
        </Alert>
      )}

      <Card className="overflow-hidden">
        {users && users.length > 0 ? (
          <Table>
            <thead>
              <tr>
                <Th>Nama</Th>
                <Th>Email</Th>
                <Th>Role</Th>
                <Th>Vendor</Th>
                <Th>Status</Th>
                <Th>Login terakhir</Th>
                <Th className="text-right">Aksi</Th>
              </tr>
            </thead>
            <tbody>
              {users.map((user) => (
                <Tr key={user.id}>
                  <Td className="font-bold text-slate-900">
                    {user.full_name}
                    {user.id === current.id && (
                      <Badge tone="primary" className="ml-2">
                        Anda
                      </Badge>
                    )}
                  </Td>
                  <Td className="text-muted-foreground">{user.email}</Td>
                  <Td>{roleName.get(user.role_id) ?? '—'}</Td>
                  <Td className="text-muted-foreground">
                    {user.vendor_id ? (vendorName.get(user.vendor_id) ?? '—') : '—'}
                  </Td>
                  <Td>
                    <StatusBadge status={user.status} />
                  </Td>
                  <Td className="tnum text-muted-foreground">
                    {formatDateTime(user.last_login_at)}
                  </Td>
                  <Td className="text-right">
                    {mayEdit && (
                      <Link
                        href={`/admin/users/${user.id}`}
                        className="text-sm font-medium text-primary hover:underline"
                      >
                        Kelola
                      </Link>
                    )}
                  </Td>
                </Tr>
              ))}
            </tbody>
          </Table>
        ) : (
          <EmptyState
            title="Belum ada user"
            description="Buat akun pertama melalui Supabase Authentication, lalu hubungkan profilnya di sini."
          />
        )}
      </Card>
    </>
  )
}
