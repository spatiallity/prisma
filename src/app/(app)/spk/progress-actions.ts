'use server'

import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { requirePermission, requireUser } from '@/lib/auth/session'
import { can } from '@/lib/auth/permissions'
import type { MeasurementType, StageStatus } from '@/lib/supabase/types'

export type ProgressState = { error: string | null; success?: string }

function text(formData: FormData, key: string) {
  const value = formData.get(key)
  return typeof value === 'string' ? value.trim() : ''
}

function numeric(formData: FormData, key: string) {
  const raw = text(formData, key)
  if (!raw) return null
  const parsed = Number(raw.replace(/\./g, '').replace(',', '.'))
  return Number.isFinite(parsed) ? parsed : null
}

/** Postgres 42501 — RLS refused the write. For a vendor account this is
 *  almost always the Desain Siteplan cutoff (spk_progress_editable()). */
function friendlyProgressError(message: string, code: string | undefined, isVendor: boolean) {
  if (code === '42501' && isVendor) {
    return 'SPK ini sudah masuk tahapan Desain Siteplan — progress hanya bisa diubah oleh tim internal sekarang.'
  }
  return message
}

/**
 * Section 17 — instantiate a Progress Template onto one SPK.
 *
 * Section 4.2: an activity flagged target_from_spk_area inherits the SPK's
 * luas area, so the 12,06 Ha typed once on the SPK becomes the terrestrial
 * measurement target without anyone retyping it.
 */
export async function applyTemplate(
  _prev: ProgressState,
  formData: FormData,
): Promise<ProgressState> {
  const user = await requirePermission('progress', 'edit')

  const spkId = text(formData, 'spk_id')
  const templateId = text(formData, 'template_id')
  if (!spkId || !templateId) return { error: 'SPK dan template wajib dipilih.' }

  const supabase = await createClient()

  const [{ data: spk }, { data: existing }, { data: items, error: itemsError }] =
    await Promise.all([
      supabase.from('spks').select('id, area_ha').eq('id', spkId).maybeSingle(),
      supabase.from('spk_activities').select('id').eq('spk_id', spkId).limit(1),
      supabase
        .from('activity_template_items')
        .select('*')
        .eq('template_id', templateId)
        .order('sequence'),
    ])

  if (!spk) return { error: 'SPK tidak ditemukan.' }
  if (itemsError) return { error: itemsError.message }
  if (!items || items.length === 0) return { error: 'Template ini belum punya aktivitas.' }

  // Re-applying would double the weights past the 100% guard, so refuse.
  if (existing && existing.length > 0) {
    return {
      error:
        'SPK ini sudah punya daftar aktivitas. Hapus/nonaktifkan dulu jika ingin mengganti template.',
    }
  }

  const rows = items.map((item) => ({
    spk_id: spkId,
    template_item_id: item.id,
    name: item.name,
    weight: item.weight,
    measurement: item.measurement,
    unit: item.unit,
    sequence: item.sequence,
    target_value: item.target_from_spk_area ? spk.area_ha : item.default_target,
  }))

  const { error } = await supabase.from('spk_activities').insert(rows)
  if (error) return { error: friendlyProgressError(error.message, error.code, !!user.vendorId) }

  // Keep the SPK pointing at the template it was built from.
  await supabase.from('spks').update({ activity_template_id: templateId }).eq('id', spkId)

  revalidatePath(`/spk/${spkId}`)
  revalidatePath('/spk')
  return { error: null, success: `${rows.length} aktivitas dibuat dari template.` }
}

