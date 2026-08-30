'use server'

import { revalidatePath } from 'next/cache'
import { createClient } from '@/lib/supabase/server'
import { requirePermission } from '@/lib/auth/session'
import { REVENUE_META, type RevenueKind } from '@/lib/financial'
import type { FinancialDocStatus } from '@/lib/supabase/types'

export type FinancialState = { error: string | null; success?: string }

function text(formData: FormData, key: string) {
  const value = formData.get(key)
  return typeof value === 'string' ? value.trim() : ''
}

function nullable(formData: FormData, key: string) {
  return text(formData, key) || null
}

/** Rupiah arrives with thousand dots and a decimal comma. */
function money(formData: FormData, key: string) {
  const raw = text(formData, key)
  if (!raw) return null
  const parsed = Number(raw.replace(/\./g, '').replace(',', '.'))
  return Number.isFinite(parsed) ? parsed : null
}

// --- Revenue documents (Section 25.1-25.5) ----------------------------------

/**
 * One action for all five documents. They differ only in which table and which
 * column names carry the number, the value and the date, so the differences
 * live in this switch rather than in five near-identical files.
 */
export async function saveRevenueDoc(
  _prev: FinancialState,
  formData: FormData,
): Promise<FinancialState> {
  const kind = text(formData, 'kind') as RevenueKind
  const meta = REVENUE_META[kind]
  if (!meta) return { error: 'Jenis dokumen tidak dikenali.' }

  const user = await requirePermission(meta.module, 'edit')

  const spkId = text(formData, 'spk_id')
  const value = money(formData, 'value')
  const status = (text(formData, 'status') || 'Draft') as FinancialDocStatus

  if (!spkId) return { error: 'SPK wajib dipilih.' }
  if (value === null) return { error: `${meta.valueLabel} wajib diisi.` }
  if (value < 0) return { error: `${meta.valueLabel} tidak boleh negatif.` }

  const number = nullable(formData, 'number')
  const date = nullable(formData, 'date')
  const notes = nullable(formData, 'notes')
  const supabase = await createClient()

  let error: { message: string; code?: string } | null = null

  switch (kind) {
    case 'contract': {
      if (!number) return { error: 'Nomor kontrak wajib diisi.' }
      const amendmentRaw = text(formData, 'amendment_no')
      const amendment = amendmentRaw ? Number(amendmentRaw) : 0
      if (!Number.isInteger(amendment) || amendment < 0) {
        return { error: 'Nomor amandemen harus bilangan bulat >= 0.' }
      }
      ;({ error } = await supabase.from('contracts').insert({
        spk_id: spkId,
        contract_number: number,
        contract_value: value,
        contract_date: date,
        amendment_no: amendment,
        status,
        notes,
        created_by: user.id,
      }))
      break
    }
    case 'opname':
      ;({ error } = await supabase.from('opnames').insert({
        spk_id: spkId,
        opname_number: number,
        opname_value: value,
        opname_date: date,
        period_start: nullable(formData, 'period_start'),
        period_end: nullable(formData, 'period_end'),
        status,
        notes,
        created_by: user.id,
      }))
      break
    case 'pad':
      ;({ error } = await supabase.from('pad').insert({
        spk_id: spkId,
        opname_id: nullable(formData, 'parent_id'),
        pad_number: number,
        pad_value: value,
        pad_date: date,
        status,
        notes,
        created_by: user.id,
      }))
      break
    case 'invoice':
      ;({ error } = await supabase.from('invoices').insert({
        spk_id: spkId,
        pad_id: nullable(formData, 'parent_id'),
        invoice_number: number,
        invoice_value: value,
        invoice_date: date,
        due_date: nullable(formData, 'due_date'),
        status,
        notes,
        created_by: user.id,
      }))
      break
    case 'payment':
      ;({ error } = await supabase.from('payments').insert({
        spk_id: spkId,
        invoice_id: nullable(formData, 'parent_id'),
        payment_value: value,
        payment_date: date,
        reference: number,
        status,
        notes,
        created_by: user.id,
      }))
      break
  }

  if (error) {
    return {
      error:
        error.code === '23505'
          ? 'Nomor dokumen ini sudah ada untuk SPK tersebut.'
          : error.message,
    }
  }

  revalidatePath(`/financial/${meta.slug}`)
  revalidatePath(`/spk/${spkId}`)
  return { error: null, success: `${meta.label} tersimpan.` }
}

/** Section 4.4 — a wrong document is cancelled, never deleted. */
export async function setRevenueDocStatus(
  _prev: FinancialState,
  formData: FormData,
): Promise<FinancialState> {
  const kind = text(formData, 'kind') as RevenueKind
  const meta = REVENUE_META[kind]
  if (!meta) return { error: 'Jenis dokumen tidak dikenali.' }

  await requirePermission(meta.module, 'edit')

  const id = text(formData, 'id')
  const status = text(formData, 'status') as FinancialDocStatus
  if (!id || !status) return { error: 'Data tidak lengkap.' }

  const table =
    kind === 'contract'
      ? 'contracts'
      : kind === 'opname'
        ? 'opnames'
        : kind === 'pad'
          ? 'pad'
          : kind === 'invoice'
            ? 'invoices'
            : 'payments'

  const supabase = await createClient()
  const { error } = await supabase.from(table).update({ status }).eq('id', id)
  if (error) return { error: error.message }

  revalidatePath(`/financial/${meta.slug}`)
  return { error: null, success: `Status diubah menjadi ${status}.` }
}

/** Hard delete — migration 0017. Blocked by FK if a later document in the chain still points at this row. */
export async function deleteRevenueDoc(
  _prev: FinancialState,
  formData: FormData,
): Promise<FinancialState> {
  const kind = text(formData, 'kind') as RevenueKind
  const meta = REVENUE_META[kind]
  if (!meta) return { error: 'Jenis dokumen tidak dikenali.' }

  await requirePermission(meta.module, 'edit')

  const id = text(formData, 'id')
  const spkId = text(formData, 'spk_id')
  if (!id) return { error: 'Data tidak lengkap.' }

  const table =
    kind === 'contract'
      ? 'contracts'
      : kind === 'opname'
        ? 'opnames'
        : kind === 'pad'
          ? 'pad'
          : kind === 'invoice'
            ? 'invoices'
            : 'payments'

  const supabase = await createClient()
  const { error } = await supabase.from(table).delete().eq('id', id)
  if (error) {
    return {
      error:
        error.code === '23503'
          ? `${meta.label} ini masih ditautkan dokumen lain — hapus itu dulu.`
          : error.message,
    }
  }

  revalidatePath(`/financial/${meta.slug}`)
  if (spkId) revalidatePath(`/spk/${spkId}`)
  return { error: null }
}
