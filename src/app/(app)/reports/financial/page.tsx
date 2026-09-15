import type { Metadata } from 'next'
import { PageHeader } from '@/components/ui/page-header'
import { Card, CardContent } from '@/components/ui/card'
import { requirePermission } from '@/lib/auth/session'
import { createClient } from '@/lib/supabase/server'
import { cn, formatRupiah } from '@/lib/utils'
import { FinancialReportTable, type FinancialRow } from './financial-report-table'

export const metadata: Metadata = { title: 'Financial Report' }

/**
 * Section 26.1 — the money in one place, read live from the SPK itself
 * (Nilai SPK) rather than the old standalone Contract/PAD/Invoice lists:
 * Opname/PAD are the same marks the Design Opname stage and Routing
 * Monitor's PAD column write, and Invoice is the routing document's own
 * Invoiced step — whatever's been entered there shows up here too.
 */
export default async function FinancialReportPage() {
  await requirePermission('report', 'view')

  const supabase = await createClient()

  const [{ data: spks }, { data: routingDocs }, { data: invoicedSteps }] = await Promise.all([
    supabase
      .from('spks')
      .select('id, spk_number, site_code, status, contract_value, start_date, opname_marked_at, opname_value, pad_marked_at, pad_value')
      .order('spk_number'),
    supabase.from('spk_routing').select('id, spk_id'),
    supabase
      .from('routing_history')
      .select('spk_routing_id, status, invoice_number, invoice_value, invoice_date')
      .eq('step_name', 'Invoiced'),
  ])

  const spkIdByRoutingId = new Map((routingDocs ?? []).map((r) => [r.id, r.spk_id]))
  const invoiceBySpk = new Map<string, NonNullable<typeof invoicedSteps>[number]>()
  for (const step of invoicedSteps ?? []) {
    const spkId = spkIdByRoutingId.get(step.spk_routing_id)
    if (spkId) invoiceBySpk.set(spkId, step)
  }

  const rows: FinancialRow[] = (spks ?? [])
    .filter((s) => Number(s.contract_value) > 0 || s.opname_marked_at || s.pad_marked_at || invoiceBySpk.has(s.id))
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
        invoiceDone: invoice?.status === 'Completed',
        invoiceNumber: invoice?.invoice_number ?? null,
        invoiceValue: invoice?.invoice_value != null ? Number(invoice.invoice_value) : null,
        invoiceDate: invoice?.invoice_date ?? null,
      }
    })

  const totals = rows.reduce(
    (acc, r) => ({
      nilaiSpk: acc.nilaiSpk + r.nilaiSpk,
      opname: acc.opname + (r.opnameValue ?? 0),
      pad: acc.pad + (r.padValue ?? 0),
      invoice: acc.invoice + (r.invoiceValue ?? 0),
      outstanding: acc.outstanding + (r.nilaiSpk - (r.invoiceValue ?? 0)),
    }),
    { nilaiSpk: 0, opname: 0, pad: 0, invoice: 0, outstanding: 0 },
  )

  return (
    <>
      <PageHeader
        title="Financial Report"
        description="Nilai SPK sampai Invoice, dibaca langsung dari SPK, Desain, dan Routing — bukan daftar terpisah lagi."
      />

      <div className="mb-5 grid gap-4 sm:grid-cols-3 lg:grid-cols-5">
        <Stat label="Nilai SPK" value={formatRupiah(totals.nilaiSpk)} />
        <Stat label="Opname" value={formatRupiah(totals.opname)} />
        <Stat label="PAD" value={formatRupiah(totals.pad)} />
        <Stat label="Invoice" value={formatRupiah(totals.invoice)} />
        <Stat label="Outstanding" value={formatRupiah(totals.outstanding)} tone={totals.outstanding > 0 ? 'danger' : undefined} />
      </div>

      <Card className="overflow-hidden">
        <FinancialReportTable rows={rows} />
      </Card>
    </>
  )
}

function Stat({ label, value, tone }: { label: string; value: string; tone?: 'danger' }) {
  return (
    <Card>
      <CardContent className="p-4">
        <div className="text-[11px] font-extrabold tracking-wider text-slate-500 uppercase">{label}</div>
        <div className={cn('tnum mt-1 text-lg font-black', tone === 'danger' ? 'text-danger' : 'text-slate-900')}>
          {value}
        </div>
      </CardContent>
    </Card>
  )
}
