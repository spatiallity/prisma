import type { Metadata } from 'next'
import Link from 'next/link'
import { PageHeader, EmptyState } from '@/components/ui/page-header'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Table, Td, Th, Tr } from '@/components/ui/table'
import { Badge } from '@/components/ui/badge'
import { Alert } from '@/components/ui/alert'
import { requirePermission } from '@/lib/auth/session'
import { createClient } from '@/lib/supabase/server'
import { cn, formatDate, formatRupiah } from '@/lib/utils'
import { marginTone, formatPercentSigned } from '@/lib/financial'

export const metadata: Metadata = { title: 'Margin per SPK' }

/**
 * Section 26.2 — Margin = Invoice − Total Cost, where Total Cost is vendor
 * payable plus the personnel and cash entries tagged to that SPK. Everything
 * here is read from views; nothing on this page is stored.
 */
export default async function MarginPage() {
  await requirePermission('margin', 'view')

  const supabase = await createClient()
  const [{ data: margins, error }, { data: overhead }, { data: spks }] = await Promise.all([
    supabase.from('v_spk_margin').select('*').order('margin', { ascending: false }),
    supabase
      .from('v_project_overhead_monthly')
      .select('*')
      .order('period_month', { ascending: false })
      .limit(6),
    supabase.from('spks').select('id, spk_number, site_code, work_name, status'),
  ])

  const spkById = new Map((spks ?? []).map((s) => [s.id, s]))

  // Only SPK that have been invoiced can have a margin at all.
  const invoiced = (margins ?? []).filter((m) => Number(m.invoice_total) > 0)

  const totals = invoiced.reduce(
    (acc, m) => ({
      invoice: acc.invoice + Number(m.invoice_total),
      cost: acc.cost + Number(m.total_cost),
      margin: acc.margin + Number(m.margin),
      vendor: acc.vendor + Number(m.vendor_payable),
      personnel: acc.personnel + Number(m.personnel_cost),
      cash: acc.cash + Number(m.operational_cash),
    }),
    { invoice: 0, cost: 0, margin: 0, vendor: 0, personnel: 0, cash: 0 },
  )

  const overallPercent =
    totals.invoice > 0 ? (totals.margin / totals.invoice) * 100 : null

  const overheadTotal = (overhead ?? []).reduce(
    (sum, row) => sum + Number(row.overhead_total),
    0,
  )

  return (
    <>
      <PageHeader
        title="Margin per SPK"
        description="Margin = Invoice − (Vendor Payable + Personnel Cost bertanda + Kas bertanda). Overhead umum sengaja tidak dibebankan ke SPK mana pun."
      />

      {error && (
        <Alert tone="danger" className="mb-4" title="Gagal memuat data">
          {error.message}
        </Alert>
      )}

      <div className="mb-5 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Card>
          <CardContent className="p-4">
            <div className="text-[11px] font-extrabold tracking-wider text-slate-500 uppercase">
              Total invoice
            </div>
            <div className="tnum mt-1 text-xl font-black text-slate-900">
              {formatRupiah(totals.invoice)}
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="text-[11px] font-extrabold tracking-wider text-slate-500 uppercase">
              Total cost
            </div>
            <div className="tnum mt-1 text-xl font-black text-slate-900">
              {formatRupiah(totals.cost)}
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="text-[11px] font-extrabold tracking-wider text-slate-500 uppercase">
              Margin
            </div>
            <div
              className={cn(
                'tnum mt-1 text-xl font-black',
                totals.margin < 0 ? 'text-danger' : 'text-success',
              )}
            >
              {formatRupiah(totals.margin)}
            </div>
            <div className="mt-0.5 text-xs font-bold text-muted-foreground">
              {formatPercentSigned(overallPercent)}
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="text-[11px] font-extrabold tracking-wider text-slate-500 uppercase">
              Overhead project
            </div>
            <div className="tnum mt-1 text-xl font-black text-slate-900">
              {formatRupiah(overheadTotal)}
            </div>
            <div className="mt-0.5 text-xs text-muted-foreground">
              6 bulan terakhir, di luar margin SPK
            </div>
          </CardContent>
        </Card>
      </div>

      <Card className="mb-5 overflow-hidden">
        <CardHeader>
          <div>
            <CardTitle>Per SPK</CardTitle>
            <CardDescription>
              Hanya SPK yang sudah punya invoice yang punya margin.
            </CardDescription>
          </div>
        </CardHeader>

        {invoiced.length > 0 ? (
          <Table>
            <thead>
              <tr>
                <Th>SPK</Th>
                <Th className="text-right">Invoice</Th>
                <Th className="text-right">Vendor payable</Th>
                <Th className="text-right">Personnel</Th>
                <Th className="text-right">Kas operasional</Th>
                <Th className="text-right">Total cost</Th>
                <Th className="text-right">Margin</Th>
                <Th className="text-right">Margin %</Th>
              </tr>
            </thead>
            <tbody>
              {invoiced.map((row) => {
                const spk = spkById.get(row.spk_id)
                const percent =
                  row.margin_percent === null ? null : Number(row.margin_percent)
                return (
                  <Tr key={row.spk_id}>
                    <Td>
                      <Link
                        href={`/spk/${row.spk_id}`}
                        className="font-bold text-primary hover:underline"
                      >
                        {spk?.site_code ?? row.spk_number}
                      </Link>
                      {spk && (
                        <div className="text-xs text-muted-foreground">{spk.status}</div>
                      )}
                    </Td>
                    <Td className="tnum text-right">{formatRupiah(row.invoice_total)}</Td>
                    <Td className="tnum text-right">{formatRupiah(row.vendor_payable)}</Td>
                    <Td className="tnum text-right">{formatRupiah(row.personnel_cost)}</Td>
                    <Td className="tnum text-right">{formatRupiah(row.operational_cash)}</Td>
                    <Td className="tnum text-right">{formatRupiah(row.total_cost)}</Td>
                    <Td
                      className={cn(
                        'tnum text-right font-bold',
                        Number(row.margin) < 0 ? 'text-danger' : 'text-success',
                      )}
                    >
                      {formatRupiah(row.margin)}
                    </Td>
                    <Td className="text-right">
                      <Badge tone={marginTone(percent)}>
                        {formatPercentSigned(percent)}
                      </Badge>
                    </Td>
                  </Tr>
                )
              })}
            </tbody>
            <tfoot>
              <tr className="bg-surface-muted">
                <Td>Total</Td>
                <Td className="tnum text-right">{formatRupiah(totals.invoice)}</Td>
                <Td className="tnum text-right">{formatRupiah(totals.vendor)}</Td>
                <Td className="tnum text-right">{formatRupiah(totals.personnel)}</Td>
                <Td className="tnum text-right">{formatRupiah(totals.cash)}</Td>
                <Td className="tnum text-right">{formatRupiah(totals.cost)}</Td>
                <Td
                  className={cn(
                    'tnum text-right',
                    totals.margin < 0 ? 'text-danger' : 'text-success',
                  )}
                >
                  {formatRupiah(totals.margin)}
                </Td>
                <Td className="tnum text-right">{formatPercentSigned(overallPercent)}</Td>
              </tr>
            </tfoot>
          </Table>
        ) : (
          <EmptyState
            title="Belum ada SPK yang di-invoice"
            description="Margin muncul setelah invoice pertama tercatat."
          />
        )}
      </Card>

      <Card className="overflow-hidden">
        <CardHeader>
          <div>
            <CardTitle>Overhead project per bulan</CardTitle>
            <CardDescription>
              Section 26.3 — kas dan biaya personel yang tidak ditandai ke SPK
              mana pun. Sengaja dipisah agar tidak mengaburkan margin per SPK.
            </CardDescription>
          </div>
        </CardHeader>

        {overhead && overhead.length > 0 ? (
          <Table>
            <thead>
              <tr>
                <Th>Bulan</Th>
                <Th className="text-right">Kas operasional</Th>
                <Th className="text-right">Biaya personel</Th>
                <Th className="text-right">Total overhead</Th>
              </tr>
            </thead>
            <tbody>
              {overhead.map((row) => (
                <Tr key={row.period_month}>
                  <Td className="tnum font-semibold">{formatDate(row.period_month)}</Td>
                  <Td className="tnum text-right">{formatRupiah(row.operational_cash)}</Td>
                  <Td className="tnum text-right">{formatRupiah(row.personnel_cost)}</Td>
                  <Td className="tnum text-right font-bold">
                    {formatRupiah(row.overhead_total)}
                  </Td>
                </Tr>
              ))}
            </tbody>
          </Table>
        ) : (
          <EmptyState title="Belum ada overhead tercatat" />
        )}
      </Card>
    </>
  )
}
