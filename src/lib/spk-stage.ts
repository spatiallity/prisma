import type { createClient } from '@/lib/supabase/server'
import type { DesignStage } from '@/lib/supabase/types'
import { PHASE_LABEL, stageDisplayLabel } from '@/lib/design'
import { isTerrestrialSurveyOnly } from '@/lib/spk'

export type SpkStage = { label: string; date: string | null }

/**
 * Where an SPK actually sits right now — the furthest stage it has reached:
 * Invoice, Routing, PAD/Opname, Design, Pengecekan Bersama, Survei Terestris.
 * Each stage's date is whatever real timestamp marks entering it; per-step
 * routing/design dates were cleared as fictional (imported data, not
 * observed), so those read as "—" until a real review happens through the
 * app from here on.
 */
export async function loadStageBySpk(
  supabase: Awaited<ReturnType<typeof createClient>>,
  spks: {
    id: string
    opname_marked_at: string | null
    pad_marked_at: string | null
    start_date: string | null
    terrain_survey_completed_at: string | null
    joint_check_date: string | null
    joint_check_completed_at?: string | null
    work_name?: string | null
    work_type?: string | null
    location_type?: string | null
  }[],
): Promise<Record<string, SpkStage>> {
  const spkIds = spks.map((s) => s.id)
  if (spkIds.length === 0) return {}

  const [{ data: invoices }, { data: designs }, { data: routingDocs }, { data: lead }] =
    await Promise.all([
      supabase
        .from('invoices')
        .select('spk_id, invoice_date, status')
        .in('spk_id', spkIds)
        .neq('status', 'Cancelled')
        .order('invoice_date', { ascending: false, nullsFirst: false }),
      supabase
        .from('designs')
        .select('id, spk_id, phase, current_stage, approved_at')
        .in('spk_id', spkIds)
        .eq('status', 'Active'),
      supabase.from('spk_routing').select('*').in('spk_id', spkIds),
      supabase.from('v_routing_lead_time').select('*'),
    ])

  const latestInvoiceBySpk = new Map<string, string | null>()
  for (const inv of invoices ?? []) {
    if (inv.status === 'Approved' && !latestInvoiceBySpk.has(inv.spk_id)) {
      latestInvoiceBySpk.set(inv.spk_id, inv.invoice_date)
    }
  }

  const designIds = (designs ?? []).map((d) => d.id)
  const { data: startedDesignRevisions } = designIds.length
    ? await supabase.from('design_revisions').select('design_id').eq('status', 'Active').in('design_id', designIds)
    : { data: [] }
  const startedDesignIds = new Set((startedDesignRevisions ?? []).map((r) => r.design_id))

  const designBySpk = new Map<
    string,
    { id: string; phase: 'siteplan' | 'finalisasi'; current_stage: DesignStage; approved_at: string | null }
  >()
  for (const d of designs ?? []) {
    const existing = designBySpk.get(d.spk_id)
    // Prefer finalisasi over siteplan — it only exists once siteplan is done.
    if (!existing || d.phase === 'finalisasi') designBySpk.set(d.spk_id, d)
  }

  const currentByRouting = new Map<string, { step_name: string; started_at: string | null; sequence: number }>()
  for (const row of lead ?? []) {
    if (row.status === 'Completed') continue
    const held = currentByRouting.get(row.spk_routing_id)
    if (!held || row.sequence < held.sequence) currentByRouting.set(row.spk_routing_id, row)
  }
  const routingBySpk = new Map((routingDocs ?? []).map((doc) => [doc.spk_id, doc]))

  const stageBySpk: Record<string, SpkStage> = {}
  for (const spk of spks) {
    const invoiceDate = latestInvoiceBySpk.get(spk.id)
    if (latestInvoiceBySpk.has(spk.id)) {
      stageBySpk[spk.id] = { label: 'Invoice terbit', date: invoiceDate ?? null }
      continue
    }

    const design = designBySpk.get(spk.id)
    const routingDoc = routingBySpk.get(spk.id)
    const terrestrialOnly = isTerrestrialSurveyOnly(spk.work_type)

    // A terrestrial-only assignment has no Design Siteplan branch. Its field
    // milestones remain the source of truth even if its invoice document was
    // prepared early, so the current stage cannot skip Opname or PAD.
    if (terrestrialOnly) {
      if (!spk.terrain_survey_completed_at) {
        stageBySpk[spk.id] = { label: 'Survei Terestris: Sedang Berjalan', date: spk.start_date }
        continue
      }
      const jointCheckCompletedAt = spk.joint_check_completed_at ?? spk.joint_check_date
      if (!jointCheckCompletedAt) {
        stageBySpk[spk.id] = { label: 'Pengecekan Bersama', date: spk.terrain_survey_completed_at }
        continue
      }
      if (!spk.opname_marked_at) {
        stageBySpk[spk.id] = { label: 'Opname', date: spk.joint_check_date ?? jointCheckCompletedAt }
        continue
      }
      if (!spk.pad_marked_at) {
        stageBySpk[spk.id] = { label: 'PAD', date: spk.opname_marked_at }
        continue
      }
    }

    if (routingDoc) {
      if (routingDoc.status === 'Completed') {
        stageBySpk[spk.id] = { label: 'Routing selesai', date: routingDoc.completed_at }
      } else {
        const current = currentByRouting.get(routingDoc.id)
        stageBySpk[spk.id] = {
          label: current ? `Routing: ${current.step_name === 'Invoiced' ? 'Proses Invoice' : current.step_name}` : 'Routing',
          date: current?.started_at ?? routingDoc.started_at,
        }
      }
      continue
    }

    if (terrestrialOnly) {
      stageBySpk[spk.id] = { label: 'Menunggu Proses Invoice', date: spk.pad_marked_at }
      continue
    }

    if (spk.pad_marked_at) {
      stageBySpk[spk.id] = { label: 'Sudah PAD', date: spk.pad_marked_at }
      continue
    }
    if (spk.opname_marked_at) {
      stageBySpk[spk.id] = { label: 'Sudah Opname', date: spk.opname_marked_at }
      continue
    }

    if (design) {
      const started = startedDesignIds.has(design.id)
      stageBySpk[spk.id] = started
        ? { label: `Desain: ${stageDisplayLabel(design.current_stage)}`, date: null }
        : { label: `${PHASE_LABEL[design.phase]}: menunggu mulai`, date: null }
      continue
    }

    if (spk.joint_check_completed_at ?? spk.joint_check_date) {
      stageBySpk[spk.id] = { label: 'Pengecekan Bersama', date: spk.joint_check_date ?? spk.joint_check_completed_at ?? null }
      continue
    }
    if (spk.terrain_survey_completed_at) {
      stageBySpk[spk.id] = { label: 'Menunggu Pengecekan Bersama', date: spk.terrain_survey_completed_at }
      continue
    }

    stageBySpk[spk.id] = { label: 'Survei Terestris: Sedang Berjalan', date: null }
  }

  return stageBySpk
}
