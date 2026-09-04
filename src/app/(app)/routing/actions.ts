'use server'

import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { requirePermission } from '@/lib/auth/session'
import type { RoutingStatus } from '@/lib/supabase/types'

export type RoutingState = { error: string | null; success?: string }

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

/**
 * Section 23 — puts a document into the routing chain. Every stage of the
 * template is written up front so the whole path is visible from day one, not
 * revealed one step at a time; only the first stage starts running.
 */
export async function createRouting(
  _prev: RoutingState,
  formData: FormData,
): Promise<RoutingState> {
  const user = await requirePermission('routing', 'edit')

  const spkId = text(formData, 'spk_id')
  const templateId = text(formData, 'template_id')
  const documentType = text(formData, 'document_type')

  if (!spkId || !templateId || !documentType) {
    return { error: 'SPK, template, dan jenis dokumen wajib diisi.' }
  }

  const supabase = await createClient()

  const { data: steps, error: stepsError } = await supabase
    .from('routing_template_steps')
    .select('*')
    .eq('template_id', templateId)
    .order('sequence')

  if (stepsError) return { error: stepsError.message }
  if (!steps || steps.length === 0) {
    return { error: 'Template routing ini belum punya tahapan.' }
  }

  const { data: routing, error } = await supabase
    .from('spk_routing')
    .insert({
      spk_id: spkId,
      template_id: templateId,
      document_type: documentType,
      document_number: nullable(formData, 'document_number'),
      notes: nullable(formData, 'notes'),
      created_by: user.id,
    })
    .select('id')
    .single()

  if (error) return { error: error.message }

  const now = pickedOrNow(formData, 'tanggal')
  const rows = steps.map((step, index) => ({
    spk_routing_id: routing.id,
    template_step_id: step.id,
    step_name: step.name,
    sequence: step.sequence,
    // The SLA is copied, not referenced: changing the template later must not
    // rewrite the terms a document already in flight was measured against.
    sla_days: step.sla_days,
    pic_name: step.default_pic_role,
    status: (index === 0 ? 'In Progress' : 'Pending') as RoutingStatus,
    started_at: index === 0 ? now : null,
    created_by: user.id,
  }))

  const { error: historyError } = await supabase.from('routing_history').insert(rows)
  if (historyError) return { error: historyError.message }

  revalidatePath('/routing')
  revalidatePath(`/spk/${spkId}`)
  redirect(`/routing/${routing.id}`)
}

/**
 * Completes the stage the document sits in and starts the next one. The
 * document's own status is not touched here — the trigger from migration 0007
 * derives it from the stages.
 */
export async function advanceStep(
  _prev: RoutingState,
  formData: FormData,
): Promise<RoutingState> {
  await requirePermission('routing', 'edit')

  const stepId = text(formData, 'step_id')
  const routingId = text(formData, 'routing_id')
  if (!stepId || !routingId) return { error: 'Tahap tidak dikenali.' }

  const supabase = await createClient()

  const { data: steps, error: readError } = await supabase
    .from('routing_history')
    .select('id, sequence, status, started_at')
    .eq('spk_routing_id', routingId)
    .order('sequence')

  if (readError) return { error: readError.message }

  const current = (steps ?? []).find((s) => s.id === stepId)
  if (!current) return { error: 'Tahap tidak ditemukan.' }
  if (current.status === 'Completed') {
    return { error: 'Tahap ini sudah selesai.' }
  }

  const now = pickedOrNow(formData, 'tanggal')

  const { error: completeError } = await supabase
    .from('routing_history')
    .update({
      status: 'Completed',
      // A stage returned and resumed may never have been started.
      started_at: current.started_at ?? now,
      completed_at: now,
      pic_name: nullable(formData, 'pic_name') ?? undefined,
      note: nullable(formData, 'note') ?? undefined,
    })
    .eq('id', stepId)

  if (completeError) return { error: completeError.message }

  const next = (steps ?? []).find((s) => s.sequence > current.sequence)
  if (next) {
    const { error: nextError } = await supabase
      .from('routing_history')
      .update({ status: 'In Progress', started_at: now })
      .eq('id', next.id)
    if (nextError) return { error: nextError.message }
  }

  revalidatePath('/routing')
  revalidatePath(`/routing/${routingId}`)
  return {
    error: null,
    success: next ? 'Dokumen diteruskan ke tahap berikutnya.' : 'Routing selesai.',
  }
}

/**
 * Section 23 — a stage can send the document back or refuse it outright.
 * Returned keeps the document alive; Rejected ends it.
 */
export async function setStepStatus(
  _prev: RoutingState,
  formData: FormData,
): Promise<RoutingState> {
  await requirePermission('routing', 'edit')

  const stepId = text(formData, 'step_id')
  const routingId = text(formData, 'routing_id')
  const status = text(formData, 'status') as RoutingStatus
  if (!stepId || !routingId || !status) return { error: 'Data tidak lengkap.' }

  const now = pickedOrNow(formData, 'tanggal')
  const supabase = await createClient()

  const { data: step } = await supabase
    .from('routing_history')
    .select('started_at')
    .eq('id', stepId)
    .maybeSingle()

  const { error } = await supabase
    .from('routing_history')
    .update({
      status,
      // Resuming restarts the clock; the previous run is already recorded in
      // the audit trail.
      started_at: status === 'In Progress' ? now : (step?.started_at ?? null),
      completed_at: null,
      note: nullable(formData, 'note') ?? undefined,
    })
    .eq('id', stepId)

  if (error) return { error: error.message }

  revalidatePath('/routing')
  revalidatePath(`/routing/${routingId}`)
  return { error: null, success: `Tahap di-set ${status}.` }
}

export async function updateRouting(
  _prev: RoutingState,
  formData: FormData,
): Promise<RoutingState> {
  await requirePermission('routing', 'edit')

  const id = text(formData, 'id')
  if (!id) return { error: 'Dokumen tidak dikenali.' }

  const supabase = await createClient()
  const { error } = await supabase
    .from('spk_routing')
    .update({
      document_type: text(formData, 'document_type') || undefined,
      document_number: nullable(formData, 'document_number'),
      notes: nullable(formData, 'notes'),
    })
    .eq('id', id)

  if (error) return { error: error.message }

  revalidatePath('/routing')
  revalidatePath(`/routing/${id}`)
  return { error: null, success: 'Perubahan tersimpan.' }
}
