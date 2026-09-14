import type { Metadata } from 'next'
import Link from 'next/link'
import { PageHeader, EmptyState } from '@/components/ui/page-header'
import { Card, CardContent } from '@/components/ui/card'
import { Alert } from '@/components/ui/alert'
import { requirePermission } from '@/lib/auth/session'
import { createClient } from '@/lib/supabase/server'
import { can } from '@/lib/auth/permissions'
import { cn } from '@/lib/utils'
import { DESIGN_STAGES } from '@/lib/supabase/types'
import { PHASE_STAGES, STAGE_FILTERS, phaseFromFilterKey } from '@/lib/design'
import { AddDesignButton } from './forms'
import { DesignTable } from './design-table'

/** The two design-team phases, kept visually separate — see STAGE_FILTERS. */
const PHASE_GROUPS = STAGE_FILTERS.slice(1)

export const metadata: Metadata = { title: 'Design Queue' }

/**
 * Section 21 — where every design sits and who is holding it. Files are out of
 * scope by decision: this queue tracks stage, PIC, and elapsed time only.
 *
 * A design belongs to exactly one phase (migration 0020) — Desain Siteplan
 * opens itself once field work's Pengolahan Data Topo hits 100%, Finalisasi
 * Desain opens itself once Desain Siteplan reaches Finish. A record with no
 * revisions yet is a Draft: it showed up on its own, waiting for someone to
 * mark it started.
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

  const wantedPhase = phaseFromFilterKey(stage)
  if (wantedPhase) query = query.eq('phase', wantedPhase)

  const [{ data: designs, error }, { data: allDesigns }, { data: spks }, { data: pics }] =
    await Promise.all([
      query,
      supabase.from('designs').select('id, phase, current_stage, spk_id').eq('status', 'Active'),
      supabase
        .from('spks')
        .select('id, spk_number, site_code, work_name')
        .in('status', ['Draft', 'On Going']),
      supabase.from('design_pics').select('id, full_name').order('full_name'),
    ])

  // Display needs every SPK a design record points at, not just the ones
  // still open for a *new* record (that narrower list is `spks`, below,
  // reused for openSpks) — a design for an SPK that's since gone Selesai
  // was falling out of this map entirely and rendering as a blank "SPK" row.
  const referencedSpkIds = [...new Set((allDesigns ?? []).map((d) => d.spk_id))]
  const { data: referencedSpks } = referencedSpkIds.length
    ? await supabase
        .from('spks')
        .select('id, spk_number, site_code, work_name')
        .in('id', referencedSpkIds)
    : { data: [] }

  const spkById = Object.fromEntries((referencedSpks ?? []).map((s) => [s.id, s]))
  const picName = Object.fromEntries((pics ?? []).map((p) => [p.id, p.full_name]))

  // The open (not-yet-completed) revision per design — a design has exactly
  // one of these once started, and none at all while it's still a Draft, so
  // presence here doubles as the Draft/started signal everywhere below.
  const allDesignIds = (allDesigns ?? []).map((d) => d.id)
  const { data: openEntries } = allDesignIds.length
    ? await supabase
        .from('design_revisions')
        .select('id, design_id, started_at, pic_pertamina')
        .in('design_id', allDesignIds)
        .eq('status', 'Active')
        .is('completed_at', null)
    : { data: [] }
  const { data: entryRounds } = (openEntries ?? []).length
    ? await supabase
        .from('design_stage_revisions')
        .select('design_revision_id')
        .in('design_revision_id', (openEntries ?? []).map((e) => e.id))
    : { data: [] }

  const roundsPerEntry: Record<string, number> = {}
  for (const round of entryRounds ?? []) {
    roundsPerEntry[round.design_revision_id] = (roundsPerEntry[round.design_revision_id] ?? 0) + 1
  }
  const currentByDesign = Object.fromEntries(
    (openEntries ?? []).map((entry) => [
      entry.design_id,
      {
        startedAt: entry.started_at,
        picPertamina: entry.pic_pertamina,
        rounds: roundsPerEntry[entry.id] ?? 0,
      },
    ]),
  )

  const perStage = new Map(DESIGN_STAGES.map((s) => [s, 0]))
  const draftPerPhase = { siteplan: 0, finalisasi: 0 }
  const takenSiteplan = new Set<string>()
  for (const design of allDesigns ?? []) {
    if (design.phase === 'siteplan') takenSiteplan.add(design.spk_id)
    if (currentByDesign[design.id]) {
      perStage.set(design.current_stage, (perStage.get(design.current_stage) ?? 0) + 1)
    } else {
      draftPerPhase[design.phase]++
    }
  }

  // Only SPK without a Desain Siteplan record (draft or started) can open one
  // manually — Finalisasi Desain is never opened by hand, only auto-opened.
  const openSpks = (spks ?? []).filter((s) => !takenSiteplan.has(s.id))

  return (
    <>
      <PageHeader
        title="Design Queue"
        actions={
          mayEdit && (
            <AddDesignButton
              spks={openSpks.map((s) => ({
                id: s.id,
                label: `${s.spk_number} — ${s.work_name}`,
              }))}
              pics={(pics ?? []).map((p) => ({ id: p.id, label: p.full_name }))}
            />
          )
        }
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
      {PHASE_GROUPS.map((filter) => {
        const phase = filter.phase!
        return (
          <div key={filter.key} className="mb-5">
            <h2 className="mb-2 text-xs font-extrabold tracking-wide text-slate-500 uppercase">
              {filter.label}
            </h2>
            <div className="grid gap-4 sm:grid-cols-3 lg:grid-cols-6">
              <Card className="border-dashed">
                <CardContent className="p-4">
                  <div className="truncate text-[11px] font-extrabold tracking-wider text-slate-500 uppercase">
                    Draft
                  </div>
                  <div className="tnum mt-1 text-2xl font-black text-slate-900">
                    {draftPerPhase[phase]}
                  </div>
                </CardContent>
              </Card>
              {PHASE_STAGES[phase].map((s) => (
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
        )
      })}

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
          <DesignTable
            designs={designs}
            spkById={spkById}
            picName={picName}
            currentByDesign={currentByDesign}
          />
        ) : (
          <EmptyState
            title={wantedPhase ? 'Tidak ada desain di fase ini' : 'Belum ada record desain'}
            description={
              wantedPhase
                ? 'Coba filter fase yang lain.'
                : 'Desain Siteplan membuka dirinya sendiri begitu Pengolahan Data Topo mencapai 100%.'
            }
          />
        )}
      </Card>
    </>
  )
}
