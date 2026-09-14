import type { Metadata } from 'next'
import Link from 'next/link'
import { notFound } from 'next/navigation'
import { ArrowLeft } from 'lucide-react'
import { PageHeader } from '@/components/ui/page-header'
import { requirePermission } from '@/lib/auth/session'
import { createClient } from '@/lib/supabase/server'
import { updateSpk } from '../../actions'
import { SpkForm } from '../../spk-form'

export const metadata: Metadata = { title: 'Edit SPK' }

export default async function EditSpkPage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  await requirePermission('spk', 'edit')
  const { id } = await params

  const supabase = await createClient()
  const { data: spk } = await supabase.from('spks').select('*').eq('id', id).maybeSingle()

  if (!spk) notFound()

  const { data: stakeOutActivity } =
    spk.work_type === 'Stake Out'
      ? await supabase
          .from('spk_activities')
          .select('target_value')
          .eq('spk_id', id)
          .eq('name', 'Stake Out')
          .maybeSingle()
      : { data: null }

  return (
    <div className="mx-auto max-w-3xl">
      <Link
        href={`/spk/${id}`}
        className="mb-4 inline-flex items-center gap-1.5 text-sm font-semibold text-muted-foreground hover:text-primary"
      >
        <ArrowLeft size={16} aria-hidden />
        Kembali ke Detail SPK
      </Link>

      <PageHeader title={`Edit ${spk.spk_number}`} description={spk.work_name} />

      <SpkForm
        action={updateSpk}
        submitLabel="Simpan perubahan"
        spk={spk}
        stakeOutTarget={stakeOutActivity?.target_value ?? null}
      />
    </div>
  )
}
