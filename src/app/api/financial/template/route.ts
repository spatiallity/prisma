import type { NextRequest } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { requirePermission } from '@/lib/auth/session'
import { filterLeafAccounts, FINANCE_CATEGORY_META } from '@/lib/financial'
import { buildFinanceTemplateWorkbook } from '@/lib/finance-import'
import type { FinanceCategory } from '@/lib/supabase/types'

/** Section 26 bulk-import — generates the fillable .xlsx for one kategori,
 *  matching whatever the Chart of Accounts currently has (kept live, not
 *  a static file, so a new kode_akun shows up in the next download). */
export async function GET(request: NextRequest) {
  await requirePermission('spending', 'edit')

  const kategori = request.nextUrl.searchParams.get('kategori') as FinanceCategory | null
  if (!kategori || !(kategori in FINANCE_CATEGORY_META)) {
    return new Response('Kategori tidak dikenali.', { status: 400 })
  }

  const supabase = await createClient()
  const [{ data: coa }, { data: pjRows }] = await Promise.all([
    supabase.from('chart_of_accounts').select('kode_akun, uraian').order('kode_akun'),
    kategori === 'umk'
      ? supabase
          .from('finance_transactions')
          .select('pj_nama')
          .eq('kategori', 'umk')
          .not('pj_nama', 'is', null)
      : Promise.resolve({ data: null }),
  ])

  const akunOptions = filterLeafAccounts(coa ?? [])
  const pjOptions = [...new Set((pjRows ?? []).map((r) => r.pj_nama).filter((n): n is string => !!n))].sort(
    (a, b) => a.localeCompare(b),
  )

  const workbook = buildFinanceTemplateWorkbook(kategori, akunOptions, pjOptions)
  const buffer = await workbook.xlsx.writeBuffer()

  // Timestamped so downloading twice in a row never collides with (or
  // silently overwrites) the previous file in the admin's Downloads folder.
  const stamp = new Date().toISOString().replace(/[-:]/g, '').replace('T', '_').slice(0, 15)
  const filename = `template_transaksi_${kategori}_${stamp}.xlsx`

  return new Response(buffer, {
    headers: {
      'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      'Content-Disposition': `attachment; filename="${filename}"`,
    },
  })
}
