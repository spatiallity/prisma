import type { Metadata } from 'next'
import Link from 'next/link'
import { notFound } from 'next/navigation'
import { ArrowLeft } from 'lucide-react'
import { PageHeader } from '@/components/ui/page-header'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { requirePermission } from '@/lib/auth/session'
import { createClient } from '@/lib/supabase/server'
import { updateUser } from '../actions'
import { UserForm } from '../user-form'
import { PasswordForm } from '../password-form'

export const metadata: Metadata = { title: 'Kelola user' }

export default async function EditUserPage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  await requirePermission('user_management', 'edit')
  const { id } = await params

  const supabase = await createClient()
  const [{ data: user }, { data: roles }, { data: vendors }] = await Promise.all([
    supabase.from('users').select('*').eq('id', id).maybeSingle(),
    supabase.from('roles').select('id, code, name').eq('status', 'Active').order('name'),
    supabase.from('vendors').select('id, name').eq('status', 'Active').order('name'),
  ])

  if (!user) notFound()

  return (
    <div className="mx-auto max-w-2xl">
      <Link
        href="/admin/users"
        className="mb-4 inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-primary"
      >
        <ArrowLeft className="h-4 w-4" aria-hidden />
        Kembali ke daftar user
      </Link>

      <PageHeader title={user.full_name} description={user.email} />

      <div className="grid gap-5">
        <Card>
          <CardContent className="p-6">
            <UserForm
              action={updateUser}
              roles={roles ?? []}
              vendors={vendors ?? []}
              user={user}
              submitLabel="Simpan perubahan"
            />
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <div>
              <CardTitle>Password</CardTitle>
              <CardDescription>
                Mengganti kredensial di Supabase Auth. Session lama tetap berlaku
                sampai kedaluwarsa.
              </CardDescription>
            </div>
          </CardHeader>
          <CardContent>
            <PasswordForm userId={user.id} />
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
