'use server'

import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { requirePermission } from '@/lib/auth/session'
import type { FinancialDocStatus, RoutingStatus } from '@/lib/supabase/types'

export type RoutingState = { error: string | null; success?: string }

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
    .select('status')
    .eq('id', spkId)
    .maybeSingle()

  if (!spk) return { error: 'SPK tidak ditemukan.' }
  if (spk.status !== 'Draft' && spk.status !== 'On Going') {
    return { error: 'Hanya SPK Draft atau Sedang Berjalan yang dapat dibuatkan routing.' }
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

  const startedAt = pickedOrNull(formData, 'tanggal')
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
    started_at: index === 0 ? startedAt : null,
    created_by: user.id,
  }))

  const { error: historyError } = await supabase.from('routing_history').insert(rows)
  if (historyError) return { error: historyError.message }

  revalidatePath('/routing')
  revalidatePath(`/spk/${spkId}`)
  // Stay on Routing Monitor and open the new document there, so Opname/PAD
  // and routing stages can be filled without another page transition.
  redirect(`/routing?open=${routing.id}`)
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

  const completedAt = pickedOrNull(formData, 'tanggal')

  const { error: completeError } = await supabase
    .from('routing_history')
    .update({
      status: 'Completed',
      // A stage returned and resumed may never have been started.
      started_at: current.started_at ?? completedAt,
      completed_at: completedAt,
      pic_name: nullable(formData, 'pic_name') ?? undefined,
      note: nullable(formData, 'note') ?? undefined,
    })
    .eq('id', stepId)

  if (completeError) return { error: completeError.message }

  const next = (steps ?? []).find((s) => s.sequence > current.sequence)
  if (next) {
    const { error: nextError } = await supabase
      .from('routing_history')
      .update({ status: 'In Progress', started_at: completedAt })
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
 *  - "lanjut": closes the step, with an optional completion date.
 *  - "simpan": keeps the step in progress while correcting its fields.
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
  const user = await requirePermission('routing', 'edit')

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

  // Invoice remains one routing stage. It may be saved as In Progress with a
  // start date, then becomes Invoiced once its finish date and invoice value
  // are recorded.
  if (step.step_name === 'Invoiced') {
    const startedAt = pickedOrNull(formData, 'started_at')
    const completeInvoice = text(formData, 'invoice_complete') === '1'

    if (!completeInvoice) {
      const { error } = await supabase
        .from('routing_history')
        .update({
          status: 'In Progress' satisfies RoutingStatus,
          started_at: startedAt,
          completed_at: null,
          pic_name: nullable(formData, 'pic_name') ?? undefined,
          note: nullable(formData, 'note') ?? undefined,
        })
        .eq('id', stepId)
      if (error) return { error: error.message }

      revalidatePath('/routing')
      revalidatePath(`/routing/${routingId}`)
      return { error: null, success: 'Progres invoice disimpan.' }
    }

    const invoiceNumber = nullable(formData, 'invoice_number')
    const invoiceValueRaw = nullable(formData, 'invoice_value')
    const invoiceDate = nullable(formData, 'invoice_date')
    const completedRaw = text(formData, 'completed_at')
    if (!invoiceValueRaw) {
      return { error: 'Nilai invoice wajib diisi.' }
    }

    const completedAt = pickedOrNull(formData, 'completed_at')
    if (completedAt && startedAt && completedAt < startedAt) return { error: 'Tanggal selesai tidak boleh sebelum tanggal mulai.' }
    const { error } = await supabase
      .from('routing_history')
      .update({
        status: 'Completed' satisfies RoutingStatus,
        started_at: startedAt,
        completed_at: completedAt,
        pic_name: nullable(formData, 'pic_name') ?? undefined,
        note: nullable(formData, 'note') ?? undefined,
        invoice_number: invoiceNumber,
        invoice_value: Number(invoiceValueRaw),
        invoice_date: invoiceDate,
      })
      .eq('id', stepId)
    if (error) return { error: error.message }

    const dendaRaw = nullable(formData, 'denda_value')
    const { data: routingDoc } = await supabase
      .from('spk_routing')
      .select('spk_id')
      .eq('id', routingId)
      .maybeSingle()
    if (routingDoc) {
      // The terminal routing step and the finance invoice represent the same
      // business event. Keep the two records in lockstep rather than leaving
      // Detail SPK to infer an invoice from routing history.
      const { data: existingInvoice, error: existingInvoiceError } = await supabase
        .from('invoices')
        .select('id, invoice_number, invoice_date')
        .eq('spk_id', routingDoc.spk_id)
        .neq('status', 'Cancelled')
        .maybeSingle()
      if (existingInvoiceError) return { error: existingInvoiceError.message }

      const invoicePayload = {
        invoice_number: invoiceNumber ?? existingInvoice?.invoice_number ?? null,
        invoice_value: Number(invoiceValueRaw),
        invoice_date:
          invoiceDate ??
          (completedAt ? completedAt.slice(0, 10) : null) ??
          existingInvoice?.invoice_date ??
          null,
        status: 'Approved' as FinancialDocStatus,
      }

      const { error: invoiceError } = existingInvoice
        ? await supabase.from('invoices').update(invoicePayload).eq('id', existingInvoice.id)
        : await supabase.from('invoices').insert({
            ...invoicePayload,
            spk_id: routingDoc.spk_id,
            created_by: user.id,
          })
      if (invoiceError) return { error: invoiceError.message }

      const { error: spkError } = await supabase
        .from('spks')
        // Invoiced is the terminal routing state. Older records may not have
        // survey/check dates recorded, but a completed invoice is still the
        // authoritative sign that the project itself is finished.
        .update({ status: 'Selesai', denda_value: dendaRaw ? Number(dendaRaw) : null })
        .eq('id', routingDoc.spk_id)
      if (spkError) return { error: spkError.message }
    }

    revalidatePath('/routing')
    revalidatePath(`/routing/${routingId}`)
    revalidatePath('/reports/financial')
    revalidatePath('/spk')
    revalidatePath('/spk/progress')
    if (routingDoc) revalidatePath(`/spk/${routingDoc.spk_id}`)
    return { error: null, success: 'Invoice disimpan.' }
  }

  const startedAt = pickedOrNull(formData, 'started_at')

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

  // Saving an open stage is deliberately separate from advancing it: users
  // often need to correct its PIC, start date, or note before it is ready to
  // be completed. Never let the prefilled finish-date input close the stage.
  if (decision === 'simpan') {
    const { error } = await supabase
      .from('routing_history')
      .update({
        started_at: startedAt,
        completed_at: null,
        status: 'In Progress' satisfies RoutingStatus,
        pic_name: nullable(formData, 'pic_name') ?? undefined,
        note: nullable(formData, 'note') ?? undefined,
      })
      .eq('id', stepId)
    if (error) return { error: error.message }

    revalidatePath('/routing')
    revalidatePath(`/routing/${routingId}`)
    return { error: null, success: 'Perubahan tahap disimpan.' }
  }

  const completedRaw = text(formData, 'completed_at')
  const completedAt = completedRaw ? new Date(`${completedRaw}T12:00:00`).toISOString() : null
  if (completedAt && startedAt && completedAt < startedAt) {
    return { error: 'Tanggal selesai tidak boleh sebelum tanggal mulai.' }
  }
  const status: RoutingStatus = decision === 'lanjut' ? 'Completed' : 'In Progress'

  const { error } = await supabase
    .from('routing_history')
    .update({
      started_at: startedAt,
      completed_at: completedAt,
      status,
      pic_name: nullable(formData, 'pic_name') ?? undefined,
      note: nullable(formData, 'note') ?? undefined,
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

/**
 * Clears the active routing stage and reopens the one immediately before it.
 * Routing history is pre-created for every template step, so this is a reset
 * of one step, not a row deletion: the document retains its full route.
 */
export async function rollbackRoutingStep(
  _prev: RoutingState,
  formData: FormData,
): Promise<RoutingState> {
  await requirePermission('routing', 'edit')

  const routingId = text(formData, 'routing_id')
  const stepId = text(formData, 'step_id')
  if (!routingId || !stepId) return { error: 'Tahap tidak dikenali.' }

  const supabase = await createClient()
  const { data: routing, error: routingError } = await supabase
    .from('spk_routing')
    .select('spk_id')
    .eq('id', routingId)
    .maybeSingle()
  if (routingError) return { error: routingError.message }
  if (!routing) return { error: 'Dokumen routing tidak ditemukan.' }

  const { data: steps, error: stepsError } = await supabase
    .from('routing_history')
    .select('id, sequence, step_name, status')
    .eq('spk_routing_id', routingId)
    .order('sequence')
  if (stepsError) return { error: stepsError.message }
  if (!steps?.length) return { error: 'Tahap routing tidak ditemukan.' }

  const firstOpenIndex = steps.findIndex((step) => step.status !== 'Completed')
  const currentIndex = firstOpenIndex === -1 ? steps.length - 1 : firstOpenIndex
  const current = steps[currentIndex]
  const previous = steps[currentIndex - 1]
  if (!previous) return { error: 'Tahap pertama tidak dapat dibatalkan.' }
  if (current.id !== stepId) return { error: 'Hanya tahap yang sedang berjalan yang dapat dibatalkan.' }

  const { error: revisionError } = await supabase
    .from('routing_step_revisions')
    .delete()
    .eq('routing_history_id', current.id)
  if (revisionError) return { error: revisionError.message }

  const { error: clearError } = await supabase
    .from('routing_history')
    .update({
      status: 'Pending' satisfies RoutingStatus,
      started_at: null,
      completed_at: null,
      pic_name: null,
      note: null,
      invoice_number: null,
      invoice_value: null,
      invoice_date: null,
    })
    .eq('id', current.id)
  if (clearError) return { error: clearError.message }

  const { error: reopenError } = await supabase
    .from('routing_history')
    .update({ status: 'In Progress' satisfies RoutingStatus, completed_at: null })
    .eq('id', previous.id)
  if (reopenError) return { error: reopenError.message }

  if (current.step_name === 'Invoiced') {
    const [{ error: invoiceError }, { error: spkError }] = await Promise.all([
      supabase
        .from('invoices')
        .update({ status: 'Submitted' as FinancialDocStatus })
        .eq('spk_id', routing.spk_id)
        .neq('status', 'Cancelled'),
      supabase
        .from('spks')
        .update({ status: 'On Going', denda_value: null })
        .eq('id', routing.spk_id),
    ])
    if (invoiceError) return { error: invoiceError.message }
    if (spkError) return { error: spkError.message }
  }

  revalidatePath('/routing')
  revalidatePath(`/routing/${routingId}`)
  revalidatePath('/reports/financial')
  revalidatePath('/spk')
  revalidatePath('/spk/progress')
  revalidatePath(`/spk/${routing.spk_id}`)
  return { error: null, success: `Tahap dibatalkan. Kembali ke ${previous.step_name}.` }
}
