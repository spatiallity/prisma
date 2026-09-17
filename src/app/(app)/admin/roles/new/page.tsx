import type { Metadata } from 'next'
import Link from 'next/link'
import { ArrowLeft } from 'lucide-react'
import { Card } from '@/components/ui/card'
import { PageHeader } from '@/components/ui/page-header'
import { requirePermission } from '@/lib/auth/session'
import { RoleForm } from '../role-form'

export const metadata: Metadata = { title: 'Tambah role' }

export default async function NewRolePage() {
  const current = await requirePermission('user_management', 'edit')
  if (current.role.code !== 'super_admin') {
    throw new Error('Hanya Super Admin yang dapat menambah role.')
  }

  return (
    <>
      <Link href="/admin/roles" className="mb-4 inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-primary">
        <ArrowLeft className="h-4 w-4" aria-hidden />
        Kembali ke daftar role
      </Link>
      <PageHeader title="Tambah role" description="Role baru belum memiliki permission. Atur setelah role disimpan." />
      <Card className="max-w-2xl p-6">
        <RoleForm />
      </Card>
    </>
  )
}
