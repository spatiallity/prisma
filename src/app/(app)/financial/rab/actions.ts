'use server'

import { revalidatePath } from 'next/cache'
import { createClient } from '@/lib/supabase/server'
import { requirePermission } from '@/lib/auth/session'
import type { FinanceCategory, FinanceTransactionRow } from '@/lib/supabase/types'

export type FinanceTxState = { error: string | null; success?: string }

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

/** kode_akun for these three kategori is fixed by the app, never chosen by the user. */
const FIXED_AKUN: Partial<Record<FinanceCategory, string>> = {
  sppd: '3.1.2',
  mcu: '1.6.1',
}
const GAJI_AKUN: Record<'Upah' | 'Tunjangan', string> = {
  Upah: '1.7.1',
  Tunjangan: '1.7.3',
}

/** Shared by insert and update — same fields, same validation either way. */
function parseTransactionFields(formData: FormData) {
  const kategori = text(formData, 'kategori') as FinanceCategory
  const tanggal = text(formData, 'tanggal')
  const jumlah = money(formData, 'jumlah')
  const jenisDetail = nullable(formData, 'jenis_detail')

  if (!kategori) return { error: 'Kategori wajib dipilih.' } as const
  if (!tanggal) return { error: 'Tanggal wajib diisi.' } as const
  if (jumlah === null || jumlah <= 0) return { error: 'Jumlah harus lebih dari nol.' } as const

  let kodeAkun = FIXED_AKUN[kategori] ?? null
  if (kategori === 'gaji_ptt') {
    if (jenisDetail !== 'Upah' && jenisDetail !== 'Tunjangan') {
      return { error: 'Jenis (Upah/Tunjangan) wajib dipilih.' } as const
    }
    kodeAkun = GAJI_AKUN[jenisDetail]
  }
  if (!kodeAkun) {
    kodeAkun = text(formData, 'kode_akun') || null
    if (!kodeAkun) return { error: 'Kode akun wajib dipilih.' } as const
  }

  return {
    error: null,
    kategori,
    kodeAkun,
    tanggal,
    jumlah,
    jenisDetail,
  } as const
}

/**
 * One action for every kategori — the Excel-tab origin only changes which
 * kode_akun is allowed and which extra fields apply, not the shape of the row.
 */
export async function saveFinanceTransaction(
  _prev: FinanceTxState,
  formData: FormData,
): Promise<FinanceTxState> {
  const user = await requirePermission('spending', 'edit')

  const parsed = parseTransactionFields(formData)
  if (parsed.error) return { error: parsed.error }
  const { kategori, kodeAkun, tanggal, jumlah, jenisDetail } = parsed

  const supabase = await createClient()

  // The chosen kode_akun must be a real leaf in the Chart of Accounts.
  const { data: akun } = await supabase
    .from('chart_of_accounts')
    .select('kode_akun')
    .eq('kode_akun', kodeAkun)
    .maybeSingle()
  if (!akun) return { error: 'Kode akun tidak dikenali.' }

  const { error } = await supabase.from('finance_transactions').insert({
    kategori,
    kode_akun: kodeAkun,
    tanggal,
    // Kept only because v_finance_realisasi_bulanan groups by it — always
    // derived from tanggal now, never typed by the user (Excel's month
    // column was a lookup convenience, not a separate fact).
    bulan: `${tanggal.slice(0, 7)}-01`,
    jumlah,
    deskripsi: nullable(formData, 'deskripsi'),
    no_bukti: nullable(formData, 'no_bukti'),
    personil_nama: nullable(formData, 'personil_nama'),
    jenis_detail: kategori === 'gaji_ptt' ? jenisDetail : null,
    created_by: user.id,
  })

  if (error) return { error: error.message }

  revalidatePath('/financial/rab')
  revalidatePath(`/financial/${kategori.replace(/_/g, '-')}`)
  return { error: null, success: 'Transaksi tersimpan.' }
}

/** Same fields as create — corrects a typo/wrong amount without touching audit history's row identity. */
export async function updateFinanceTransaction(
  _prev: FinanceTxState,
  formData: FormData,
): Promise<FinanceTxState> {
  await requirePermission('spending', 'edit')

  const id = text(formData, 'id')
  if (!id) return { error: 'Transaksi tidak dikenali.' }

  const parsed = parseTransactionFields(formData)
  if (parsed.error) return { error: parsed.error }
  const { kategori, kodeAkun, tanggal, jumlah, jenisDetail } = parsed

  const supabase = await createClient()

  const { data: akun } = await supabase
    .from('chart_of_accounts')
    .select('kode_akun')
    .eq('kode_akun', kodeAkun)
    .maybeSingle()
  if (!akun) return { error: 'Kode akun tidak dikenali.' }

  const { error } = await supabase
    .from('finance_transactions')
    .update({
      kategori,
      kode_akun: kodeAkun,
      tanggal,
      bulan: `${tanggal.slice(0, 7)}-01`,
      jumlah,
      deskripsi: nullable(formData, 'deskripsi'),
      no_bukti: nullable(formData, 'no_bukti'),
      personil_nama: nullable(formData, 'personil_nama'),
      jenis_detail: kategori === 'gaji_ptt' ? jenisDetail : null,
    })
    .eq('id', id)

  if (error) return { error: error.message }

  revalidatePath('/financial/rab')
  revalidatePath(`/financial/${kategori.replace(/_/g, '-')}`)
  return { error: null, success: 'Perubahan tersimpan.' }
}

/**
 * Drill-down behind clicking a row in the per-kode-akun summary — same
 * filter the page itself is under (all-time, or one bulan).
 */
export async function getTransactionsByAkun(
  kodeAkun: string,
  bulan?: string,
): Promise<FinanceTransactionRow[]> {
  await requirePermission('spending', 'view')

  const supabase = await createClient()
  let query = supabase
    .from('finance_transactions')
    .select('*')
    .eq('kode_akun', kodeAkun)
    .eq('status', 'Active')
    .order('tanggal', { ascending: false, nullsFirst: false })

  if (bulan) query = query.eq('bulan', `${bulan}-01`)

  const { data } = await query
  return data ?? []
}

export type DeleteState = { error: string | null }

/** Hard delete — migration 0017 grants this per-row via has_perm('spending','edit'). */
export async function deleteFinanceTransaction(
  _prev: DeleteState,
  formData: FormData,
): Promise<DeleteState> {
  await requirePermission('spending', 'edit')

  const id = text(formData, 'id')
  if (!id) return { error: 'Transaksi tidak dikenali.' }

  const supabase = await createClient()
  const { error } = await supabase.from('finance_transactions').delete().eq('id', id)
  if (error) return { error: error.message }

  revalidatePath('/financial/rab')
  revalidatePath('/financial/umk')
  revalidatePath('/financial/sppd')
  revalidatePath('/financial/ppbj-barang')
  revalidatePath('/financial/ppbj-jasa')
  revalidatePath('/financial/mcu')
  revalidatePath('/financial/gaji-ptt')
  return { error: null }
}
