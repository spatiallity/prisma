import type { Metadata } from 'next'
import Link from 'next/link'
import { ArrowLeft } from 'lucide-react'
import { PageHeader } from '@/components/ui/page-header'
import { requirePermission } from '@/lib/auth/session'
import { createSpk } from '../actions'
import { SpkForm } from '../spk-form'

export const metadata: Metadata = { title: 'Buat SPK Baru' }

export default async function NewSpkPage() {
  await requirePermission('spk', 'create')

  return (
    <div className="mx-auto max-w-5xl pb-8">
      <Link
        href="/spk"
        className="mb-4 inline-flex items-center gap-1.5 text-sm font-semibold text-muted-foreground hover:text-primary"
      >
        <ArrowLeft size={16} aria-hidden />
        Kembali ke daftar SPK
      </Link>

      <PageHeader
        title="Buat SPK Baru"
        description="Lengkapi data pekerjaan, jadwal, dan PDF SPK bila dokumen sudah tersedia."
      />

      <SpkForm action={createSpk} submitLabel="Simpan SPK" allowInitialFileUpload />
    </div>
  )
}
