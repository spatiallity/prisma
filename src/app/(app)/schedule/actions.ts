'use server'

import { revalidatePath } from 'next/cache'
import { createClient } from '@/lib/supabase/server'
import { requirePermission } from '@/lib/auth/session'
import type { RecordStatus } from '@/lib/supabase/types'

export type ScheduleState = { error: string | null; success?: string }

function text(formData: FormData, key: string) {
  const value = formData.get(key)
  return typeof value === 'string' ? value.trim() : ''
}

function nullable(formData: FormData, key: string) {
  return text(formData, key) || null
}

function numeric(formData: FormData, key: string) {
  const raw = text(formData, key)
  if (!raw) return null
  const parsed = Number(raw.replace(/\./g, '').replace(',', '.'))
  return Number.isFinite(parsed) ? parsed : null
}

/**
 * Looks up the activity so the plan inherits its unit — the person filling the
 * form should not have to remember whether an activity is measured in Ha or
 * patok (Section 4.2).
 */
async function unitForActivity(activityId: string | null) {
  if (!activityId) return null
  const supabase = await createClient()
  const { data } = await supabase
    .from('spk_activities')
    .select('unit')
    .eq('id', activityId)
    .maybeSingle()
  return data?.unit ?? null
}

// --- Daily Plan (Section 18) ------------------------------------------------

export async function createDailyPlan(
  _prev: ScheduleState,
  formData: FormData,
): Promise<ScheduleState> {
  const user = await requirePermission('daily_plan', 'edit')

  const spkId = text(formData, 'spk_id')
  const planDate = text(formData, 'plan_date')
  if (!spkId || !planDate) return { error: 'SPK dan tanggal wajib diisi.' }

  const activityId = nullable(formData, 'spk_activity_id')
  const target = numeric(formData, 'target_value')
  if (target !== null && target < 0) return { error: 'Target tidak boleh negatif.' }

  const supabase = await createClient()
  const { error } = await supabase.from('daily_plans').insert({
    spk_id: spkId,
    spk_activity_id: activityId,
    plan_date: planDate,
    vendor_id: nullable(formData, 'vendor_id'),
    team_id: nullable(formData, 'team_id'),
    target_value: target,
    unit: text(formData, 'unit') || (await unitForActivity(activityId)),
    notes: nullable(formData, 'notes'),
    created_by: user.id,
  })

  if (error) return { error: error.message }

  revalidatePath('/schedule')
  revalidatePath('/schedule/daily-plan')
  revalidatePath(`/spk/${spkId}`)
  return { error: null, success: 'Daily Plan tersimpan.' }
}

/** Section 4.4 — a cancelled plan goes Inactive, it is never deleted. */
export async function setPlanStatus(
  _prev: ScheduleState,
  formData: FormData,
): Promise<ScheduleState> {
  await requirePermission('daily_plan', 'edit')

  const id = text(formData, 'id')
  const status = text(formData, 'status') as RecordStatus
  if (!id || !status) return { error: 'Data tidak lengkap.' }

  const supabase = await createClient()
  const { error } = await supabase.from('daily_plans').update({ status }).eq('id', id)
  if (error) return { error: error.message }

  revalidatePath('/schedule')
  revalidatePath('/schedule/daily-plan')
  return { error: null, success: `Plan di-set ${status}.` }
}

// --- Daily Progress (Section 18, 44) ----------------------------------------

/**
 * Section 18: actual_value is the increment achieved on progress_date, not a
 * running total. The trigger from migration 0005 rebuilds the cumulative
 * activity_progress row from these increments, which is what moves Overall
 * Progress — nothing here touches a percentage.
 */
export async function createDailyProgress(
  _prev: ScheduleState,
  formData: FormData,
): Promise<ScheduleState> {
  const user = await requirePermission('daily_progress', 'edit')

  const spkId = text(formData, 'spk_id')
  const progressDate = text(formData, 'progress_date')
  const actual = numeric(formData, 'actual_value')

  if (!spkId || !progressDate) return { error: 'SPK dan tanggal wajib diisi.' }
  if (actual === null) return { error: 'Hasil aktual wajib diisi.' }
  if (actual < 0) return { error: 'Hasil aktual tidak boleh negatif.' }

  const planId = nullable(formData, 'daily_plan_id')
  let activityId = nullable(formData, 'spk_activity_id')
  let vendorId = nullable(formData, 'vendor_id')
  let teamId = nullable(formData, 'team_id')

  const supabase = await createClient()

  // Filling straight from a plan carries its activity, vendor and team over.
  if (planId) {
    const { data: plan } = await supabase
      .from('daily_plans')
      .select('spk_activity_id, vendor_id, team_id')
      .eq('id', planId)
      .maybeSingle()
    if (plan) {
      activityId = activityId ?? plan.spk_activity_id
      vendorId = vendorId ?? plan.vendor_id
      teamId = teamId ?? plan.team_id
    }
  }

  const { error } = await supabase.from('daily_progress').insert({
    daily_plan_id: planId,
    spk_id: spkId,
    spk_activity_id: activityId,
    progress_date: progressDate,
    vendor_id: vendorId,
    team_id: teamId,
    actual_value: actual,
    unit: text(formData, 'unit') || (await unitForActivity(activityId)),
    notes: nullable(formData, 'notes'),
    submitted_by: user.id,
  })

  if (error) return { error: error.message }

  revalidatePath('/schedule/daily-progress')
  revalidatePath('/schedule')
  revalidatePath(`/spk/${spkId}`)
  revalidatePath('/spk')
  return {
    error: null,
    success: 'Daily Progress tersimpan. Progress SPK diperbarui otomatis.',
  }
}

export async function setProgressStatus(
  _prev: ScheduleState,
  formData: FormData,
): Promise<ScheduleState> {
  await requirePermission('daily_progress', 'edit')

  const id = text(formData, 'id')
  const status = text(formData, 'status') as RecordStatus
  if (!id || !status) return { error: 'Data tidak lengkap.' }

  const supabase = await createClient()
  const { error } = await supabase.from('daily_progress').update({ status }).eq('id', id)
  if (error) return { error: error.message }

  revalidatePath('/schedule/daily-progress')
  revalidatePath('/spk')
  return { error: null, success: `Entri di-set ${status}.` }
}
