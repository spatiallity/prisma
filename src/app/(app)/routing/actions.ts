'use server'

import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { requirePermission } from '@/lib/auth/session'
import type { RoutingStatus } from '@/lib/supabase/types'
import { canStartRouting } from '@/lib/workflow-rules'

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

  const { data: spk } = await supabase
    .from('spks')
    .select('work_name, work_type, location_type, pad_marked_at')
    .eq('id', spkId)
    .maybeSingle()

  if (!spk) return { error: 'SPK tidak ditemukan.' }
  if (!canStartRouting(spk)) {
    return { error: 'Selesaikan PAD sebelum routing invoice.' }
  }

  const { data: existingRouting } = await supabase
    .from('spk_routing')
    .select('id')
    .eq('spk_id', spkId)
    .limit(1)
  if (existingRouting && existingRouting.length > 0) {
    return { error: 'SPK ini sudah punya dokumen routing.' }
  }

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
 * Section 23 — the popup version of step review. `decision` (set by which
 * button was clicked) tells this apart from a plain field correction:
 *  - "revisi": stays open, status Returned, Catatan required (what needs
 *    fixing) — no separate revision sub-form or table any more.
 *  - "lanjut": closes the step, Tanggal selesai required.
 *  - omitted: a past (already Completed) step's Simpan — just corrects the
 *    fields, status untouched.
 * The previous step must already be Completed — mirrors the gate the
 * popup's accordion enforces client-side, so this can't be raced by opening
 * two steps' forms at once.
 */
export async function updateRoutingStepDates(
  _prev: RoutingState,
  formData: FormData,
): Promise<RoutingState> {
  await requirePermission('routing', 'edit')

  const routingId = text(formData, 'routing_id')
  const stepId = text(formData, 'step_id')
  if (!routingId || !stepId) return { error: 'Tahap tidak dikenali.' }

  const supabase = await createClient()

  const { data: steps, error: readError } = await supabase
    .from('routing_history')
    .select('id, sequence, status, step_name')
    .eq('spk_routing_id', routingId)
    .order('sequence')
  if (readError) return { error: readError.message }

  const index = (steps ?? []).findIndex((s) => s.id === stepId)
  if (index === -1) return { error: 'Tahap tidak ditemukan.' }
  const step = steps![index]
  const previous = index > 0 ? steps![index - 1] : null
  // Gate on status, not completed_at: older, bulk-imported rows can carry
  // status 'Completed' with no completed_at ever recorded.
  if (previous && previous.status !== 'Completed') {
    return { error: 'Selesaikan tahap sebelumnya dulu.' }
  }

  const startedRaw = text(formData, 'started_at')
  if (!startedRaw) return { error: 'Tanggal mulai wajib diisi.' }
  const startedAt = new Date(`${startedRaw}T12:00:00`).toISOString()

  const decision = text(formData, 'decision')

  if (decision === 'revisi') {
    const note = text(formData, 'note')
    if (!note) return { error: 'Catatan wajib diisi kalau masih revisi.' }

    const { error } = await supabase
      .from('routing_history')
      .update({
        started_at: startedAt,
        completed_at: null,
        status: 'Returned' satisfies RoutingStatus,
        pic_name: nullable(formData, 'pic_name') ?? undefined,
        note,
      })
      .eq('id', stepId)
    if (error) return { error: error.message }

    revalidatePath('/routing')
    revalidatePath(`/routing/${routingId}`)
    return { error: null, success: 'Dicatat sebagai revisi.' }
  }

  const completedRaw = text(formData, 'completed_at')
  if (decision === 'lanjut' && !completedRaw) {
    return { error: 'Tanggal selesai wajib diisi.' }
  }
  const completedAt = completedRaw ? new Date(`${completedRaw}T12:00:00`).toISOString() : null
  if (completedAt && completedAt < startedAt) {
    return { error: 'Tanggal selesai tidak boleh sebelum tanggal mulai.' }
  }
  const status: RoutingStatus = completedAt ? 'Completed' : 'In Progress'

  // The Invoiced step's whole point is capturing the invoice itself — closing
  // it without those fields would leave a "Done" badge with nothing behind it.
  const invoiceNumber = nullable(formData, 'invoice_number')
  const invoiceValueRaw = nullable(formData, 'invoice_value')
  const invoiceDate = nullable(formData, 'invoice_date')
  if (step.step_name === 'Invoiced' && completedAt) {
    if (!invoiceNumber || !invoiceValueRaw || !invoiceDate) {
      return { error: 'Nomor invoice, nilai invoice, dan tanggal invoice wajib diisi.' }
    }
  }

  const { error } = await supabase
    .from('routing_history')
    .update({
      started_at: startedAt,
      completed_at: completedAt,
      status,
      pic_name: nullable(formData, 'pic_name') ?? undefined,
      note: nullable(formData, 'note') ?? undefined,
      ...(step.step_name === 'Invoiced'
        ? {
            invoice_number: invoiceNumber,
            invoice_value: invoiceValueRaw ? Number(invoiceValueRaw) : null,
            invoice_date: invoiceDate,
          }
        : {}),
    })
    .eq('id', stepId)
  if (error) return { error: error.message }

  revalidatePath('/routing')
  revalidatePath(`/routing/${routingId}`)
  return { error: null, success: decision === 'lanjut' ? 'Tahap selesai, lanjut ke tahap berikutnya.' : 'Tahap diperbarui.' }
}

/**
 * Section 23 — a review round that isn't ready to pass yet, logged to its
 * own table without moving or closing the step. Superseded in the popup by
 * updateRoutingStepDates' "revisi" decision (one Catatan field, no separate
 * sub-form) — kept here for the standalone /routing/[id] page's older
 * Lanjut/Revisi review form.
 */
export async function addRoutingRevision(
  _prev: RoutingState,
  formData: FormData,
): Promise<RoutingState> {
  const user = await requirePermission('routing', 'edit')

  const stepId = text(formData, 'step_id')
  const routingId = text(formData, 'routing_id')
  const note = text(formData, 'note')
  const resubmitAt = text(formData, 'resubmit_at')
  if (!stepId || !routingId || !note || !resubmitAt) {
    return { error: 'Catatan revisi dan tanggal submit ulang wajib diisi.' }
  }

  const supabase = await createClient()
  const { error } = await supabase.from('routing_step_revisions').insert({
    routing_history_id: stepId,
    note,
    resubmit_at: resubmitAt,
    created_by: user.id,
  })

  if (error) return { error: error.message }

  revalidatePath('/routing')
  revalidatePath(`/routing/${routingId}`)
  return { error: null, success: 'Revisi dicatat.' }
}

/**
 * Wipes a routing document's whole progress (cascades to routing_history and
 * routing_step_revisions), leaving the SPK itself untouched — the user can
 * re-route it fresh via createRouting afterwards.
 */
export async function deleteRouting(
  _prev: RoutingState,
  formData: FormData,
): Promise<RoutingState> {
  await requirePermission('routing', 'edit')

  const routingId = text(formData, 'routing_id')
  if (!routingId) return { error: 'Dokumen routing tidak dikenali.' }

  const supabase = await createClient()

  const { data: routingRow } = await supabase
    .from('spk_routing')
    .select('spk_id')
    .eq('id', routingId)
    .maybeSingle()
  if (!routingRow) return { error: 'Dokumen routing tidak ditemukan.' }

  const { error } = await supabase.from('spk_routing').delete().eq('id', routingId)
  if (error) return { error: error.message }

  revalidatePath('/routing')
  revalidatePath(`/spk/${routingRow.spk_id}`)
  return { error: null }
}
