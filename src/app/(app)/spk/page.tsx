import type { Metadata } from 'next'
import Link from 'next/link'
import { Plus } from 'lucide-react'
import { PageHeader, EmptyState } from '@/components/ui/page-header'
import { Card, CardContent } from '@/components/ui/card'
import { Alert } from '@/components/ui/alert'
import { linkButtonClass } from '@/components/ui/button'
import { requirePermission } from '@/lib/auth/session'
import { createClient } from '@/lib/supabase/server'
import { can } from '@/lib/auth/permissions'
import { statusFromFilterKey } from '@/lib/spk'
import { loadStageBySpk } from '@/lib/spk-stage'
import { SpkFilters } from './spk-filters'
import { SpkTable } from './spk-table'

export const metadata: Metadata = { title: 'SPK' }

/** PostgREST `or()` takes a comma-separated list, so those characters must go. */
function sanitize(term: string) {
  return term.replace(/[,()*%]/g, ' ').trim()
}

export default async function SpkListPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; status?: string }>
}) {
  const user = await requirePermission('spk', 'view')
  const { q, status } = await searchParams
  const mayCreate = can(user.permissions, 'spk', 'create')
  const mayEdit = can(user.permissions, 'spk', 'edit')

  const supabase = await createClient()

  let query = supabase.from('spks').select('*')
    .order('start_date', { ascending: false, nullsFirst: false })
    .order('created_at', { ascending: false })

  const wanted = statusFromFilterKey(status)
  if (wanted) query = query.eq('status', wanted)

  const term = sanitize(q ?? '')
  if (term) {
    query = query.or(
      `spk_number.ilike.%${term}%,work_name.ilike.%${term}%,site_code.ilike.%${term}%,location.ilike.%${term}%`,
    )
  }

  const { data: spks, error } = await query
  const stageBySpk = await loadStageBySpk(supabase, spks ?? [])

  return (
    <>
      <PageHeader
        title="SPK"
        description="Setiap progress, desain, routing, dan angka financial menempel pada salah satu SPK di sini."
        actions={
          mayCreate && (
            <Link href="/spk/new" className={linkButtonClass}>
              <Plus size={16} aria-hidden />
              Buat SPK Baru
            </Link>
          )
        }
      />

      {error && (
        <Alert tone="danger" className="mb-4" title="Gagal memuat data">
          {error.message}
        </Alert>
      )}

      <Card className="mb-5">
        <CardContent className="py-3">
          <SpkFilters total={spks?.length ?? 0} />
        </CardContent>
      </Card>

      <Card className="overflow-hidden">
        {spks && spks.length > 0 ? (
          <SpkTable
            spks={spks}
            stageBySpk={stageBySpk}
            mayEdit={mayEdit}
          />
        ) : (
          <EmptyState
            title={term || wanted ? 'Tidak ada SPK yang cocok' : 'Belum ada SPK'}
            description={
              term || wanted
                ? 'Ubah kata kunci atau filter status.'
                : 'Buat SPK pertama untuk mulai memonitor pekerjaan.'
            }
            action={
              mayCreate && !term && !wanted ? (
                <Link href="/spk/new" className={linkButtonClass}>
                  <Plus size={16} aria-hidden />
                  Buat SPK Baru
                </Link>
              ) : undefined
            }
          />
        )}
      </Card>
    </>
  )
}
