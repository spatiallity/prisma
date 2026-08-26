import type { Metadata } from 'next'
import Link from 'next/link'
import { ArrowLeft } from 'lucide-react'
import { PageHeader } from '@/components/ui/page-header'
import { Card, CardContent } from '@/components/ui/card'
import { requirePermission } from '@/lib/auth/session'
import { createVendor } from '../actions'
import { VendorForm } from '../vendor-form'

export const metadata: Metadata = { title: 'Tambah vendor' }

export default async function NewVendorPage() {
  await requirePermission('vendor', 'edit')

  return (
    <div className="mx-auto max-w-2xl">
      <Link
        href="/vendor"
        className="mb-4 inline-flex items-center gap-1.5 text-sm font-semibold text-muted-foreground hover:text-primary"
      >
        <ArrowLeft size={16} aria-hidden />
        Kembali ke daftar vendor
      </Link>

      <PageHeader
        title="Tambah vendor"
        description="Team dan anggota ditambahkan setelah vendor tersimpan."
      />

      <Card>
        <CardContent className="p-6">
          <VendorForm action={createVendor} submitLabel="Simpan vendor" />
        </CardContent>
      </Card>
    </div>
  )
}
