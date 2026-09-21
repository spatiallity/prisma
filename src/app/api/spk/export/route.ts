import { createClient } from '@/lib/supabase/server'
import { requirePermission } from '@/lib/auth/session'
import { buildSpkExportWorkbook } from '@/lib/spk-export'

/** Full SPK financial recap as an Excel workbook. The listing filters are
 * intentionally not carried over: this is the complete project dataset. */
export async function GET() {
  await requirePermission('spk', 'view')

  const supabase = await createClient()
  const [{ data: spks, error: spkError }, { data: invoices, error: invoiceError }] = await Promise.all([
    supabase
      .from('spks')
      .select('*')
      .order('start_date', { ascending: false, nullsFirst: false })
      .order('created_at', { ascending: false }),
    supabase
      .from('invoices')
      .select('spk_id, invoice_date, invoice_value')
      .neq('status', 'Cancelled'),
  ])

  if (spkError || invoiceError) {
    return new Response(spkError?.message ?? invoiceError?.message ?? 'Gagal menyiapkan data SPK.', {
      status: 500,
    })
  }

  const workbook = buildSpkExportWorkbook(spks ?? [], invoices ?? [])
  const buffer = await workbook.xlsx.writeBuffer()
  const stamp = new Date().toISOString().replace(/[-:]/g, '').replace('T', '_').slice(0, 15)

  return new Response(buffer, {
    headers: {
      'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      'Content-Disposition': `attachment; filename="data_spk_${stamp}.xlsx"`,
    },
  })
}
