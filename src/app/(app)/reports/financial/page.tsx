import type { Metadata } from 'next'
import Link from 'next/link'
import { PageHeader, EmptyState } from '@/components/ui/page-header'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Table, Td, Th, Tr } from '@/components/ui/table'
import { Badge } from '@/components/ui/badge'
import { requirePermission } from '@/lib/auth/session'
import { createClient } from '@/lib/supabase/server'
import { can } from '@/lib/auth/permissions'
import { cn, formatDate, formatRupiah } from '@/lib/utils'
import { formatPercentSigned, marginTone } from '@/lib/financial'

export const metadata: Metadata = { title: 'Financial Report' }

/**
 * Section 26 — the money in one place: the revenue chain per SPK, what is
 * still owed, and where margin is being made or lost. Margin is gated on the
 * `margin` permission even for roles that may read the rest.
 */
export default async function FinancialReportPage() {
  const user = await requirePermission('report', 'view')
  const seeMargin = can(user.permissions, 'margin', 'view')
  const seeSpending = can(user.permissions, 'spending', 'view')

  const supabase = await createClient()
  const [{ data: financial }, { data: margins }, { data: overhead }, { data: spks }] =
    await Promise.all([
      supabase.from('v_spk_financial').select('*'),
      seeMargin ? supabase.from('v_spk_margin').select('*') : Promise.resolve({ data: [] }),
      seeSpending
        ? supabase
            .from('v_project_overhead_monthly')
            .select('*')
            .order('period_month', { ascending: false })
            .limit(6)
        : Promise.resolve({ data: [] }),
      supabase.from('spks').select('id, spk_number, site_code, status'),
    ])

  const spkById = new Map((spks ?? []).map((s) => [s.id, s]))
  const marginBySpk = new Map((margins ?? []).map((m) => [m.spk_id, m]))

  // An SPK with no financial activity at all only adds noise to a recap.
  const live = (financial ?? []).filter(
    (f) =>
      Number(f.contract_total) > 0 ||
      Number(f.opname_total) > 0 ||
      Number(f.invoice_total) > 0,
  )

  const totals = live.reduce(
    (acc, f) => ({
      contract: acc.contract + Number(f.contract_total),
      opname: acc.opname + Number(f.opname_total),
      pad: acc.pad + Number(f.pad_total),
      invoice: acc.invoice + Number(f.invoice_total),
      payment: acc.payment + Number(f.payment_total),
      outstanding: acc.outstanding + Number(f.outstanding_payment),
    }),
    { contract: 0, opname: 0, pad: 0, invoice: 0, payment: 0, outstanding: 0 },
  )

  const marginTotal = (margins ?? [])
    .filter((m) => Number(m.invoice_total) > 0)
    .reduce((sum, m) => sum + Number(m.margin), 0)
  const marginPercent =
    totals.invoice > 0 ? (marginTotal / totals.invoice) * 100 : null

  const overheadTotal = (overhead ?? []).reduce(
    (sum, row) => sum + Number(row.overhead_total),
    0,
  )

  return (
    <>
      <PageHeader
        title="Financial Report"
        description="Section 26 — rantai Contract sampai Payment per SPK, sisa tagihan, dan posisi margin."
      />

      <div className="mb-5 grid gap-4 sm:grid-cols-3 lg:grid-cols-5">
        <Stat label="Contract" value={formatRupiah(totals.contract)} />
        <Stat label="Opname" value={formatRupiah(totals.opname)} />
        <Stat label="Invoice" value={formatRupiah(totals.invoice)} />
        <Stat label="Payment" value={formatRupiah(totals.payment)} />
        <Stat
          label="Outstanding"
          value={formatRupiah(totals.outstanding)}
          tone={totals.outstanding > 0 ? 'danger' : undefined}
        />
      </div>

      <Card className="mb-5 overflow-hidden">
        <CardHeader>
          <div>
            <CardTitle>Rekonsiliasi per SPK</CardTitle>
            <CardDescription>
              Selisih antar kolom inilah yang jadi bahan bottleneck financial
              (Section 26.1).
            </CardDescription>
          </div>
          <Link
            href="/financial/margin"
            className="text-xs font-bold text-primary hover:underline"
          >
            Margin per SPK
          </Link>
        </CardHeader>

        {live.length > 0 ? (
          <Table>
            <thead>
              <tr>
                <Th>SPK</Th>
                <Th className="text-right">Contract</Th>
                <Th className="text-right">Opname</Th>
                <Th className="text-right">PAD</Th>
                <Th className="text-right">Invoice</Th>
                <Th className="text-right">Payment</Th>
                <Th className="text-right">Outstanding</Th>
                {seeMargin && <Th className="text-right">Margin</Th>}
              </tr>
            </thead>
            <tbody>
              {live.map((row) => {
                const spk = spkById.get(row.spk_id)
                const margin = marginBySpk.get(row.spk_id)
                const percent =
                  margin?.margin_percent == null ? null : Number(margin.margin_percent)
                const outstanding = Number(row.outstanding_payment)

                return (
                  <Tr key={row.spk_id}>
                    <Td>
                      <Link
                        href={`/spk/${row.spk_id}?tab=financial`}
                        className="font-bold text-primary hover:underline"
                      >
                        {spk?.site_code ?? row.spk_number}
                      </Link>
                      {spk && (
                        <div className="text-xs text-muted-foreground">{spk.status}</div>
                      )}
                    </Td>
                    <Td className="tnum text-right">{formatRupiah(row.contract_total)}</Td>
                    <Td className="tnum text-right">{formatRupiah(row.opname_total)}</Td>
                    <Td className="tnum text-right">{formatRupiah(row.pad_total)}</Td>
                    <Td className="tnum text-right">{formatRupiah(row.invoice_total)}</Td>
                    <Td className="tnum text-right">{formatRupiah(row.payment_total)}</Td>
                    <Td
                      className={cn(
                        'tnum text-right',
                        outstanding > 0 && 'font-bold text-danger',
                      )}
                    >
                      {outstanding > 0 ? formatRupiah(outstanding) : '—'}
                    </Td>
                    {seeMargin && (
                      <Td className="text-right">
                        {margin && Number(margin.invoice_total) > 0 ? (
                          <Badge tone={marginTone(percent)}>
                            {formatPercentSigned(percent)}
                          </Badge>
                        ) : (
                          <span className="text-muted-foreground">—</span>
                        )}
                      </Td>
                    )}
                  </Tr>
                )
              })}
            </tbody>
            <tfoot>
              <tr className="bg-surface-muted">
                <Td>Total</Td>
                <Td className="tnum text-right">{formatRupiah(totals.contract)}</Td>
                <Td className="tnum text-right">{formatRupiah(totals.opname)}</Td>
                <Td className="tnum text-right">{formatRupiah(totals.pad)}</Td>
                <Td className="tnum text-right">{formatRupiah(totals.invoice)}</Td>
                <Td className="tnum text-right">{formatRupiah(totals.payment)}</Td>
                <Td className="tnum text-right text-danger">
                  {formatRupiah(totals.outstanding)}
                </Td>
                {seeMargin && (
                  <Td className="tnum text-right">
                    {formatPercentSigned(marginPercent)}
                  </Td>
                )}
              </tr>
            </tfoot>
          </Table>
        ) : (
          <EmptyState
            title="Belum ada aktivitas financial"
            description="SPK muncul di sini setelah punya kontrak, opname, atau invoice."
          />
        )}
      </Card>

      {seeSpending && (
        <Card className="overflow-hidden">
          <CardHeader>
            <div>
              <CardTitle>Overhead project</CardTitle>
              <CardDescription>
                Section 26.3 — kas dan biaya personel tanpa tanda SPK, total{' '}
                {formatRupiah(overheadTotal)} dalam 6 bulan terakhir.
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
                  <Th className="text-right">Total</Th>
                </tr>
              </thead>
              <tbody>
                {overhead.map((row) => (
                  <Tr key={row.period_month}>
                    <Td className="tnum font-semibold">{formatDate(row.period_month)}</Td>
                    <Td className="tnum text-right">
                      {formatRupiah(row.operational_cash)}
                    </Td>
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
      )}
    </>
  )
}

function Stat({
  label,
  value,
  tone,
}: {
  label: string
  value: string
  tone?: 'danger'
}) {
  return (
    <Card>
      <CardContent className="p-4">
        <div className="text-[11px] font-extrabold tracking-wider text-slate-500 uppercase">
          {label}
        </div>
        <div
          className={cn(
            'tnum mt-1 text-lg font-black',
            tone === 'danger' ? 'text-danger' : 'text-slate-900',
          )}
        >
          {value}
        </div>
      </CardContent>
    </Card>
  )
}