/** Adds one activity by hand, for SPK that do not fit a template. */
export async function addActivity(
  _prev: ProgressState,
  formData: FormData,
): Promise<ProgressState> {
  const user = await requirePermission('progress', 'edit')

  const spkId = text(formData, 'spk_id')
  const name = text(formData, 'name')
  const weight = numeric(formData, 'weight')
  const measurement = text(formData, 'measurement') as MeasurementType

  if (!spkId || !name || weight === null) {
    return { error: 'Nama aktivitas dan bobot wajib diisi.' }
  }
  if (weight <= 0 || weight > 100) return { error: 'Bobot harus di antara 0 dan 100.' }

  const supabase = await createClient()

  const { data: siblings } = await supabase
    .from('spk_activities')
    .select('sequence')
    .eq('spk_id', spkId)
    .order('sequence', { ascending: false })
    .limit(1)

  const nextSequence = (siblings?.[0]?.sequence ?? 0) + 1

  const { error } = await supabase.from('spk_activities').insert({
    spk_id: spkId,
    name,
    weight,
    measurement,
    unit: text(formData, 'unit') || null,
    sequence: nextSequence,
    target_value: numeric(formData, 'target_value'),
  })

  // The deferred constraint trigger raises this when the weights pass 100.
  if (error) {
    return {
      error: error.message.includes('melebihi 100')
        ? 'Total bobot aktivitas SPK ini akan melebihi 100%.'
        : friendlyProgressError(error.message, error.code, !!user.vendorId),
    }
  }

  revalidatePath(`/spk/${spkId}`)
  return { error: null, success: `Aktivitas ${name} ditambahkan.` }
}

/**
 * Section 16 — records one progress entry. The value written here is the
 * cumulative figure as of progress_date; the trigger in migration 0005 rolls
 * it up onto spk_activities, which recomputes progress_percent, which feeds
 * v_spk_progress and the dashboard. Nothing writes a percentage directly.
 */
export async function recordProgress(
  _prev: ProgressState,
  formData: FormData,
): Promise<ProgressState> {
  const user = await requirePermission('progress', 'edit')

  const activityId = text(formData, 'spk_activity_id')
  const spkId = text(formData, 'spk_id')
  const measurement = text(formData, 'measurement') as MeasurementType
  const progressDate = text(formData, 'progress_date')

  if (!activityId || !progressDate) return { error: 'Tanggal progress wajib diisi.' }

  let actualValue: number | null = null
  let stage: StageStatus | null = null

  if (measurement === 'stage') {
    stage = text(formData, 'stage') as StageStatus
    if (!stage) return { error: 'Status tahapan wajib dipilih.' }
  } else {
    actualValue = numeric(formData, 'actual_value')
    if (actualValue === null) return { error: 'Nilai progress wajib diisi.' }
    if (actualValue < 0) return { error: 'Nilai progress tidak boleh negatif.' }
    if (measurement === 'percentage' && actualValue > 100) {
      return { error: 'Progress persentase maksimal 100.' }
    }
  }

  const supabase = await createClient()
  const { error } = await supabase.from('activity_progress').insert({
    spk_activity_id: activityId,
    progress_date: progressDate,
    actual_value: actualValue,
    stage,
    notes: text(formData, 'notes') || null,
    source: 'manual',
    recorded_by: user.id,
  })

  if (error) return { error: friendlyProgressError(error.message, error.code, !!user.vendorId) }

  revalidatePath(`/spk/${spkId}`)
  revalidatePath(`/spk/${spkId}/progress/${activityId}`)
  revalidatePath('/spk')
  return { error: null, success: 'Progress tercatat.' }
}

/** Corrects one existing entry — same shape and validation as recordProgress,
 *  just an update instead of an insert. Same RLS gate (spk_progress_editable),
 *  so a vendor loses this once the design cutoff hits, same as recording. */
