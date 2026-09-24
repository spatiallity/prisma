'use server'

import { revalidatePath } from 'next/cache'
import { createClient } from '@/lib/supabase/server'
import { requirePermission } from '@/lib/auth/session'
import type { DesignStage, StageStatus } from '@/lib/supabase/types'
import { DESIGN_NEXT_STAGES, PHASE_STAGES, PHASE_TERMINAL_STAGE } from '@/lib/design'

export type DesignState = { error: string | null; success?: string }

type Supabase = Awaited<ReturnType<typeof createClient>>

function text(formData: FormData, key: string) {
  const value = formData.get(key)
  return typeof value === 'string' ? value.trim() : ''
}

function nullable(formData: FormData, key: string) {
  return text(formData, key) || null
}

/** A picked date (YYYY-MM-DD) becomes noon that day — avoids the previous
 *  day showing up in a timezone west of UTC. An empty date stays empty. */
function pickedOrNull(formData: FormData, key: string) {
  const raw = text(formData, key)
  return raw ? new Date(`${raw}T12:00:00`).toISOString() : null
}

function today(formData: FormData, key: string) {
  return text(formData, key) || new Date().toISOString().slice(0, 10)
}

function todayMulti(formData: FormData, keys: string[]) {
  for (const key of keys) {
    const raw = text(formData, key)
    if (raw) return raw
  }
  return new Date().toISOString().slice(0, 10)
}

function mayLeaveStartDateBlank(user: { role: { code: string } }) {
  return user.role.code === 'super_admin'
}

function missingStartDate(user: { role: { code: string } }, value: string | null, label = 'Tanggal mulai') {
  return !mayLeaveStartDateBlank(user) && !value ? `${label} wajib diisi.` : null
}

/**
 * PIC is a free-typed name (see the datalist in forms.tsx), not a fixed
 * dropdown — a name that doesn't exist yet in design_pics is created on the
 * spot, matched case-insensitively against what's already there.
 */
async function resolvePicId(supabase: Supabase, name: string, userId: string) {
  if (!name) return null

  const { data: existing } = await supabase
    .from('design_pics')
    .select('id')
    .ilike('full_name', name)
    .maybeSingle()

  if (existing) return existing.id

  const { data: created, error } = await supabase
    .from('design_pics')
    .insert({ full_name: name, created_by: userId })
    .select('id')
    .single()

  // A concurrent insert of the same name loses the unique-index race; look
  // it up instead of failing the whole design action over it.
  if (error) {
    const { data: retry } = await supabase
      .from('design_pics')
      .select('id')
      .ilike('full_name', name)
      .maybeSingle()
    return retry?.id ?? null
  }

  return created.id
}

/**
 * Section 21 — the design module's own stage tracking (design_revisions) and
 * the SPK's own weighted Progress tab (spk_activities) used to be two
 * disconnected systems. This writes an activity_progress row for whichever
 * spk_activities item shares the stage's exact name, so a design move here
 * also moves the SPK's overall progress % — the same path recordProgress()
 * uses on the Progress tab (see progress-actions.ts). Silently does nothing
 * when no matching item exists: SPKs created before the two-phase
 * restructure carry one legacy "Desain Siteplan" row instead of these 9
 * per-stage names, and "Finish" itself carries no weight so has no row at
 * all — both are expected, not errors.
 */
async function syncSpkActivityStage(
  supabase: Supabase,
  spkId: string,
  stageName: string,
  stageStatus: StageStatus,
  progressDate: string,
  userId: string,
) {
  const { data: activity } = await supabase
    .from('spk_activities')
    .select('id')
    .eq('spk_id', spkId)
    .eq('name', stageName)
    .eq('measurement', 'stage')
    .maybeSingle()

  if (!activity) return

  await supabase.from('activity_progress').insert({
    spk_activity_id: activity.id,
    progress_date: progressDate,
    stage: stageStatus,
    source: 'manual',
    recorded_by: userId,
  })
}

/**
 * Section 27 — completing Opname keeps spks.opname_marked_at in sync so the
 * Financial tab and Routing Monitor's Opname column read the same event as
 * their source. Routing is opened by finalisasi approval, while Opname stays
 * independently editable during the routing workflow.
 */
async function markOpnameFromDesign(
  supabase: Supabase,
  spkId: string,
  opnameDate: string,
  userId: string,
  opnameValue: number | null,
) {
  await supabase
    .from('spks')
    .update({
      opname_marked_at: opnameDate,
      opname_marked_by: userId,
      ...(opnameValue != null ? { opname_value: opnameValue } : {}),
    })
    .eq('id', spkId)
    .is('opname_marked_at', null)
}

/** Finalisasi yang sudah Acc PIC Pertamina langsung membuka dokumen invoice.
 * Opname dan PAD sengaja tidak menjadi syarat di sini karena keduanya dicatat
 * pada panel Routing Monitor saat proses administrasi berjalan. */
