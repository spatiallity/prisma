import type { Metadata } from 'next'
import Link from 'next/link'
import { Plus } from 'lucide-react'
import { PageHeader, EmptyState } from '@/components/ui/page-header'
import { Card, CardContent } from '@/components/ui/card'
import { Table, Td, Th, Tr } from '@/components/ui/table'
import { Badge } from '@/components/ui/badge'
import { Alert } from '@/components/ui/alert'
import { linkButtonClass } from '@/components/ui/button'
import { requirePermission } from '@/lib/auth/session'
import { createClient } from '@/lib/supabase/server'
import { can } from '@/lib/auth/permissions'
import { formatDate, formatRupiah } from '@/lib/utils'
import {
  SPK_STATUS_TONE,
  daysLeft,
  formatArea,
  formatPercent,
  statusFromFilterKey,
} from '@/lib/spk'
import { SpkFilters } from './spk-filters'

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

  const supabase = await createClient()

  let query = supabase.from('spks').select('*').order('created_at', { ascending: false })

  const wanted = statusFromFilterKey(status)
  if (wanted) query = query.eq('status', wanted)

  const term = sanitize(q ?? '')
  if (term) {
    query = query.or(
      `spk_number.ilike.%${term}%,work_name.ilike.%${term}%,site_code.ilike.%${term}%,location.ilike.%${term}%`,
    )
  }

  const [{ data: spks, error }, { data: vendors }, { data: progress }] = await Promise.all([
    query,
    supabase.from('vendors').select('id, name'),
    supabase.from('v_spk_progress').select('spk_id, overall_progress'),
  ])

  const vendorName = new Map((vendors ?? []).map((v) => [v.id, v.name]))
  const progressBySpk = new Map(
    (progress ?? []).map((p) => [p.spk_id, p.overall_progress]),
  )

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
          <Table>
            <thead>
              <tr>
                <Th>SPK</Th>
                <Th>Pekerjaan</Th>
                <Th>Lokasi</Th>
                <Th className="text-right">Luas</Th>
                <Th className="text-right">Nilai kontrak</Th>
                <Th>Vendor</Th>
                <Th>Periode</Th>
                <Th className="text-right">Progress</Th>
                <Th>Status</Th>
              </tr>
            </thead>
            <tbody>
              {spks.map((spk) => {
                const remaining = daysLeft(spk.end_date)
                const overdue =
                  remaining !== null && remaining < 0 && spk.status === 'On Going'

                return (
                  <Tr key={spk.id}>
                    <Td>
                      <Link
                        href={`/spk/${spk.id}`}
                        className="font-bold text-primary hover:underline"
                      >
                        {spk.spk_number}
                      </Link>
                      {spk.site_code && (
                        <div className="text-xs font-semibold text-slate-500">
                          {spk.site_code}
                        </div>
                      )}
                    </Td>
                    <Td className="max-w-xs">
                      <span className="line-clamp-2 font-bold text-slate-900">
                        {spk.work_name}
                      </span>
                      {spk.work_type && (
                        <div className="text-xs text-muted-foreground">
                          {spk.work_type}
                        </div>
                      )}
                    </Td>
                    <Td className="text-muted-foreground">
                      {spk.location ?? '—'}
                      {spk.kabupaten && (
                        <div className="text-xs">{spk.kabupaten}</div>
                      )}
                    </Td>
                    <Td className="tnum text-right">{formatArea(spk.area_ha)}</Td>
                    <Td className="tnum text-right">
                      {formatRupiah(spk.contract_value)}
                    </Td>
                    <Td className="text-muted-foreground">
                      {spk.vendor_id ? (vendorName.get(spk.vendor_id) ?? '—') : '—'}
                    </Td>
                    <Td className="tnum whitespace-nowrap text-muted-foreground">
                      {formatDate(spk.start_date)} – {formatDate(spk.end_date)}
                      {overdue && (
                        <div className="text-xs font-bold text-danger">
                          Lewat {Math.abs(remaining)} hari
                        </div>
                      )}
                    </Td>
                    <Td className="tnum text-right font-bold">
                      {formatPercent(progressBySpk.get(spk.id) ?? 0)}
                    </Td>
                    <Td>
                      <Badge tone={SPK_STATUS_TONE[spk.status]}>{spk.status}</Badge>
                    </Td>
                  </Tr>
                )
              })}
            </tbody>
          </Table>
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
