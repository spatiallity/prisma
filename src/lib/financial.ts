import type { FinancialDocStatus, VendorPaymentStatus } from '@/lib/supabase/types'

/** Section 25 — the five revenue documents, in the order they are produced. */
export type RevenueKind = 'contract' | 'opname' | 'pad' | 'invoice' | 'payment'

export const REVENUE_KINDS: RevenueKind[] = [
  'contract',
  'opname',
  'pad',
  'invoice',
  'payment',
]

type RevenueMeta = {
  /** Section 7 menu wording. */
  label: string
  /** Route segment under /financial. */
  slug: string
  /** Which Section 6 module governs it — each document has its own. */
  module: 'contract' | 'opname' | 'pad' | 'invoice' | 'payment'
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
  opname: {
    label: 'Opname',
    slug: 'opname',
    module: 'opname',
    section: '25.2',
    description: 'Nilai pekerjaan terukur per periode.',
    numberLabel: 'Nomor opname',
    valueLabel: 'Nilai opname',
    dateLabel: 'Tanggal opname',
  },
  pad: {
    label: 'PAD',
    slug: 'pad',
    module: 'pad',
    section: '25.3',
    description: 'Pengakuan pendapatan atas opname yang sudah disetujui.',
    numberLabel: 'Nomor PAD',
    valueLabel: 'Nilai PAD',
    dateLabel: 'Tanggal PAD',
  },
  invoice: {
    label: 'Invoice',
    slug: 'invoice',
    module: 'invoice',
    section: '25.4',
    description:
      'Nilai tagihan. Angka inilah yang dipakai sebagai pendapatan dalam perhitungan margin (Section 26.2).',
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

export const VENDOR_PAYMENT_TONE: Record<
  VendorPaymentStatus,
  'neutral' | 'success' | 'warning' | 'danger'
> = {
  'Belum Dibayar': 'danger',
  Sebagian: 'warning',
  Lunas: 'success',
}

/**
 * Section 26.2 — a thin margin is not automatically a problem while the SPK is
 * still being invoiced, so the tone stays advisory rather than alarming.
 */
export function marginTone(
  percent: number | null,
): 'neutral' | 'success' | 'warning' | 'danger' {
  if (percent === null) return 'neutral'
  if (percent < 0) return 'danger'
  if (percent < 10) return 'warning'
  return 'success'
}

/** −12,4% — margin percentages carry a sign and one decimal. */
export function formatPercentSigned(value: number | null | undefined) {
  if (value === null || value === undefined) return '—'
  const formatted = new Intl.NumberFormat('id-ID', {
    maximumFractionDigits: 1,
    signDisplay: 'exceptZero',
  }).format(value)
  return `${formatted}%`
}