async function openRoutingFromFinalisasi(
  supabase: Supabase,
  spkId: string,
  userId: string,
  startedAt: string | null,
) {
  const { data: existing } = await supabase
    .from('spk_routing')
    .select('id')
    .eq('spk_id', spkId)
    .maybeSingle()
  if (existing) return false

  const { data: template } = await supabase
    .from('routing_templates')
    .select('id')
    .eq('status', 'Active')
    .order('code')
    .limit(1)
    .maybeSingle()
  if (!template) return false

  const { data: steps } = await supabase
    .from('routing_template_steps')
    .select('id, name, sequence, sla_days, default_pic_role')
    .eq('template_id', template.id)
    .order('sequence')
  if (!steps?.length) return false

  const { data: routing, error } = await supabase
    .from('spk_routing')
    .insert({
      spk_id: spkId,
      template_id: template.id,
      document_type: 'Invoice',
      notes: 'Dibuat otomatis setelah finalisasi desain.',
      created_by: userId,
    })
    .select('id')
    .single()
  if (error || !routing) return false

  const { error: historyError } = await supabase.from('routing_history').insert(
    steps.map((step, index) => ({
      spk_routing_id: routing.id,
      template_step_id: step.id,
      step_name: step.name,
      sequence: step.sequence,
      sla_days: step.sla_days,
      pic_name: step.default_pic_role,
      status: index === 0 ? 'In Progress' : 'Pending',
      started_at: index === 0 ? startedAt : null,
      created_by: userId,
    })),
  )
  return !historyError
}

/**
 * Section 21 — opens the Desain Siteplan record for an SPK by hand, for the
 * rare case the auto-open trigger (Pengolahan Data Topo hitting 100%) hasn't
 * fired yet or doesn't apply. Finalisasi Desain is never opened this way —
 * it only ever opens itself once Desain Siteplan reaches Finish.
 * `designs.current_stage` is maintained by the trigger in migration 0006/
 * 0020, so the stage is only ever written through design_revisions.
 */
export async function createDesign(
  _prev: DesignState,
  formData: FormData,
): Promise<DesignState> {
  const user = await requirePermission('design', 'edit')

  const spkId = text(formData, 'spk_id')
  if (!spkId) return { error: 'SPK wajib dipilih.' }

  const supabase = await createClient()
  const { data: spk } = await supabase
    .from('spks')
    .select('work_type')
    .eq('id', spkId)
    .maybeSingle()

  if (!spk) return { error: 'SPK tidak ditemukan.' }
  if (spk.work_type === 'Hanya Survei Terestris') {
    return { error: 'SPK Hanya Survei Terestris tidak memiliki proses desain.' }
  }

  const startedAt = pickedOrNull(formData, 'tanggal')
  const startError = missingStartDate(user, startedAt)
  if (startError) return { error: startError }

  const picId = await resolvePicId(supabase, text(formData, 'pic_name'), user.id)

  const { data: existing } = await supabase
    .from('designs')
    .select('id')
    .eq('spk_id', spkId)
    .eq('phase', 'siteplan')
    .eq('status', 'Active')
    .maybeSingle()

  if (existing) {
    return { error: 'SPK ini sudah punya record Desain Siteplan.' }
  }

  const { data: design, error } = await supabase
    .from('designs')
    .insert({
      spk_id: spkId,
      phase: 'siteplan',
      pic_id: picId,
      topo_data_received_at: nullable(formData, 'topo_data_received_at'),
      notes: nullable(formData, 'notes'),
      created_by: user.id,
    })
    .select('id')
    .single()

  if (error) return { error: error.message }

  const { error: revisionError } = await supabase.from('design_revisions').insert({
    design_id: design.id,
    revision_no: 0,
    stage: 'Pembuatan Desain Awal',
    pic_id: picId,
    pic_pertamina: nullable(formData, 'pic_pertamina'),
    started_at: startedAt,
    created_by: user.id,
  })

  if (revisionError) return { error: revisionError.message }

  await syncSpkActivityStage(
    supabase,
    spkId,
    'Pembuatan Desain Awal',
    'Dalam Pengerjaan',
    today(formData, 'tanggal'),
    user.id,
  )

  revalidatePath('/design')
  revalidatePath('/design/siteplan')
  revalidatePath(`/spk/${spkId}`)
  return { error: null, success: 'Record desain dibuka.' }
}

/**
 * Section 21 — an auto-opened Draft (no design_revisions yet) needs a human
 * to actually mark it started, at whichever stage it opened at — this never
 * offers a stage picker like advanceStage does, since a Draft only has one
 * legitimate starting point (its phase's first stage).
 */
