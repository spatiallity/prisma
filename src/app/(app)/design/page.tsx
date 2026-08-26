import type { Metadata } from 'next'
import Link from 'next/link'
import { PageHeader, EmptyState } from '@/components/ui/page-header'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Table, Td, Th, Tr } from '@/components/ui/table'
import { Badge } from '@/components/ui/badge'
import { Alert } from '@/components/ui/alert'
import { requirePermission } from '@/lib/auth/session'
import { createClient } from '@/lib/supabase/server'
import { can } from '@/lib/auth/permissions'
import { cn, formatDate } from '@/lib/utils'
import { DESIGN_STAGES } from '@/lib/supabase/types'
import { STAGE_FILTERS, STAGE_TONE, daysInStage, stagesFromFilterKey } from '@/lib/design'
import { NewDesignForm } from './forms'

export const metadata: Metadata = { title: 'Design Queue' }

/**
 * Section 21 — where every design sits and who is holding it. Files are out of
 * scope by decision: this queue tracks stage, PIC, and elapsed time only.
 */
export default async function DesignQueuePage({
  searchParams,
}: {
  searchParams: Promise<{ stage?: string }>
}) {
  const user = await requirePermission('design', 'view')
  const { stage } = await searchParams
  const mayEdit = can(user.permissions, 'design', 'edit')

  const supabase = await createClient()

  let query = supabase
    .from('designs')
    .select('*')
    .eq('status', 'Active')
    .order('updated_at', { ascending: true })

  const wanted = stagesFromFilterKey(stage)
  if (wanted) query = query.in('current_stage', wanted)

  const [{ data: designs, error }, { data: allDesigns }, { data: spks }, { data: pics }] =
    await Promise.all([
      query,
      supabase.from('designs').select('current_stage, spk_id').eq('status', 'Active'),
      supabase
        .from('spks')
        .select('id, spk_number, site_code, work_name')
        .in('status', ['Draft', 'On Going']),
      supabase.from('users').select('id, full_name').eq('status', 'Active').order('full_name'),
    ])

  const spkById = new Map((spks ?? []).map((s) => [s.id, s]))
  const picName = new Map((pics ?? []).map((p) => [p.id, p.full_name]))

  const perStage = new Map(DESIGN_STAGES.map((s) => [s, 0]))
  const taken = new Set<string>()
  for (const design of allDesigns ?? []) {
    perStage.set(design.current_stage, (perStage.get(design.current_stage) ?? 0) + 1)
    taken.add(design.spk_id)
  }

  // Only SPK without an active design record can start one.
  const openSpks = (spks ?? []).filter((s) => !taken.has(s.id))

  return (
    <>
      <PageHeader
        title="Design Queue"
        description="Desain Awal → Review → Pemaparan → Revisi → Finalisasi → Approved. Tanpa penyimpanan file — hanya tahap, PIC, tanggal, dan catatan."
      />

      {error && (
        <Alert tone="danger" className="mb-4" title="Gagal memuat data">
          {error.message}
        </Alert>
      )}

      <div className="mb-5 grid gap-4 sm:grid-cols-3 lg:grid-cols-6">
        {DESIGN_STAGES.map((s) => (
          <Card key={s}>
            <CardContent className="p-4">
              <div className="truncate text-[11px] font-extrabold tracking-wider text-slate-500 uppercase">
                {s}
              </div>
              <div className="tnum mt-1 text-2xl font-black text-slate-900">
                {perStage.get(s) ?? 0}
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      <div className="mb-5 flex flex-wrap gap-1 rounded-xl bg-slate-100 p-1">
        {STAGE_FILTERS.map((filter) => {
          const active = (stage ?? 'all') === filter.key
          const href = filter.key === 'all' ? '/design' : `/design?stage=${filter.key}`
          return (
            <Link
              key={filter.key}
              href={href}
              className={cn(
                'rounded-lg px-3.5 py-1.5 text-xs font-extrabold transition-shadow',
                active
                  ? 'bg-primary text-white shadow-md shadow-primary/20'
                  : 'text-slate-500 hover:text-slate-800',
              )}
            >
              {filter.label}
            </Link>
          )
        })}
      </div>

      <Card className="overflow-hidden">
        {designs && designs.length > 0 ? (
          <Table>
            <thead>
              <tr>
                <Th>SPK</Th>
                <Th>Judul</Th>
                <Th>Tahap</Th>
                <Th>PIC</Th>
                <Th className="text-right">Di tahap ini</Th>
                <Th>Target</Th>
              </tr>
            </thead>
            <tbody>
              {designs.map((design) => {
                const spk = spkById.get(design.spk_id)
                const held = daysInStage(design.updated_at)
                const late = held !== null && held > 7 && design.current_stage !== 'Approved'

                return (
                  <Tr key={design.id}>
                    <Td>
                      <Link
                        href={`/design/${design.id}`}
                        className="font-bold text-primary hover:underline"
                      >
                        {spk?.site_code ?? spk?.spk_number ?? 'SPK'}
                      </Link>
                    </Td>
                    <Td className="max-w-xs">
                      <span className="line-clamp-1 font-bold text-slate-900">
                        {design.title ?? spk?.work_name ?? '—'}
                      </span>
                    </Td>
                    <Td>
                      <Badge tone={STAGE_TONE[design.current_stage]}>
                        {design.current_stage}
                      </Badge>
                    </Td>
                    <Td className="text-muted-foreground">
                      {design.pic_id ? (picName.get(design.pic_id) ?? '—') : '—'}
                    </Td>
                    <Td
                      className={cn(
                        'tnum text-right',
                        late && 'font-bold text-danger',
                      )}
                    >
                      {held === null ? '—' : `${held} hari`}
                    </Td>
                    <Td className="tnum text-muted-foreground">
                      {formatDate(design.target_date)}
                    </Td>
                  </Tr>
                )
              })}
            </tbody>
          </Table>
        ) : (
          <EmptyState
            title={wanted ? 'Tidak ada desain di tahap ini' : 'Belum ada record desain'}
            description={
              wanted
                ? 'Coba filter tahap yang lain.'
                : 'Buka record desain untuk SPK yang membutuhkan siteplan.'
            }
          />
        )}
      </Card>

      {mayEdit && (
        <Card className="mt-5">
          <CardHeader>
            <div>
              <CardTitle>Buka record desain</CardTitle>
              <CardDescription>
                Satu SPK punya satu record desain aktif; putaran revisi dicatat di
                dalamnya.
              </CardDescription>
            </div>
          </CardHeader>
          <CardContent>
            <NewDesignForm
              spks={openSpks.map((s) => ({
                id: s.id,
                label: `${s.spk_number} — ${s.work_name}`,
              }))}
              pics={(pics ?? []).map((p) => ({ id: p.id, label: p.full_name }))}
            />
          </CardContent>
        </Card>
      )}
    </>
  )
}
