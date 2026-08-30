import type { Metadata } from 'next'
import Link from 'next/link'
import { ArrowLeft } from 'lucide-react'
import { PageHeader } from '@/components/ui/page-header'
import { requirePermission } from '@/lib/auth/session'
import { createClient } from '@/lib/supabase/server'
import { createSpk } from '../actions'
import { SpkForm } from '../spk-form'
import { loadSpkFormOptions } from '../options'

export const metadata: Metadata = { title: 'Buat SPK Baru' }

export default async function NewSpkPage() {
  await requirePermission('spk', 'create')

  const supabase = await createClient()
  const options = await loadSpkFormOptions(supabase)

  return (
    <div className="mx-auto max-w-3xl">
      <Link
        href="/spk"
        className="mb-4 inline-flex items-center gap-1.5 text-sm font-semibold text-muted-foreground hover:text-primary"
      >
        <ArrowLeft size={16} aria-hidden />
        Kembali ke daftar SPK
      </Link>

      <PageHeader
        title="Buat SPK Baru"
        description="Data dasar SPK. Aktivitas dan progress bisa diisi setelah SPK dibuat."
      />

      <SpkForm action={createSpk} submitLabel="Simpan SPK" {...options} />
    </div>
  )
}