export async function startDesign(
  _prev: DesignState,
  formData: FormData,
): Promise<DesignState> {
  const user = await requirePermission('design', 'edit')

  const designId = text(formData, 'design_id')
  if (!designId) return { error: 'Desain tidak ditemukan.' }

  const supabase = await createClient()
  const { data: design } = await supabase
    .from('designs')
    .select('id, spk_id, current_stage')
    .eq('id', designId)
    .maybeSingle()
  if (!design) return { error: 'Desain tidak ditemukan.' }

  const { count } = await supabase
    .from('design_revisions')
    .select('id', { count: 'exact', head: true })
    .eq('design_id', designId)
  if ((count ?? 0) > 0) return { error: 'Desain ini sudah dimulai.' }

  const picId = await resolvePicId(supabase, text(formData, 'pic_name'), user.id)
  const startedAt = pickedOrNull(formData, 'tanggal')
  const startError = missingStartDate(user, startedAt)
  if (startError) return { error: startError }

  const { error } = await supabase.from('design_revisions').insert({
    design_id: designId,
    revision_no: 0,
    stage: design.current_stage,
    pic_id: picId,
    pic_pertamina: nullable(formData, 'pic_pertamina'),
    started_at: startedAt,
    created_by: user.id,
  })
  if (error) return { error: error.message }

  const topoDataReceivedAt = nullable(formData, 'topo_data_received_at')
  if (picId || topoDataReceivedAt) {
    await supabase
      .from('designs')
      .update({
        ...(picId ? { pic_id: picId } : {}),
        ...(topoDataReceivedAt ? { topo_data_received_at: topoDataReceivedAt } : {}),
      })
      .eq('id', designId)
  }

  await syncSpkActivityStage(
    supabase,
    design.spk_id,
    design.current_stage,
    'Dalam Pengerjaan',
    today(formData, 'tanggal'),
    user.id,
  )

  revalidatePath('/design')
  revalidatePath(`/design/${designId}`)
  revalidatePath(`/spk/${design.spk_id}`)
  return { error: null, success: 'Desain dimulai.' }
}

/**
 * Moves the design to its next stage. Each move closes the current revision
 * and opens a new one, which is what makes the Section 24-style lead time per
 * stage measurable at all. Desain Siteplan and Finalisasi Desain are tracked
 * as separate spk_activities rows (see syncSpkActivityStage), so this never
 * blends the two phases' progress into one number — each phase's own
 * weighted items in the SPK Progress tab move independently.
 */
