import { PageHeader } from '@/components/ui/page-header'
import { Card, CardContent } from '@/components/ui/card'
import { requirePermission } from '@/lib/auth/session'
import { createClient } from '@/lib/supabase/server'
import { can } from '@/lib/auth/permissions'
import { formatRupiah } from '@/lib/utils'
import { FINANCE_CATEGORY_META, filterLeafAccounts } from '@/lib/financial'
import type { FinanceCategory } from '@/lib/supabase/types'
import { AddTransactionButton } from './rab/finance-form'
import { FinanceTransactionsTable } from './finance-transactions-table'

/**
 * One filtered view per Excel-tab kategori (UMK / SPPD / PPBJ Barang / PPBJ
 * Jasa / Gaji PTT Project / MCU). Monitoring RAB shows all six together;
 * these pages exist for someone who only cares about one at a time.
 */
export async function FinanceCategoryList({ kategori }: { kategori: FinanceCategory }) {
  const meta = FINANCE_CATEGORY_META[kategori]
  const user = await requirePermission('spending', 'view')
  const mayEdit = can(user.permissions, 'spending', 'edit')

  const supabase = await createClient()
  const [{ data: rows }, { data: coa }] = await Promise.all([
    supabase
      .from('finance_transactions')
      .select('*')
      .eq('kategori', kategori)
      .eq('status', 'Active')
      .order('tanggal', { ascending: false, nullsFirst: false }),
    supabase.from('chart_of_accounts').select('kode_akun, uraian, kategori_roman_label'),
  ])

  const akunOptions = filterLeafAccounts(coa ?? []).sort((a, b) =>
    a.kode_akun.localeCompare(b.kode_akun),
  )

  const total = (rows ?? []).reduce((sum, r) => sum + Number(r.jumlah), 0)

  return (
    <>
      <PageHeader
        title={meta.label}
        description={
          meta.fixedAkun
            ? `Kode akun tetap: ${meta.fixedAkun}.`
            : kategori === 'gaji_ptt'
              ? 'Kode akun otomatis dari jenis: Upah — 1.7.1, Tunjangan — 1.7.3.'
              : 'Kode akun dipilih bebas per transaksi.'
        }
        actions={
          mayEdit && <AddTransactionButton akunOptions={akunOptions} lockedKategori={kategori} />
        }
      />

      <div className="mb-5 grid gap-4 sm:grid-cols-2">
        <Card>
          <CardContent className="p-4">
            <div className="text-[11px] font-extrabold tracking-wider text-slate-500 uppercase">
              Jumlah transaksi
            </div>
            <div className="tnum mt-1 text-2xl font-black text-slate-900">
              {(rows ?? []).length}
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="text-[11px] font-extrabold tracking-wider text-slate-500 uppercase">
              Total realisasi
            </div>
            <div className="tnum mt-1 text-2xl font-black text-slate-900">
              {formatRupiah(total)}
            </div>
          </CardContent>
        </Card>
      </div>

      <Card className="overflow-hidden">
        <FinanceTransactionsTable
          rows={rows ?? []}
          coa={coa ?? []}
          mayEdit={mayEdit}
          emptyTitle={`Belum ada transaksi ${meta.label}`}
        />
      </Card>
    </>
  )
}
