import type { Metadata } from 'next'
import Link from 'next/link'
import { ArrowLeft } from 'lucide-react'
import { PageHeader } from '@/components/ui/page-header'
import { Card, CardContent } from '@/components/ui/card'
import { Alert } from '@/components/ui/alert'
import { requirePermission } from '@/lib/auth/session'
import { createClient } from '@/lib/supabase/server'
import { createUser } from '../actions'
import { UserForm } from '../user-form'

export const metadata: Metadata = { title: 'Tambah user' }

export default async function NewUserPage() {
  await requirePermission('user_management', 'edit')

  const supabase = await createClient()
  const [{ data: roles }, { data: vendors }] = await Promise.all([
    supabase.from('roles').select('id, code, name').eq('status', 'Active').order('name'),
    supabase.from('vendors').select('id, name').eq('status', 'Active').order('name'),
  ])

  return (
    <div className="mx-auto max-w-2xl">
      <Link
        href="/admin/users"
        className="mb-4 inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-primary"
      >
        <ArrowLeft className="h-4 w-4" aria-hidden />
        Kembali ke daftar user
      </Link>

      <PageHeader
        title="Tambah user"
        description="Membuat akun Supabase Auth sekaligus profil beserta role-nya."
      />

      <Card>
        <CardContent className="p-6">
          {roles && roles.length > 0 ? (
            <UserForm
              action={createUser}
              roles={roles}
              vendors={vendors ?? []}
              submitLabel="Buat user"
            />
          ) : (
            <Alert tone="warning" title="Role belum ada">
              Jalankan <code className="code">supabase/seed/seed.sql</code>{' '}
              terlebih dahulu agar role-nya tersedia.
            </Alert>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
