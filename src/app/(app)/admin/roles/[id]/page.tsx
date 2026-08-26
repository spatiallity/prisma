import type { Metadata } from 'next'
import Link from 'next/link'
import { notFound } from 'next/navigation'
import { ArrowLeft } from 'lucide-react'
import { PageHeader } from '@/components/ui/page-header'
import { Alert } from '@/components/ui/alert'
import { Badge } from '@/components/ui/badge'
import { requirePermission } from '@/lib/auth/session'
import { createClient } from '@/lib/supabase/server'
import { can, type PermissionMap } from '@/lib/auth/permissions'
import { MatrixForm } from '../matrix-form'

export const metadata: Metadata = { title: 'Permission role' }

export default async function RolePermissionPage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const current = await requirePermission('user_management', 'view')
  const { id } = await params
  const mayEdit = can(current.permissions, 'user_management', 'edit')

  const supabase = await createClient()
  const [{ data: role }, { data: grants }, { data: catalogue }] = await Promise.all([
    supabase.from('roles').select('*').eq('id', id).maybeSingle(),
    supabase.from('role_permissions').select('permission_id, scope').eq('role_id', id),
    supabase.from('permissions').select('id, module, action'),
  ])

  if (!role) notFound()

  const byId = new Map((catalogue ?? []).map((p) => [p.id, p]))
  const granted: PermissionMap = {}
  for (const grant of grants ?? []) {
    const permission = byId.get(grant.permission_id)
    if (permission) granted[`${permission.module}:${permission.action}`] = grant.scope
  }

  return (
    <>
      <Link
        href="/admin/roles"
        className="mb-4 inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-primary"
      >
        <ArrowLeft className="h-4 w-4" aria-hidden />
        Kembali ke daftar role
      </Link>

      <PageHeader
        title={role.name}
        description={role.description ?? undefined}
        actions={<Badge className="font-mono">{role.code}</Badge>}
      />

      {role.code === 'administration' && mayEdit && (
        <Alert tone="warning" className="mb-4" title="Hati-hati">
          Role ini yang memegang User Management. Mencabut{' '}
          <code className="font-mono">user_management: edit</code> dari role
          terakhir yang memilikinya membuat halaman ini tidak dapat diakses siapa
          pun, dan harus diperbaiki lewat SQL editor Supabase.
        </Alert>
      )}

      <MatrixForm roleId={role.id} granted={granted} readOnly={!mayEdit} />
    </>
  )
}
