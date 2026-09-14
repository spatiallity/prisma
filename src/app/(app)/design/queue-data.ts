import { createClient } from '@/lib/supabase/server'
import type { DesignPhase } from '@/lib/supabase/types'

/** Shared data loading for the Desain Siteplan and Finalisasi Desain list
 *  pages — same shape, only the phase filter differs. */
export async function loadDesignQueue(
  supabase: Awaited<ReturnType<typeof createClient>>,
  phase: DesignPhase,
) {
  const [{ data: designs, error }, { data: allDesigns }, { data: spks }, { data: pics }] =
    await Promise.all([
      supabase.from('designs').select('*').eq('status', 'Active').eq('phase', phase).order('updated_at', { ascending: true }),
      supabase.from('designs').select('id, phase, spk_id').eq('status', 'Active'),
      supabase
        .from('spks')
        .select('id, spk_number, site_code, work_name')
        .in('status', ['Draft', 'On Going']),
      supabase.from('design_pics').select('id, full_name').order('full_name'),
    ])

  const referencedSpkIds = [...new Set((designs ?? []).map((d) => d.spk_id))]
  const { data: referencedSpks } = referencedSpkIds.length
    ? await supabase
        .from('spks')
        .select('id, spk_number, site_code, work_name')
        .in('id', referencedSpkIds)
    : { data: [] }

  const spkById = Object.fromEntries((referencedSpks ?? []).map((s) => [s.id, s]))
  const picName = Object.fromEntries((pics ?? []).map((p) => [p.id, p.full_name]))

  const allDesignIds = (designs ?? []).map((d) => d.id)
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

  // Only SPK without a Desain Siteplan record (draft or started) can open one
  // manually — Finalisasi Desain is never opened by hand, only auto-opened.
  const takenSiteplan = new Set(
    (allDesigns ?? []).filter((d) => d.phase === 'siteplan').map((d) => d.spk_id),
  )
  const openSpks = phase === 'siteplan' ? (spks ?? []).filter((s) => !takenSiteplan.has(s.id)) : []

  // Finalisasi Desain shows when its sibling Desain Siteplan was approved —
  // fetched once here rather than per-row in the table component.
  let siteplanApprovedBySpk: Record<string, string | null> = {}
  if (phase === 'finalisasi' && referencedSpkIds.length) {
    const { data: siteplanRows } = await supabase
      .from('designs')
      .select('spk_id, approved_at')
      .eq('phase', 'siteplan')
      .in('spk_id', referencedSpkIds)
    siteplanApprovedBySpk = Object.fromEntries(
      (siteplanRows ?? []).map((r) => [r.spk_id, r.approved_at]),
    )
  }

  return {
    designs: designs ?? [],
    error,
    spkById,
    picName,
    currentByDesign,
    openSpks,
    pics: pics ?? [],
    siteplanApprovedBySpk,
  }
}
