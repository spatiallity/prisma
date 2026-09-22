import type { Metadata } from 'next'
import type { ReactNode } from 'react'
import { AlertTriangle, FileCheck2, ReceiptText, WalletCards } from 'lucide-react'
import { PageHeader } from '@/components/ui/page-header'
import { Card, CardContent } from '@/components/ui/card'
import { requirePermission } from '@/lib/auth/session'
import { can } from '@/lib/auth/permissions'
import { createClient } from '@/lib/supabase/server'
import { cn, formatRupiah, formatRupiahCompact } from '@/lib/utils'
import { FinancialReportTable, type FinancialRow } from './financial-report-table'

export const metadata: Metadata = { title: 'Financial Report' }

/**
 * Section 26.1 — the money in one place, read live from the SPK itself
 * (Nilai SPK) rather than the old standalone Contract/PAD/Invoice lists:
 * Opname/PAD are the same marks the Design Opname stage and Routing
 * Monitor's PAD column write. Invoiced comes from the completed financial
 * invoice record, which routing keeps synchronized as its final step.
 */
export default async function FinancialReportPage() {
  const user = await requirePermission('report', 'view')
  const mayEdit = can(user.permissions, 'spk', 'edit')

  const supabase = await createClient()

  const [{ data: spks }, { data: invoices }] = await Promise.all([
    supabase
      .from('spks')
      .select('id, spk_number, site_code, status, contract_value, start_date, opname_marked_at, opname_value, pad_marked_at, pad_value, denda_value')
      .order('spk_number'),
    supabase
      .from('invoices')
      .select('spk_id, status, invoice_number, invoice_value, invoice_date')
      .neq('status', 'Cancelled')
      .order('invoice_date', { ascending: false, nullsFirst: false }),
  ])

  const invoiceBySpk = new Map<string, NonNullable<typeof invoices>[number]>()
  for (const invoice of invoices ?? []) {
    const existing = invoiceBySpk.get(invoice.spk_id)
    if (!existing || (invoice.status === 'Approved' && existing.status !== 'Approved')) {
      invoiceBySpk.set(invoice.spk_id, invoice)
    }
  }

  const rows: FinancialRow[] = (spks ?? [])
    .filter((s) => Number(s.contract_value) > 0 || s.opname_marked_at || s.pad_marked_at || Number(s.denda_value) > 0 || invoiceBySpk.has(s.id))
    .map((s) => {
      const invoice = invoiceBySpk.get(s.id)
      return {
        spkId: s.id,
        spkNumber: s.spk_number,
        siteCode: s.site_code,
        status: s.status,
        nilaiSpk: Number(s.contract_value ?? 0),
        tanggalMulai: s.start_date,
        opnameMarkedAt: s.opname_marked_at,
        opnameValue: s.opname_value != null ? Number(s.opname_value) : null,
        padMarkedAt: s.pad_marked_at,
        padValue: s.pad_value != null ? Number(s.pad_value) : null,
        invoiceDone: invoice?.status === 'Approved',
        invoiceNumber: invoice?.status === 'Approved' ? invoice.invoice_number : null,
        invoiceValue: invoice?.status === 'Approved' && invoice.invoice_value != null ? Number(invoice.invoice_value) : null,
        invoiceDate: invoice?.status === 'Approved' ? invoice.invoice_date : null,
        dendaValue: s.denda_value != null ? Number(s.denda_value) : null,
      }
    })

  const totals = rows.reduce(
    (acc, r) => ({
      nilaiSpk: acc.nilaiSpk + r.nilaiSpk,
      opname: acc.opname + (r.opnameValue ?? 0),
      pad: acc.pad + (r.padValue ?? 0),
      invoice: acc.invoice + (r.invoiceValue ?? 0),
      denda: acc.denda + (r.dendaValue ?? 0),
    }),
    { nilaiSpk: 0, opname: 0, pad: 0, invoice: 0, denda: 0 },
  )
  const counts = {
    total: rows.length,
    opname: rows.filter((r) => r.opnameMarkedAt).length,
    pad: rows.filter((r) => r.padMarkedAt).length,
    invoice: rows.filter((r) => r.invoiceDone).length,
    denda: rows.filter((r) => (r.dendaValue ?? 0) > 0).length,
  }
  const invoicePercent = counts.total > 0 ? Math.round((counts.invoice / counts.total) * 100) : 0

  return (
    <>
      <PageHeader
        title="Laporan Keuangan SPK"
        description="Ringkasan nilai kontrak, opname, PAD, denda, dan invoiced dari data SPK yang sedang dipantau."
      />

      <div className="mb-5 grid gap-4 lg:grid-cols-[1.4fr_1fr_1fr_1fr]">
        <Stat
          label="Nilai SPK"
          value={formatRupiahCompact(totals.nilaiSpk)}
          helper={`${counts.total} SPK tercatat`}
          detail={formatRupiah(totals.nilaiSpk)}
          icon={<WalletCards size={18} />}
          accent="primary"
          wide
        />
        <Stat
          label="PAD"
          value={formatRupiahCompact(totals.pad)}
          helper={`${counts.pad} SPK sudah PAD`}
          detail={formatRupiah(totals.pad)}
          icon={<FileCheck2 size={18} />}
          accent="success"
        />
        <Stat
          label="Invoiced"
          value={formatRupiahCompact(totals.invoice)}
          helper={`${counts.invoice} SPK sudah invoiced`}
          detail={`${invoicePercent}% dari laporan`}
          icon={<ReceiptText size={18} />}
          accent="info"
        />
        <Stat
          label="Denda"
          value={formatRupiahCompact(totals.denda)}
          helper={totals.denda > 0 ? `${counts.denda} SPK punya denda` : 'Tidak ada denda'}
          detail={formatRupiah(totals.denda)}
          icon={<AlertTriangle size={18} />}
          accent={totals.denda > 0 ? 'danger' : 'neutral'}
        />
      </div>

      <div className="mb-5 grid gap-4 sm:grid-cols-3">
        <MiniStat label="Opname" value={formatRupiah(totals.opname)} helper={`${counts.opname} SPK sudah opname`} />
        <MiniStat label="Belum PAD" value={String(rows.filter((r) => r.opnameMarkedAt && !r.padMarkedAt).length)} helper="sudah opname, menunggu PAD" />
        <MiniStat label="Belum Invoiced" value={String(rows.filter((r) => r.padMarkedAt && !r.invoiceDone).length)} helper="sudah PAD, menunggu invoiced" />
      </div>

      <Card className="overflow-hidden">
        <FinancialReportTable rows={rows} mayEdit={mayEdit} />
      </Card>
    </>
  )
}

