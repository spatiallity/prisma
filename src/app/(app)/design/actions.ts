'use server'

import { revalidatePath } from 'next/cache'
import { createClient } from '@/lib/supabase/server'
import { requirePermission } from '@/lib/auth/session'
import type { DesignStage, StageStatus } from '@/lib/supabase/types'
import { PHASE_STAGES, PHASE_TERMINAL_STAGE } from '@/lib/design'

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
 *  day showing up in a timezone west of UTC. Falls back to right now. */
function pickedOrNow(formData: FormData, key: string) {
  const raw = text(formData, key)
  return raw ? new Date(`${raw}T12:00:00`).toISOString() : new Date().toISOString()
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

/** Same as pickedOrNow, but tries each key in order — the merged stage-entry
 *  form submits the closing date as `completed_at` (distinct from the Mulai
 *  field, also present in that same form as `tanggal`), while the older
 *  standalone review form still only ever sends `tanggal`. */
function pickedOrNowMulti(formData: FormData, keys: string[]) {
  for (const key of keys) {
    const raw = text(formData, key)
    if (raw) return new Date(`${raw}T12:00:00`).toISOString()
  }
  return new Date().toISOString()
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
 * Financial tab, PAD gate, and Routing Monitor's Opname column read the same
 * event as their source. Routing itself is now opened only from the routing
 * module once document invoice really enters Pertamina review; this lets SPK
 * sit in finalisasi/drafting invoice without polluting Routing Monitor.
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

  const startedAt = pickedOrNow(formData, 'tanggal')

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
  const startedAt = pickedOrNow(formData, 'tanggal')

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
    .select('spk_id, phase')
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
    : revisions?.find((revision) => !revision.completed_at) ?? revisions?.[0]
  if (entryId && !current) return { error: 'Tahap aktif tidak ditemukan.' }
  if (current?.stage === stage) {
    return { error: `Desain sudah berada di tahap ${stage}.` }
  }

  const now = pickedOrNowMulti(formData, ['completed_at', 'tanggal'])
  // The accordion form can correct the start date while advancing. Validate
  // against that submitted value instead of the pre-edit value in the row.
  const submittedStartAt = text(formData, 'completed_at') ? pickedOrNow(formData, 'tanggal') : null
  const currentStartAt = submittedStartAt ?? current?.started_at
  if (currentStartAt && new Date(now) < new Date(currentStartAt)) {
    return { error: 'Tanggal selesai tidak boleh sebelum tanggal mulai.' }
  }
  // Drafter is per-stage-entry, not carried forward — a blank field means no
  // drafter recorded for this entry, not "same as before".
  const typedPicName = text(formData, 'pic_name')
  const picId = typedPicName ? await resolvePicId(supabase, typedPicName, user.id) : null

  if (current && !current.completed_at) {
    const { error } = await supabase
      .from('design_revisions')
      .update({
        completed_at: now,
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
          started_at: now,
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
        started_at: now,
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
  // completeStage, which is what actually sets approved_at and opens routing.
  if (stage !== 'Opname') {
    if (stage === PHASE_TERMINAL_STAGE[designRow.phase]) {
      await supabase
        .from('designs')
        .update({ approved_at: now, approved_by: user.id })
        .eq('id', designId)
    } else {
      await supabase
        .from('designs')
        .update({ approved_at: null, approved_by: null })
        .eq('id', designId)
    }
  }

  const progressDate = todayMulti(formData, ['completed_at', 'tanggal'])
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

  revalidatePath('/design')
  revalidatePath(`/design/${designId}`)
  revalidatePath(`/spk/${designRow.spk_id}`)
  return { error: null, success: `Desain dipindahkan ke ${stage}.` }
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

  const now = pickedOrNowMulti(formData, ['completed_at', 'tanggal'])
  if (entry.started_at && new Date(now) < new Date(entry.started_at)) {
    return { error: 'Tanggal selesai tidak boleh sebelum tanggal mulai.' }
  }

  const { error } = await supabase
    .from('design_revisions')
    .update({ completed_at: now })
    .eq('id', entryId)
  if (error) return { error: error.message }

  if (entry.stage === PHASE_TERMINAL_STAGE[designRow.phase]) {
    await supabase
      .from('designs')
      .update({ approved_at: now, approved_by: user.id })
      .eq('id', designId)
  }

  if (entry.stage === 'Opname') {
    const valueRaw = text(formData, 'opname_value')
    await markOpnameFromDesign(
      supabase,
      designRow.spk_id,
      todayMulti(formData, ['completed_at', 'tanggal']),
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
  if (!entryId) return { error: 'Entri tidak dikenali.' }

  const supabase = await createClient()

  const typedPicName = text(formData, 'pic_name')
  const picId = typedPicName ? await resolvePicId(supabase, typedPicName, user.id) : null

  const { error } = await supabase
    .from('design_revisions')
    .update({
      pic_id: picId,
      pic_pertamina: nullable(formData, 'pic_pertamina'),
      started_at: pickedOrNow(formData, 'tanggal'),
      notes: nullable(formData, 'notes'),
    })
    .eq('id', entryId)

  if (error) return { error: error.message }

  revalidatePath('/design')
  revalidatePath(`/design/${designId}`)
  return { error: null, success: 'Entri diperbarui.' }
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

