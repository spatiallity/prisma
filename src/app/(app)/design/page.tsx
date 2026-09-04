import type { Metadata } from 'next'
import Link from 'next/link'
import { PageHeader, EmptyState } from '@/components/ui/page-header'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Alert } from '@/components/ui/alert'
import { requirePermission } from '@/lib/auth/session'
import { createClient } from '@/lib/supabase/server'
import { can } from '@/lib/auth/permissions'
import { cn } from '@/lib/utils'
import { DESIGN_STAGES } from '@/lib/supabase/types'
import { STAGE_FILTERS, stagesFromFilterKey } from '@/lib/design'

/** The two design-team phases, kept visually separate — see STAGE_FILTERS. */
const PHASE_GROUPS = STAGE_FILTERS.slice(1)
import { NewDesignForm } from './forms'
import { DesignTable } from './design-table'

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
      supabase.from('design_pics').select('id, full_name').order('full_name'),
    ])

  const spkById = Object.fromEntries((spks ?? []).map((s) => [s.id, s]))
  const picName = Object.fromEntries((pics ?? []).map((p) => [p.id, p.full_name]))

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
        description="Desain Siteplan (Pembuatan Desain Awal → Review → Revisi → Peta Inventaris/Stake Out → Finish), lalu Finalisasi Desain (Pembuatan → Review internal → Sinkronisasi → Submit Peta). Tanpa penyimpanan file — hanya tahap, PIC, tanggal, dan catatan."
      />

      {error && (
        <Alert tone="danger" className="mb-4" title="Gagal memuat data">
          {error.message}
        </Alert>
      )}

      {/* Two separate groups, not one flat 9-card row — Desain Siteplan and
          Finalisasi Desain are different phases with different owners
          within the design team, so their counts stay next to each other's
          own phase, never blended into one row. */}
      {PHASE_GROUPS.map((phase) => (
        <div key={phase.key} className="mb-5">
          <h2 className="mb-2 text-xs font-extrabold tracking-wide text-slate-500 uppercase">
            {phase.label}
          </h2>
          <div className="grid gap-4 sm:grid-cols-3 lg:grid-cols-5">
            {(phase.stages ?? []).map((s) => (
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
        </div>
      ))}

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
          <DesignTable designs={designs} spkById={spkById} picName={picName} />
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