function Stat({
  label,
  value,
  helper,
  detail,
  icon,
  accent,
  wide = false,
}: {
  label: string
  value: string
  helper: string
  detail: string
  icon: ReactNode
  accent: 'primary' | 'success' | 'info' | 'danger' | 'neutral'
  wide?: boolean
}) {
  const tone = {
    primary: 'bg-primary-soft text-primary border-primary/20',
    success: 'bg-success/10 text-success border-success/20',
    info: 'bg-info/10 text-info border-info/20',
    danger: 'bg-danger/10 text-danger border-danger/20',
    neutral: 'bg-slate-100 text-slate-600 border-slate-200',
  }[accent]

  return (
    <Card className={cn('min-w-0 overflow-hidden', wide && 'lg:min-h-[128px]')}>
      <CardContent className="grid min-w-0 content-between gap-4 p-4">
        <div className="flex items-start justify-between gap-3">
          <div>
            <div className="text-[11px] font-extrabold tracking-wider text-slate-500 uppercase">{label}</div>
            <div className="mt-1 text-xs font-semibold text-muted-foreground">{helper}</div>
          </div>
          <div className={cn('rounded-lg border p-2', tone)}>{icon}</div>
        </div>
        <div>
          <div className={cn('tnum truncate text-2xl font-black', accent === 'danger' ? 'text-danger' : 'text-slate-900')}>
            {value}
          </div>
          <div className="tnum mt-1 truncate text-xs font-bold text-muted-foreground">{detail}</div>
        </div>
      </CardContent>
    </Card>
  )
}

function MiniStat({ label, value, helper }: { label: string; value: string; helper: string }) {
  return (
    <Card>
      <CardContent className="flex items-center justify-between gap-4 p-4">
        <div>
          <div className="text-sm font-black text-slate-900">{label}</div>
          <div className="mt-0.5 text-xs font-semibold text-muted-foreground">{helper}</div>
        </div>
        <div className="tnum rounded-full bg-slate-100 px-3 py-1 text-sm font-black text-slate-900">
          {value}
        </div>
      </CardContent>
    </Card>
  )
}