export async function advanceStage(
  _prev: DesignState,
  formData: FormData,
): Promise<DesignState> {
  const user = await requirePermission('design', 'edit')

  const designId = text(formData, 'design_id')
  const entryId = text(formData, 'entry_id')
  const stage = text(formData, 'stage') as DesignStage
  if (!designId || !stage) return { error: 'Tahap tujuan wajib dipilih.' }

  const supabase = await createClient()

  const { data: designRow } = await supabase
    .from('designs')
    .select('spk_id, phase, current_stage')
    .eq('id', designId)
    .maybeSingle()
  if (!designRow) return { error: 'Desain tidak ditemukan.' }

  if (!PHASE_STAGES[designRow.phase].includes(stage)) {
    return { error: `${stage} bukan tahap fase ${designRow.phase === 'siteplan' ? 'Desain Siteplan' : 'Finalisasi Desain'}.` }
  }

  const { data: revisions, error: readError } = await supabase
    .from('design_revisions')
    .select('id, revision_no, stage, started_at, completed_at, pic_id, pic_pertamina')
    .eq('design_id', designId)
    .eq('status', 'Active')
    .order('revision_no', { ascending: false })
    .order('created_at', { ascending: false })

  if (readError) return { error: readError.message }

  const current = entryId
    ? revisions?.find((revision) => revision.id === entryId)
    : revisions?.[0]
  if (entryId && !current) return { error: 'Tahap aktif tidak ditemukan.' }
  if (current && (current.id !== revisions?.[0]?.id || current.stage !== designRow.current_stage)) {
    return { error: 'Tahap sudah berubah. Muat ulang data desain sebelum melanjutkan.' }
  }
  if (current?.stage === stage) {
    return { error: `Desain sudah berada di tahap ${stage}.` }
  }
  const currentStageIndex = current ? PHASE_STAGES[designRow.phase].indexOf(current.stage) : -1
  const allowedPreviousStages =
    currentStageIndex > 0 ? PHASE_STAGES[designRow.phase].slice(0, currentStageIndex) : []
  if (
    current &&
    !DESIGN_NEXT_STAGES[current.stage].includes(stage) &&
    !allowedPreviousStages.includes(stage)
  ) {
    return { error: 'Pilih tahap berikutnya atau kembalikan ke tahap sebelumnya dalam fase yang sama.' }
  }

  // The selected handoff date is both the finish of this stage and the start
  // of the stage being opened, so a workflow has no gaps between stages.
  const transitionAt = pickedOrNull(formData, 'next_started_at')
  const submittedStartAt = pickedOrNull(formData, 'tanggal')
  const currentStartAt = submittedStartAt ?? current?.started_at ?? null
  const currentStartError = missingStartDate(user, currentStartAt)
  if (currentStartError) return { error: currentStartError }
  const nextStartError = missingStartDate(user, transitionAt, 'Tanggal mulai tahap berikutnya')
  if (nextStartError) return { error: nextStartError }
  if (transitionAt && currentStartAt && new Date(transitionAt) < new Date(currentStartAt)) {
    return { error: 'Tanggal selesai tidak boleh sebelum tanggal mulai.' }
  }
  const previous = revisions?.[1]
  if (currentStartAt && previous?.started_at && currentStartAt < previous.started_at) {
    return { error: 'Tanggal mulai tidak boleh sebelum tanggal mulai tahap sebelumnya.' }
  }
  // Drafter is per-stage-entry, not carried forward — a blank field means no
  // drafter recorded for this entry, not "same as before".
  const typedPicName = text(formData, 'pic_name')
  const picId = typedPicName ? await resolvePicId(supabase, typedPicName, user.id) : null

  // Stepping back to an earlier stage doesn't mean the one we're leaving
  // was finished — it means the opposite (that's why we're going back). Only
  // a forward move actually completes the current entry; the accordion
  // reads completed_at to show "Selesai", so leaving it null here is what
  // makes the departed stage read as not-done again.
  const isReturningToPreviousStage = allowedPreviousStages.includes(stage)
  if (previous && submittedStartAt && submittedStartAt !== current?.started_at) {
    const { error } = await supabase.from('design_revisions')
      .update({ completed_at: submittedStartAt }).eq('id', previous.id)
    if (error) return { error: error.message }
  }
  if (current && !current.completed_at && !isReturningToPreviousStage) {
    const { error } = await supabase
      .from('design_revisions')
      .update({
        completed_at: transitionAt,
        ...(submittedStartAt ? { started_at: submittedStartAt } : {}),
      })
      .eq('id', current.id)
    if (error) return { error: error.message }
  }

  // Returning to Revisi Desain Awal starts a new numbered round; everything
  // else continues the current one, so revision_no counts actual rework, not
  // stage hops.
  const nextRevisionNo =
    stage === 'Revisi Desain Awal' ? (current?.revision_no ?? 0) + 1 : (current?.revision_no ?? 0)

  // Moving to a stage the design has already been through this round (e.g.
  // stepping back to fix something, then forward again) would otherwise hit
  // the (design_id, stage, revision_no) unique constraint — reopen that same
  // row instead of trying to insert a duplicate of it.
  const { data: existing } = await supabase
    .from('design_revisions')
    .select('id')
    .eq('design_id', designId)
    .eq('stage', stage)
    .eq('revision_no', nextRevisionNo)
    .eq('status', 'Active')
    .maybeSingle()

  const pertaminaValue = nullable(formData, 'pic_pertamina') ?? current?.pic_pertamina ?? null

  const { error: writeError } = existing
    ? await supabase
        .from('design_revisions')
        .update({
          pic_id: picId,
          pic_pertamina: pertaminaValue,
          started_at: transitionAt,
          completed_at: null,
          notes: nullable(formData, 'notes'),
          // The refresh_design_current_stage trigger picks the row with the
          // latest created_at as the current stage — bump it so reopening
          // this stage actually wins over whatever was visited after it.
          created_at: new Date().toISOString(),
        })
        .eq('id', existing.id)
    : await supabase.from('design_revisions').insert({
        design_id: designId,
        revision_no: nextRevisionNo,
        stage,
        pic_id: picId,
        // Blank carries the previous stage's reviewer forward, same as PIC.
        pic_pertamina: pertaminaValue,
        started_at: transitionAt,
        notes: nullable(formData, 'notes'),
        created_by: user.id,
      })

  if (writeError) {
    return {
      error: writeError.code === '23505'
        ? `Tahap ${stage} pada revisi ${nextRevisionNo} sudah pernah dicatat.`
        : writeError.message,
    }
  }

  // Approval is a property of the design itself, not of one revision — set
  // once its phase reaches its own terminal stage. Opname is the one
  // exception: reaching it just opens the stage (Tanggal mulai) the same as
  // any other — it isn't "done" until its own Tanggal selesai is filled via
  // completeStage, which is what actually sets approved_at.
  if (stage !== 'Opname') {
    if (stage === PHASE_TERMINAL_STAGE[designRow.phase]) {
      await supabase
        .from('designs')
        .update({ approved_at: new Date().toISOString(), approved_by: user.id })
        .eq('id', designId)
    } else {
      await supabase
        .from('designs')
        .update({ approved_at: null, approved_by: null })
        .eq('id', designId)
    }
  }

  const progressDate = todayMulti(formData, ['next_started_at', 'tanggal'])
  if (current) {
    await syncSpkActivityStage(
      supabase,
      designRow.spk_id,
      current.stage,
      'Selesai',
      progressDate,
      user.id,
    )
  }
  await syncSpkActivityStage(
    supabase,
    designRow.spk_id,
    stage,
    stage === 'Acc PIC Pertamina' ? 'Selesai' : 'Dalam Pengerjaan',
    progressDate,
    user.id,
  )

  const openedRouting =
    designRow.phase === 'finalisasi' && stage === PHASE_TERMINAL_STAGE.finalisasi
      ? await openRoutingFromFinalisasi(supabase, designRow.spk_id, user.id, transitionAt)
      : false

  revalidatePath('/design')
  revalidatePath(`/design/${designId}`)
  revalidatePath(`/spk/${designRow.spk_id}`)
  return {
    error: null,
    success: openedRouting
      ? `Desain dipindahkan ke ${stage}. Dokumen invoice masuk ke Routing Monitor.`
      : `Desain dipindahkan ke ${stage}.`,
  }
}