export async function updateProgressEntry(
  _prev: ProgressState,
  formData: FormData,
): Promise<ProgressState> {
  const user = await requirePermission('progress', 'edit')

  const entryId = text(formData, 'entry_id')
  const activityId = text(formData, 'spk_activity_id')
  const spkId = text(formData, 'spk_id')
  const measurement = text(formData, 'measurement') as MeasurementType
  const progressDate = text(formData, 'progress_date')

  if (!entryId || !progressDate) return { error: 'Tanggal progress wajib diisi.' }

  let actualValue: number | null = null
  let stage: StageStatus | null = null

  if (measurement === 'stage') {
    stage = text(formData, 'stage') as StageStatus
    if (!stage) return { error: 'Status tahapan wajib dipilih.' }
  } else {
    actualValue = numeric(formData, 'actual_value')
    if (actualValue === null) return { error: 'Nilai progress wajib diisi.' }
    if (actualValue < 0) return { error: 'Nilai progress tidak boleh negatif.' }
    if (measurement === 'percentage' && actualValue > 100) {
      return { error: 'Progress persentase maksimal 100.' }
    }
  }

  const supabase = await createClient()
  const { error } = await supabase
    .from('activity_progress')
    .update({
      progress_date: progressDate,
      actual_value: actualValue,
      stage,
      notes: text(formData, 'notes') || null,
    })
    .eq('id', entryId)

  if (error) return { error: friendlyProgressError(error.message, error.code, !!user.vendorId) }

  revalidatePath(`/spk/${spkId}`)
  revalidatePath(`/spk/${spkId}/progress/${activityId}`)
  revalidatePath('/spk')
  return { error: null, success: 'Progress diperbarui.' }
}

/** Removes a mistaken entry outright. The rollup trigger recomputes
 *  spk_activities from whatever's left, so deleting the latest row falls
 *  back to the next-latest automatically — nothing else to reconcile. */
export async function deleteProgressEntry(
  _prev: ProgressState,
  formData: FormData,
): Promise<ProgressState> {
  const user = await requirePermission('progress', 'edit')

  const entryId = text(formData, 'entry_id')
  const activityId = text(formData, 'spk_activity_id')
  const spkId = text(formData, 'spk_id')
  if (!entryId) return { error: 'Entri tidak dikenali.' }

  const supabase = await createClient()
  const { error } = await supabase.from('activity_progress').delete().eq('id', entryId)

  if (error) return { error: friendlyProgressError(error.message, error.code, !!user.vendorId) }

  revalidatePath(`/spk/${spkId}`)
  revalidatePath(`/spk/${spkId}/progress/${activityId}`)
  revalidatePath('/spk')
  return { error: null, success: 'Entri dihapus.' }
}

/**
 * Corrects an activity's target — jumlah titik Stake Out, luas Pengukuran
 * Terestris, etc. Neither is fixed at instantiation time: Stake Out starts
 * with no target at all, and the terrestrial-survey area only inherits the
 * SPK's luas area as a starting point, not a permanent one. Same dual
 * permission path as everything else on spk_activities (spk_editable OR
 * spk_progress_editable) — a vendor can fix its own number up to the design
 * cutoff, an internal SPK editor always can.
 */
export async function updateActivityTarget(
  _prev: ProgressState,
  formData: FormData,
): Promise<ProgressState> {
  const user = await requireUser()
  if (!can(user.permissions, 'progress', 'edit') && !can(user.permissions, 'spk', 'edit')) {
    redirect('/forbidden')
  }

  const activityId = text(formData, 'spk_activity_id')
  const spkId = text(formData, 'spk_id')
  if (!activityId) return { error: 'Aktivitas tidak dikenali.' }

  const targetValue = numeric(formData, 'target_value')
  if (targetValue !== null && targetValue < 0) {
    return { error: 'Target tidak boleh negatif.' }
  }

  const supabase = await createClient()
  const { error } = await supabase
    .from('spk_activities')
    .update({ target_value: targetValue })
    .eq('id', activityId)

  if (error) return { error: friendlyProgressError(error.message, error.code, !!user.vendorId) }

  revalidatePath(`/spk/${spkId}`)
  revalidatePath(`/spk/${spkId}/progress/${activityId}`)
  return { error: null, success: 'Target diperbarui.' }
}
