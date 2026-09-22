import type { FinanceCategory, FinancialDocStatus } from '@/lib/supabase/types'

/**
 * Section 25 — the revenue documents still tracked as full documents.
 * Opname and PAD (formerly 25.2/25.3) are now just a mark on the SPK itself
 * (migration 0018) — see opname_marked_at/pad_marked_at on spks.
 */
export type RevenueKind = 'contract' | 'invoice' | 'payment'

export const REVENUE_KINDS: RevenueKind[] = ['contract', 'invoice', 'payment']

type RevenueMeta = {
  /** Section 7 menu wording. */
  label: string
  /** Route segment under /financial. */
  slug: string
  /** Which Section 6 module governs it — each document has its own. */
  module: 'contract' | 'invoice' | 'payment'
  section: string
  description: string
  numberLabel: string
  valueLabel: string
  dateLabel: string
}

export const REVENUE_META: Record<RevenueKind, RevenueMeta> = {
  contract: {
    label: 'Contract',
    slug: 'contract',
    module: 'contract',
    section: '25.1',
    description:
      'Nilai kontrak per SPK beserta amandemennya. Amandemen dicatat sebagai baris tersendiri, bukan menimpa nilai lama.',
    numberLabel: 'Nomor kontrak',
    valueLabel: 'Nilai kontrak',
    dateLabel: 'Tanggal kontrak',
  },
  invoice: {
    label: 'Invoice',
    slug: 'invoice',
    module: 'invoice',
    section: '25.4',
    description: 'Nilai tagihan per SPK.',
    numberLabel: 'Nomor invoice',
    valueLabel: 'Nilai invoice',
    dateLabel: 'Tanggal invoice',
  },
  payment: {
    label: 'Payment',
    slug: 'payment',
    module: 'payment',
    section: '25.5',
    description: 'Pembayaran yang diterima atas sebuah invoice.',
    numberLabel: 'Referensi',
    valueLabel: 'Nilai pembayaran',
    dateLabel: 'Tanggal pembayaran',
  },
}

export const DOC_STATUS_TONE: Record<
  FinancialDocStatus,
  'neutral' | 'primary' | 'success' | 'warning' | 'danger'
> = {
  Draft: 'neutral',
  Submitted: 'primary',
  Approved: 'success',
  Rejected: 'danger',
  Cancelled: 'neutral',
}

export const DOC_STATUS_OPTIONS: { value: FinancialDocStatus; label: string }[] = [
  { value: 'Draft', label: 'Draft' },
  { value: 'Submitted', label: 'Sedang Berjalan' },
  { value: 'Approved', label: 'Selesai' },
  { value: 'Cancelled', label: 'Dibatalkan' },
]

export function financialStatusLabel(status: FinancialDocStatus) {
  switch (status) {
    case 'Submitted':
      return 'Sedang Berjalan'
    case 'Approved':
      return 'Selesai'
    case 'Rejected':
    case 'Cancelled':
      return 'Dibatalkan'
    default:
      return 'Draft'
  }
}

export function financialDisplayStatus(
  status: FinancialDocStatus,
  _opts?: { invoiceDate?: string | null },
) {
  // Invoice dates are optional, so an approved invoice must remain finished
  // even when its date has not been recorded yet.
  return status
}

/** −12,4% — signed percentages carry a sign and one decimal. */
export function formatPercentSigned(value: number | null | undefined) {
  if (value === null || value === undefined) return '—'
  const formatted = new Intl.NumberFormat('id-ID', {
    maximumFractionDigits: 1,
    signDisplay: 'exceptZero',
  }).format(value)
  return `${formatted}%`
}

// --- RAB monitoring (migration 20260830000100) -------------------------------

/** Section 7 menu wording — the six Excel tabs, each a finance_transactions kategori. */
export const FINANCE_CATEGORY_META: Record<
  FinanceCategory,
  { label: string; fixedAkun: string | null }
> = {
  umk: { label: 'UMK', fixedAkun: null },
  sppd: { label: 'SPPD', fixedAkun: '3.1.2' },
  ppbj_barang: { label: 'PPBJ Barang', fixedAkun: null },
  ppbj_jasa: { label: 'PPBJ Jasa', fixedAkun: null },
  gaji_ptt: { label: 'Gaji PTT Project', fixedAkun: null },
  mcu: { label: 'MCU', fixedAkun: '1.6.1' },
}

/**
 * A row in chart_of_accounts is a leaf — a real, transactable account — when
 * no other row's kode_akun nests under it. Group rows ('1.2.', '1.2.1', ...)
 * carry the same anggaran_rp as their children, so including them in a sum
 * double-counts the budget.
 */
export function filterLeafAccounts<T extends { kode_akun: string }>(rows: T[]): T[] {
  const codes = rows.map((r) => r.kode_akun)
  return rows.filter(
    (r) => !codes.some((k) => k !== r.kode_akun && k.startsWith(r.kode_akun)),
  )
}

/** '2025-08-01' -> 'Agustus 2025'. */
export function formatMonthLabel(bulan: string) {
  const d = new Date(`${bulan}T00:00:00`)
  if (Number.isNaN(d.getTime())) return bulan
  return new Intl.DateTimeFormat('id-ID', { month: 'long', year: 'numeric' }).format(d)
}

/** '2025-08-01' -> 'Agu 2025' — for chart axes, where the full month name
 *  crowds a dozen-plus categories. */
export function formatMonthLabelShort(bulan: string) {
  const d = new Date(`${bulan}T00:00:00`)
  if (Number.isNaN(d.getTime())) return bulan
  return new Intl.DateTimeFormat('id-ID', { month: 'short', year: 'numeric' }).format(d)
}