/**
 * Section 27 — closes a terminal stage that has nowhere further to advance
 * to (Opname on Desain Siteplan). Unlike advanceStage this never opens a new
 * revision; it just sets this one's Tanggal selesai, marks the design
 * approved, and — for Opname specifically — records the Nilai Opname.
 */
export async function completeStage(
  _prev: DesignState,
  formData: FormData,
): Promise<DesignState> {
  const user = await requirePermission('design', 'edit')

  const designId = text(formData, 'design_id')
  const entryId = text(formData, 'entry_id')
  if (!designId || !entryId) return { error: 'Entri tidak dikenali.' }

  const supabase = await createClient()

  const { data: designRow } = await supabase
    .from('designs')
    .select('spk_id, phase')
    .eq('id', designId)
    .maybeSingle()
  if (!designRow) return { error: 'Desain tidak ditemukan.' }

  const { data: entry } = await supabase
    .from('design_revisions')
    .select('stage, started_at')
    .eq('id', entryId)
    .maybeSingle()
  if (!entry) return { error: 'Entri tidak ditemukan.' }

  const submittedStartAt = pickedOrNull(formData, 'tanggal')
  const startedAt = submittedStartAt ?? entry.started_at
  const startError = missingStartDate(user, startedAt)
  if (startError) return { error: startError }
  const completedAt = pickedOrNull(formData, 'completed_at')
  if (completedAt && startedAt && new Date(completedAt) < new Date(startedAt)) {
    return { error: 'Tanggal selesai tidak boleh sebelum tanggal mulai.' }
  }

  const { error } = await supabase
    .from('design_revisions')
    .update({ started_at: startedAt, completed_at: completedAt })
    .eq('id', entryId)
  if (error) return { error: error.message }

  if (entry.stage === PHASE_TERMINAL_STAGE[designRow.phase]) {
    await supabase
      .from('designs')
      .update({ approved_at: new Date().toISOString(), approved_by: user.id })
      .eq('id', designId)
  }

  if (entry.stage === 'Opname' && completedAt) {
    const valueRaw = text(formData, 'opname_value')
    await markOpnameFromDesign(
      supabase,
      designRow.spk_id,
      completedAt.slice(0, 10),
      user.id,
      valueRaw ? Number(valueRaw) : null,
    )
  }

  await syncSpkActivityStage(
    supabase,
    designRow.spk_id,
    entry.stage,
    'Selesai',
    todayMulti(formData, ['completed_at', 'tanggal']),
    user.id,
  )

  revalidatePath('/design')
  revalidatePath('/routing')
  revalidatePath(`/design/${designId}`)
  revalidatePath(`/spk/${designRow.spk_id}`)
  return { error: null, success: `${entry.stage} selesai.` }
}

/**
 * Section 21 — a review round that isn't ready to pass yet, mirroring the
 * routing module's Revisi: it does not move the design or close the stage,
 * it just logs what needs fixing and when it comes back, so one stage can
 * collect as many rounds as it takes before Lanjut moves it on.
 */
export async function addDesignRevision(
  _prev: DesignState,
  formData: FormData,
): Promise<DesignState> {
  const user = await requirePermission('design', 'edit')

  const designId = text(formData, 'design_id')
  const entryId = text(formData, 'entry_id')
  const note = text(formData, 'note')
  const resubmitAt = text(formData, 'resubmit_at')
  if (!designId || !entryId || !note || !resubmitAt) {
    return { error: 'Catatan revisi dan tanggal submit ulang wajib diisi.' }
  }

  const supabase = await createClient()
  const { error } = await supabase.from('design_stage_revisions').insert({
    design_revision_id: entryId,
    note,
    resubmit_at: resubmitAt,
    created_by: user.id,
  })

  if (error) return { error: error.message }

  revalidatePath('/design')
  revalidatePath(`/design/${designId}`)
  return { error: null, success: 'Revisi dicatat.' }
}

