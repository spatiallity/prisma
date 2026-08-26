'use server'

import { revalidatePath } from 'next/cache'
import { createClient } from '@/lib/supabase/server'
import { requirePermission } from '@/lib/auth/session'
import { REVENUE_META, type RevenueKind } from '@/lib/financial'
import type {
  FinancialDocStatus,
  PersonnelCostType,
  RecordStatus,
  VendorPaymentTermType,
} from '@/lib/supabase/types'

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
  revalidatePath('/financial/margin')
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
  revalidatePath('/financial/margin')
  return { error: null, success: `Status diubah menjadi ${status}.` }
}

// --- Cash ledger (Section 25.6.1) -------------------------------------------

/**
 * The running balance is not stored — v_cash_ledger computes it with a window
 * function (Section 4.3), so a back-dated correction cannot leave the ledger
 * out of balance the way the manual spreadsheet did.
 */
export async function saveCashEntry(
  _prev: FinancialState,
  formData: FormData,
): Promise<FinancialState> {
  const user = await requirePermission('spending', 'edit')

  const entryDate = text(formData, 'entry_date')
  const direction = text(formData, 'direction')
  const amount = money(formData, 'amount')

  if (!entryDate) return { error: 'Tanggal wajib diisi.' }
  if (amount === null || amount <= 0) return { error: 'Jumlah harus lebih dari nol.' }

  const supabase = await createClient()
  const { error } = await supabase.from('cash_ledger').insert({
    entry_date: entryDate,
    category_id: nullable(formData, 'category_id'),
    description: nullable(formData, 'description'),
    // The direction check constraint refuses a row with both sides filled.
    amount_out: direction === 'out' ? amount : 0,
    amount_in: direction === 'in' ? amount : 0,
    spk_id: nullable(formData, 'spk_id'),
    pic_name: nullable(formData, 'pic_name'),
    reference: nullable(formData, 'reference'),
    created_by: user.id,
  })

  if (error) return { error: error.message }

  revalidatePath('/financial/spending')
  revalidatePath('/financial/margin')
  return { error: null, success: 'Entri kas tersimpan.' }
}

// --- Personnel cost (Section 25.6.2) ----------------------------------------

export async function savePersonnelCost(
  _prev: FinancialState,
  formData: FormData,
): Promise<FinancialState> {
  const user = await requirePermission('spending', 'edit')

  const personnelId = text(formData, 'personnel_id')
  const period = text(formData, 'period')
  const amount = money(formData, 'amount')

  if (!personnelId || !period) return { error: 'Personel dan periode wajib diisi.' }
  if (amount === null || amount < 0) return { error: 'Jumlah tidak boleh negatif.' }

  const supabase = await createClient()
  const { error } = await supabase.from('personnel_costs').insert({
    personnel_id: personnelId,
    cost_type: text(formData, 'cost_type') as PersonnelCostType,
    period,
    amount,
    // Left NULL the cost is team overhead, not charged to any SPK margin.
    spk_id: nullable(formData, 'spk_id'),
    description: nullable(formData, 'description'),
    created_by: user.id,
  })

  if (error) return { error: error.message }

  revalidatePath('/financial/spending')
  revalidatePath('/financial/margin')
  return { error: null, success: 'Biaya personel tersimpan.' }
}

// --- Vendor payment (Section 25.6.3) ----------------------------------------

