import type { Metadata } from 'next'
import { PageHeader } from '@/components/ui/page-header'
import { Card } from '@/components/ui/card'
import { Alert } from '@/components/ui/alert'
import { requirePermission } from '@/lib/auth/session'
import { createClient } from '@/lib/supabase/server'
import { can } from '@/lib/auth/permissions'
import { RolesTable } from './roles-table'

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

  const grantCount: Record<string, number> = {}
  for (const grant of grants ?? []) {
    grantCount[grant.role_id] = (grantCount[grant.role_id] ?? 0) + 1
  }

  const userCount: Record<string, number> = {}
  for (const user of users ?? []) {
    userCount[user.role_id] = (userCount[user.role_id] ?? 0) + 1
  }

  return (
    <>
      <PageHeader
        title="Role & Permission"
        description="Permission tersimpan sebagai data, bukan kode — perubahan di sini langsung berlaku."
      />

      {error && (
        <Alert tone="danger" className="mb-4" title="Gagal memuat data">
          {error.message}
        </Alert>
      )}

      <Card className="overflow-hidden">
        <RolesTable
          roles={roles ?? []}
          grantCount={grantCount}
          userCount={userCount}
          mayEdit={mayEdit}
        />
      </Card>
    </>
  )
}