/**
 * Fixes a mistake on one history row — date, PIC, or notes. The stage itself
 * is never editable here: it drives designs.current_stage (via the DB
 * trigger) and the SPK Progress tab sync in advanceStage/createDesign, and
 * changing it after the fact would desync both without redoing that work.
 * Use deleteRevisionEntry to undo a wrong stage move instead.
 */
export async function updateRevisionEntry(
  _prev: DesignState,
  formData: FormData,
): Promise<DesignState> {
  const user = await requirePermission('design', 'edit')

  const entryId = text(formData, 'entry_id')
  const designId = text(formData, 'design_id')
  if (!entryId || !designId) return { error: 'Entri tidak dikenali.' }

  const supabase = await createClient()

  const typedPicName = text(formData, 'pic_name')
  const picId = typedPicName ? await resolvePicId(supabase, typedPicName, user.id) : null
  const startedAt = pickedOrNull(formData, 'tanggal')
  const startError = missingStartDate(user, startedAt)
  if (startError) return { error: startError }

  const { data: revisions, error: readError } = await supabase.from('design_revisions')
    .select('id, started_at, completed_at')
    .eq('design_id', designId).eq('status', 'Active')
    .order('revision_no').order('created_at')
  if (readError) return { error: readError.message }
  const index = revisions?.findIndex((row) => row.id === entryId) ?? -1
  if (index < 0) return { error: 'Entri desain tidak ditemukan.' }
  const previous = index > 0 ? revisions![index - 1] : null
  const next = revisions![index + 1]
  if (startedAt && previous?.started_at && startedAt < previous.started_at) {
    return { error: 'Tanggal mulai tidak boleh sebelum tanggal mulai tahap sebelumnya.' }
  }
  if (startedAt && next?.started_at && startedAt > next.started_at) {
    return { error: 'Tanggal mulai tidak boleh setelah tanggal mulai tahap berikutnya.' }
  }
  if (startedAt && !next && revisions![index].completed_at && startedAt > revisions![index].completed_at!) {
    return { error: 'Tanggal mulai tidak boleh setelah tanggal selesai tahap ini.' }
  }

  const { error } = await supabase
    .from('design_revisions')
    .update({
      pic_id: picId,
      pic_pertamina: nullable(formData, 'pic_pertamina'),
      started_at: startedAt,
      ...(next ? { completed_at: next.started_at } : {}),
      notes: nullable(formData, 'notes'),
    })
    .eq('id', entryId)
    .eq('design_id', designId)

  if (error) return { error: error.message }
  if (previous) {
    const { error: previousError } = await supabase.from('design_revisions')
      .update({ completed_at: startedAt }).eq('id', previous.id)
    if (previousError) return { error: previousError.message }
  }

  revalidatePath('/design')
  revalidatePath(`/design/${designId}`)
  return { error: null, success: 'Entri diperbarui.' }
}

/** Restores the editable fields of one stage entry after its latest save.
 *  Advancing/completing stages intentionally uses a separate undo path because
 *  those mutations also synchronize the SPK workflow. */
export async function restoreRevisionEntry(
  _prev: DesignState,
  formData: FormData,
): Promise<DesignState> {
  await requirePermission('design', 'edit')

  const entryId = text(formData, 'entry_id')
  const designId = text(formData, 'design_id')
  if (!entryId || !designId) return { error: 'Entri tidak dikenali.' }

  const supabase = await createClient()
  const { data: design, error: designError } = await supabase
    .from('designs')
    .select('spk_id')
    .eq('id', designId)
    .maybeSingle()
  if (designError) return { error: designError.message }
  if (!design) return { error: 'Desain tidak ditemukan.' }

  const startedRaw = text(formData, 'started_at')
  const restoredStart = startedRaw ? new Date(startedRaw).toISOString() : null
  const { data: revisions, error: readError } = await supabase.from('design_revisions')
    .select('id, started_at').eq('design_id', designId).eq('status', 'Active')
    .order('revision_no').order('created_at')
  if (readError) return { error: readError.message }
  const index = revisions?.findIndex((row) => row.id === entryId) ?? -1
  if (index < 0) return { error: 'Entri desain tidak ditemukan.' }
  const previous = index > 0 ? revisions![index - 1] : null
  const next = revisions![index + 1]
  if (restoredStart && previous?.started_at && restoredStart < previous.started_at) {
    return { error: 'Tanggal lama mendahului tahap sebelumnya; perubahan tidak dapat diurungkan.' }
  }
  if (restoredStart && next?.started_at && restoredStart > next.started_at) {
    return { error: 'Tanggal lama melewati tahap berikutnya; perubahan tidak dapat diurungkan.' }
  }
  const restoredFinish = next ? next.started_at : nullable(formData, 'completed_at')
  if (restoredStart && restoredFinish && restoredStart > restoredFinish) {
    return { error: 'Tanggal lama melewati tanggal selesai; perubahan tidak dapat diurungkan.' }
  }
  const { error } = await supabase
    .from('design_revisions')
    .update({
      pic_id: nullable(formData, 'pic_id'),
      pic_pertamina: nullable(formData, 'pic_pertamina'),
      started_at: restoredStart,
      completed_at: restoredFinish,
      notes: nullable(formData, 'notes'),
    })
    .eq('id', entryId)
    .eq('design_id', designId)

  if (error) return { error: error.message }
  if (previous) {
    const { error: previousError } = await supabase.from('design_revisions')
      .update({ completed_at: restoredStart })
      .eq('id', previous.id)
    if (previousError) return { error: previousError.message }
  }

  revalidatePath('/design')
  revalidatePath(`/design/${designId}`)
  revalidatePath(`/spk/${design.spk_id}`)
  return { error: null, success: 'Perubahan dibatalkan.' }
}