export async function saveVendorPayment(
  _prev: FinancialState,
  formData: FormData,
): Promise<FinancialState> {
  const user = await requirePermission('spending', 'edit')

  const spkId = text(formData, 'spk_id')
  const vendorId = text(formData, 'vendor_id')
  const contractValue = money(formData, 'contract_value')
  const percentage = money(formData, 'agreed_percentage')

  if (!spkId || !vendorId) return { error: 'SPK dan vendor wajib dipilih.' }
  if (contractValue === null || contractValue < 0) {
    return { error: 'Nilai kontrak tidak boleh negatif.' }
  }
  if (percentage === null || percentage < 0 || percentage > 100) {
    return { error: 'Persentase borongan harus antara 0 dan 100.' }
  }

  const supabase = await createClient()
  // vendor_payable is a generated column — the database multiplies, not the app.
  const { error } = await supabase.from('vendor_payments').insert({
    spk_id: spkId,
    vendor_id: vendorId,
    contract_value: contractValue,
    agreed_percentage: percentage,
    notes: nullable(formData, 'notes'),
    created_by: user.id,
  })

  if (error) {
    return {
      error:
        error.code === '23505'
          ? 'Vendor ini sudah punya perjanjian borongan pada SPK tersebut.'
          : error.message,
    }
  }

  revalidatePath('/financial/spending')
  revalidatePath('/financial/margin')
  revalidatePath(`/spk/${spkId}`)
  return { error: null, success: 'Perjanjian borongan tersimpan.' }
}

/**
 * Instalments roll up into vendor_payments.amount_paid through the trigger in
 * migration 0009, which also derives the Belum Dibayar / Sebagian / Lunas
 * status. Nothing here writes either.
 */
export async function saveVendorPaymentTerm(
  _prev: FinancialState,
  formData: FormData,
): Promise<FinancialState> {
  const user = await requirePermission('spending', 'edit')

  const parentId = text(formData, 'vendor_payment_id')
  const amount = money(formData, 'amount')
  if (!parentId) return { error: 'Perjanjian borongan tidak dikenali.' }
  if (amount === null || amount < 0) return { error: 'Jumlah tidak boleh negatif.' }

  const sequenceRaw = text(formData, 'sequence')
  const sequence = sequenceRaw ? Number(sequenceRaw) : 1

  const supabase = await createClient()
  const { error } = await supabase.from('vendor_payment_terms').insert({
    vendor_payment_id: parentId,
    term_type: text(formData, 'term_type') as VendorPaymentTermType,
    sequence: Number.isInteger(sequence) && sequence > 0 ? sequence : 1,
    amount,
    due_date: nullable(formData, 'due_date'),
    paid_date: nullable(formData, 'paid_date'),
    reference: nullable(formData, 'reference'),
    created_by: user.id,
  })

  if (error) {
    return {
      error:
        error.code === '23505'
          ? 'Termin dengan jenis dan urutan itu sudah ada.'
          : error.message,
    }
  }

  revalidatePath('/financial/spending')
  revalidatePath('/financial/margin')
  return { error: null, success: 'Termin tersimpan.' }
}

/** Marking a term paid is what moves the parent to Sebagian or Lunas. */
export async function setTermPaid(
  _prev: FinancialState,
  formData: FormData,
): Promise<FinancialState> {
  await requirePermission('spending', 'edit')

  const id = text(formData, 'id')
  const paidDate = nullable(formData, 'paid_date')
  if (!id) return { error: 'Termin tidak dikenali.' }

  const supabase = await createClient()
  const { error } = await supabase
    .from('vendor_payment_terms')
    .update({ paid_date: paidDate })
    .eq('id', id)

  if (error) return { error: error.message }

  revalidatePath('/financial/spending')
  revalidatePath('/financial/margin')
  return {
    error: null,
    success: paidDate ? 'Termin ditandai lunas.' : 'Tanda lunas dibatalkan.',
  }
}

export async function setSpendingStatus(
  _prev: FinancialState,
  formData: FormData,
): Promise<FinancialState> {
  await requirePermission('spending', 'edit')

  const id = text(formData, 'id')
  const kind = text(formData, 'kind')
  const status = text(formData, 'status') as RecordStatus
  if (!id || !status) return { error: 'Data tidak lengkap.' }

  const supabase = await createClient()
  const table = kind === 'cash' ? 'cash_ledger' : 'personnel_costs'
  const { error } = await supabase.from(table).update({ status }).eq('id', id)
  if (error) return { error: error.message }

  revalidatePath('/financial/spending')
  revalidatePath('/financial/margin')
  return { error: null, success: `Entri di-set ${status}.` }
}
