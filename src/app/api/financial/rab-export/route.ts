import { createClient } from '@/lib/supabase/server'
import { requirePermission } from '@/lib/auth/session'
import { filterLeafAccounts } from '@/lib/financial'
import { buildRabSerapanWorkbook, type AkunSummaryForExport } from '@/lib/finance-export'

/** Monitoring RAB's own numbers (v_finance_akun_summary /
 *  v_finance_realisasi_bulanan), laid out as one row per account, one
 *  column per month, with a grand-total row at the bottom — the on-screen
 *  page can only show one month or the all-time total at a time; this puts
 *  every month side by side in one sheet. */
export async function GET() {
  await requirePermission('spending', 'view')

  const supabase = await createClient()
  const [{ data: akunSummary }, { data: bulanan }] = await Promise.all([
    supabase.from('v_finance_akun_summary').select('*').order('kode_akun'),
    supabase.from('v_finance_realisasi_bulanan').select('kode_akun, bulan, realisasi'),
  ])

  const leafSummary = filterLeafAccounts(akunSummary ?? []) as AkunSummaryForExport[]
  const leafCodes = new Set(leafSummary.map((a) => a.kode_akun))

  const monthlyByAkun = new Map<string, Map<string, number>>()
  const monthSet = new Set<string>()
  for (const row of bulanan ?? []) {
    if (!leafCodes.has(row.kode_akun)) continue
    monthSet.add(row.bulan)
    const forAkun = monthlyByAkun.get(row.kode_akun) ?? new Map<string, number>()
    forAkun.set(row.bulan, (forAkun.get(row.bulan) ?? 0) + Number(row.realisasi))
    monthlyByAkun.set(row.kode_akun, forAkun)
  }
  const months = [...monthSet].sort()

  const workbook = buildRabSerapanWorkbook(leafSummary, monthlyByAkun, months)
  const buffer = await workbook.xlsx.writeBuffer()

  const stamp = new Date().toISOString().replace(/[-:]/g, '').replace('T', '_').slice(0, 15)
  const filename = `serapan_rab_${stamp}.xlsx`

  return new Response(buffer, {
    headers: {
      'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      'Content-Disposition': `attachment; filename="${filename}"`,
    },
  })
}