/**
 * Undoes the last stage move outright — only the LATEST revision can be
 * deleted, never one buried in the middle, because designs.current_stage
 * (via refresh_design_current_stage) and the SPK Progress tab sync both
 * assume history only ever grows at the end. Deleting the latest row lets
 * the DB trigger fall back to whatever is now latest on its own; the two
 * spk_activities items touched by that move (the one it left, the one it
 * entered) are put back the way advanceStage found them.
 */
export async function deleteRevisionEntry(
  _prev: DesignState,
  formData: FormData,
): Promise<DesignState> {
  const user = await requirePermission('design', 'edit')

  const entryId = text(formData, 'entry_id')
  const designId = text(formData, 'design_id')
  if (!entryId || !designId) return { error: 'Entri tidak dikenali.' }

  const supabase = await createClient()

  const { data: designRow } = await supabase
    .from('designs')
    .select('spk_id, phase')
    .eq('id', designId)
    .maybeSingle()
  if (!designRow) return { error: 'Desain tidak ditemukan.' }

  const { data: revisions, error: readError } = await supabase
    .from('design_revisions')
    .select('id, stage')
    .eq('design_id', designId)
    .eq('status', 'Active')
    .order('revision_no', { ascending: false })
    .order('created_at', { ascending: false })

  if (readError) return { error: readError.message }
  if (!revisions || revisions.length === 0) return { error: 'Belum ada riwayat tahap.' }

  const latest = revisions[0]
  if (latest.id !== entryId) {
    return { error: 'Hanya tahap terakhir yang bisa dihapus — hapus urut dari yang paling baru.' }
  }
  if (revisions.length === 1) {
    return { error: 'Tahap pertama tidak bisa dihapus — hapus record desainnya jika ingin membatalkan seluruhnya.' }
  }

  const { error: deleteError } = await supabase
    .from('design_revisions')
    .delete()
    .eq('id', entryId)
  if (deleteError) return { error: deleteError.message }

  const previous = revisions[1]
  const { error: reopenError } = await supabase.from('design_revisions')
    .update({ completed_at: null }).eq('id', previous.id)
  if (reopenError) return { error: reopenError.message }
  const today10 = new Date().toISOString().slice(0, 10)

  // Reverse of what advanceStage did on the way in: the stage being undone
  // goes back to untouched, the one before it resumes as in-progress.
  await syncSpkActivityStage(supabase, designRow.spk_id, latest.stage, 'Belum Mulai', today10, user.id)
  await syncSpkActivityStage(supabase, designRow.spk_id, previous.stage, 'Dalam Pengerjaan', today10, user.id)

  if (latest.stage === PHASE_TERMINAL_STAGE[designRow.phase]) {
    await supabase
      .from('designs')
      .update({ approved_at: null, approved_by: null })
      .eq('id', designId)
  }

  revalidatePath('/design')
  revalidatePath(`/design/${designId}`)
  revalidatePath(`/spk/${designRow.spk_id}`)
  return { error: null, success: 'Tahap terakhir dibatalkan.' }
}

/**
 * Reopens a previously reached stage and removes only the progress that came
 * after it. This is deliberately distinct from deleting one latest entry:
 * users can correct a workflow jump in one action (for example returning
 * from Pembuatan Peta Inventaris to Pembuatan Desain Awal) without losing the
 * history that led up to the selected stage.
 */
