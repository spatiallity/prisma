import type { NextRequest } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { requirePermission } from '@/lib/auth/session'
import { FINANCE_CATEGORY_META } from '@/lib/financial'
import { buildTransactionsExportWorkbook } from '@/lib/finance-export'
import type { FinanceCategory } from '@/lib/supabase/types'

/** One kategori's current transaction list as a report .xlsx — separate
 *  from /api/financial/template, which is a blank fillable sheet for
 *  bulk-import instead of a read-only export of what's already recorded. */
export async function GET(request: NextRequest) {
  await requirePermission('spending', 'view')

  const kategori = request.nextUrl.searchParams.get('kategori') as FinanceCategory | null
  if (!kategori || !(kategori in FINANCE_CATEGORY_META)) {
    return new Response('Kategori tidak dikenali.', { status: 400 })
  }

  const supabase = await createClient()
  const [{ data: rows }, { data: coa }] = await Promise.all([
    supabase
      .from('finance_transactions')
      .select('*')
      .eq('kategori', kategori)
      .eq('status', 'Active')
      .order('tanggal', { ascending: false, nullsFirst: false }),
    supabase.from('chart_of_accounts').select('kode_akun, uraian'),
  ])

  const akunUraian = new Map((coa ?? []).map((a) => [a.kode_akun, a.uraian]))

  const creatorIds = [
    ...new Set((rows ?? []).map((r) => r.created_by).filter(Boolean)),
  ] as string[]
  const { data: creators } = creatorIds.length
    ? await supabase.from('users').select('id, full_name').in('id', creatorIds)
    : { data: [] }
  const actorName = new Map((creators ?? []).map((a) => [a.id, a.full_name]))

  const workbook = buildTransactionsExportWorkbook(kategori, rows ?? [], akunUraian, actorName)
  const buffer = await workbook.xlsx.writeBuffer()

  const stamp = new Date().toISOString().replace(/[-:]/g, '').replace('T', '_').slice(0, 15)
  const filename = `data_${kategori}_${stamp}.xlsx`

  return new Response(buffer, {
    headers: {
      'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      'Content-Disposition': `attachment; filename="${filename}"`,
    },
  })
}
