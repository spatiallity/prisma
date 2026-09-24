import { createClient } from '@/lib/supabase/server'
import { requirePermission } from '@/lib/auth/session'
import { buildFinancialReportWorkbook, type FinancialReportExportRow } from '@/lib/monitor-export'

/** Complete financial snapshot, independent from the report page's current
 * filter tab or table pagination. */
export async function GET() {
  await requirePermission('report', 'view')
  const supabase = await createClient()
  const [{ data: spks, error: spkError }, { data: invoices, error: invoiceError }] = await Promise.all([
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
  if (spkError || invoiceError) {
    return new Response(spkError?.message ?? invoiceError?.message ?? 'Gagal menyiapkan laporan keuangan.', { status: 500 })
  }

  const invoiceBySpk = new Map<string, NonNullable<typeof invoices>[number]>()
  for (const invoice of invoices ?? []) {
    const existing = invoiceBySpk.get(invoice.spk_id)
    if (!existing || (invoice.status === 'Approved' && existing.status !== 'Approved')) invoiceBySpk.set(invoice.spk_id, invoice)
  }
  const rows: FinancialReportExportRow[] = (spks ?? [])
    .filter((spk) => Number(spk.contract_value) > 0 || spk.opname_marked_at || spk.pad_marked_at || Number(spk.denda_value) > 0 || invoiceBySpk.has(spk.id))
    .map((spk) => {
      const invoice = invoiceBySpk.get(spk.id)
      const approved = invoice?.status === 'Approved'
      return {
        spkNumber: spk.spk_number,
        siteCode: spk.site_code,
        status: spk.status,
        startDate: spk.start_date,
        contractValue: Number(spk.contract_value ?? 0),
        opnameDate: spk.opname_marked_at,
        opnameValue: spk.opname_value === null ? null : Number(spk.opname_value),
        padDate: spk.pad_marked_at,
        padValue: spk.pad_value === null ? null : Number(spk.pad_value),
        invoiceNumber: approved ? invoice?.invoice_number ?? null : null,
        invoiceDate: approved ? invoice?.invoice_date ?? null : null,
        invoiceValue: approved && invoice?.invoice_value !== null && invoice?.invoice_value !== undefined ? Number(invoice.invoice_value) : null,
        dendaValue: spk.denda_value === null ? null : Number(spk.denda_value),
      }
    })
  const workbook = buildFinancialReportWorkbook(rows)
  const buffer = await workbook.xlsx.writeBuffer()
  const stamp = new Date().toISOString().replace(/[-:]/g, '').replace('T', '_').slice(0, 15)
  return new Response(buffer, {
    headers: {
      'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      'Content-Disposition': `attachment; filename="laporan_keuangan_spk_${stamp}.xlsx"`,
    },
  })
}