export async function rewindDesignToStage(
  _prev: DesignState,
  formData: FormData,
): Promise<DesignState> {
  const user = await requirePermission('design', 'edit')

  const designId = text(formData, 'design_id')
  const targetStage = text(formData, 'target_stage') as DesignStage
  if (!designId || !targetStage) return { error: 'Tahap tujuan tidak dikenali.' }

  const supabase = await createClient()
  const { data: designRow } = await supabase
    .from('designs')
    .select('spk_id, phase')
    .eq('id', designId)
    .maybeSingle()
  if (!designRow) return { error: 'Desain tidak ditemukan.' }

  const stages = PHASE_STAGES[designRow.phase]
  const targetIndex = stages.indexOf(targetStage)
  if (targetIndex === -1) return { error: 'Tahap tujuan tidak sesuai dengan fase desain ini.' }

  // Going backwards after the next phase begins would leave two workflows
  // disagreeing. Make that dependency explicit instead of silently deleting
  // work from another phase or from the invoice route.
  if (designRow.phase === 'siteplan' && targetIndex < stages.length - 1) {
    const { data: finalisasi } = await supabase
      .from('designs')
      .select('id')
      .eq('spk_id', designRow.spk_id)
      .eq('phase', 'finalisasi')
      .eq('status', 'Active')
      .maybeSingle()
    if (finalisasi) {
      return { error: 'Finalisasi Desain sudah dimulai. Batalkan progres Finalisasi Desain terlebih dahulu.' }
    }
  }
  if (designRow.phase === 'finalisasi' && targetIndex < stages.length - 1) {
    const { data: routing } = await supabase
      .from('spk_routing')
      .select('id')
      .eq('spk_id', designRow.spk_id)
      .maybeSingle()
    if (routing) {
      return { error: 'Dokumen invoice sudah dibuat. Batalkan progres routing terlebih dahulu.' }
    }
  }

  const { data: revisions, error: revisionsError } = await supabase
    .from('design_revisions')
    .select('id, stage')
    .eq('design_id', designId)
    .eq('status', 'Active')
    .order('revision_no')
    .order('created_at')
  if (revisionsError) return { error: revisionsError.message }
  if (!revisions?.length) return { error: 'Belum ada riwayat tahap desain.' }

  const targetEntryIndex = revisions.map((revision) => revision.stage).lastIndexOf(targetStage)
  if (targetEntryIndex === -1) return { error: `Tahap ${targetStage} belum pernah dicapai.` }

  const targetEntry = revisions[targetEntryIndex]
  const entriesToRemove = revisions.slice(targetEntryIndex + 1).map((revision) => revision.id)
  if (entriesToRemove.length) {
    const { error: childError } = await supabase
      .from('design_stage_revisions')
      .delete()
      .in('design_revision_id', entriesToRemove)
    if (childError) return { error: childError.message }

    const { error: deleteError } = await supabase
      .from('design_revisions')
      .delete()
      .in('id', entriesToRemove)
    if (deleteError) return { error: deleteError.message }
  }

  const { error: reopenError } = await supabase
    .from('design_revisions')
    .update({ completed_at: null, created_at: new Date().toISOString() })
    .eq('id', targetEntry.id)
  if (reopenError) return { error: reopenError.message }

  await supabase
    .from('designs')
    .update({ approved_at: null, approved_by: null })
    .eq('id', designId)

  const progressDate = new Date().toISOString().slice(0, 10)
  for (const [index, stage] of stages.entries()) {
    await syncSpkActivityStage(
      supabase,
      designRow.spk_id,
      stage,
      index < targetIndex ? 'Selesai' : index === targetIndex ? 'Dalam Pengerjaan' : 'Belum Mulai',
      progressDate,
      user.id,
    )
  }

  revalidatePath('/design')
  revalidatePath(`/design/${designId}`)
  revalidatePath(`/spk/${designRow.spk_id}`)
  return { error: null, success: `Desain dikembalikan ke ${targetStage}.` }
}

/**
 * Wipes a design record's whole progress (cascades to design_revisions and
 * design_stage_revisions), leaving the SPK itself untouched — the user can
 * start fresh via createDesign/startDesign afterwards. Distinct from
 * deleteRevisionEntry, which only undoes one stage at a time.
 */
export async function deleteDesign(
  _prev: DesignState,
  formData: FormData,
): Promise<DesignState> {
  await requirePermission('design', 'edit')

  const designId = text(formData, 'design_id')
  if (!designId) return { error: 'Desain tidak dikenali.' }

  const supabase = await createClient()

  const { data: designRow } = await supabase
    .from('designs')
    .select('spk_id')
    .eq('id', designId)
    .maybeSingle()
  if (!designRow) return { error: 'Desain tidak ditemukan.' }

  const { error } = await supabase.from('designs').delete().eq('id', designId)
  if (error) return { error: error.message }

  revalidatePath('/design')
  revalidatePath('/design/siteplan')
  revalidatePath('/design/finalisasi')
  revalidatePath(`/spk/${designRow.spk_id}`)
  return { error: null }
}

