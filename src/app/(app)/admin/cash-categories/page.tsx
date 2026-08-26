import type { Metadata } from 'next'
import { PageHeader, EmptyState } from '@/components/ui/page-header'
import { Card } from '@/components/ui/card'
import { Table, Td, Th, Tr } from '@/components/ui/table'
import { StatusBadge } from '@/components/ui/badge'
import { Alert } from '@/components/ui/alert'
import { requirePermission } from '@/lib/auth/session'
import { createClient } from '@/lib/supabase/server'
import { formatRupiah } from '@/lib/utils'

export const metadata: Metadata = { title: 'Cash Ledger Category' }

/**
 * Section 42 — the free text the spreadsheet used ("BBM TERIOS", "BBM MOTOR")
 * collapses onto these fixed categories, which is what makes petty cash
 * summable at all.
 */
export default async function CashCategoriesPage() {
  await requirePermission('master_data', 'view')

  const supabase = await createClient()
  const [{ data: categories, error }, { data: entries }] = await Promise.all([
    supabase.from('cash_ledger_categories').select('*').order('sort_order'),
    supabase
      .from('cash_ledger')
      .select('category_id, amount_out')
      .eq('status', 'Active'),
  ])

  const usage = new Map<string, { count: number; total: number }>()
  for (const entry of entries ?? []) {
    if (!entry.category_id) continue
    const current = usage.get(entry.category_id) ?? { count: 0, total: 0 }
    current.count += 1
    current.total += Number(entry.amount_out)
    usage.set(entry.category_id, current)
  }

  const untagged = (entries ?? []).filter((e) => !e.category_id).length

  return (
    <>
      <PageHeader
        title="Cash Ledger Category"
        description="Kategori tetap untuk kas kecil mess. Teks bebas di Excel dipetakan ke sini agar bisa dijumlahkan (Section 42)."
      />

      {error && (
        <Alert tone="danger" className="mb-4" title="Gagal memuat data">
          {error.message}
        </Alert>
      )}

      {untagged > 0 && (
        <Alert tone="warning" className="mb-4" title="Ada entri tanpa kategori">
          {untagged} entri kas belum punya kategori, jadi tidak masuk rekap mana pun.
        </Alert>
      )}

      <Card className="overflow-hidden">
        {categories && categories.length > 0 ? (
          <Table>
            <thead>
              <tr>
                <Th className="w-10 text-right">#</Th>
                <Th>Kategori</Th>
                <Th>Keterangan</Th>
                <Th className="text-right">Entri</Th>
                <Th className="text-right">Total keluar</Th>
                <Th>Status</Th>
              </tr>
            </thead>
            <tbody>
              {categories.map((category) => {
                const stat = usage.get(category.id) ?? { count: 0, total: 0 }
                return (
                  <Tr key={category.id}>
                    <Td className="tnum text-right text-muted-foreground">
                      {category.sort_order}
                    </Td>
                    <Td>
                      <span className="font-bold text-slate-900">{category.name}</span>
                      <div className="code mt-0.5 inline-block text-xs">
                        {category.code}
                      </div>
                    </Td>
                    <Td className="max-w-md text-muted-foreground">
                      {category.description ?? '—'}
                    </Td>
                    <Td className="tnum text-right">{stat.count}</Td>
                    <Td className="tnum text-right font-bold">
                      {stat.total > 0 ? formatRupiah(stat.total) : '—'}
                    </Td>
                    <Td>
                      <StatusBadge status={category.status} />
                    </Td>
                  </Tr>
                )
              })}
            </tbody>
          </Table>
        ) : (
          <EmptyState
            title="Belum ada kategori"
            description="Jalankan supabase/seed/seed.sql untuk memuat sembilan kategori standar."
          />
        )}
      </Card>
    </>
  )
}
