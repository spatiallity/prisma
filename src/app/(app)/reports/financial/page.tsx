import type { Metadata } from 'next'
import Link from 'next/link'
import { PageHeader, EmptyState } from '@/components/ui/page-header'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Table, Td, Th, Tr } from '@/components/ui/table'
import { requirePermission } from '@/lib/auth/session'
import { createClient } from '@/lib/supabase/server'
import { cn, formatRupiah } from '@/lib/utils'

export const metadata: Metadata = { title: 'Financial Report' }

/**
 * Section 26.1 — the money in one place: the revenue chain per SPK and what
 * is still owed. RAB Anggaran vs Realisasi (formerly the margin-per-SPK cost
 * model) now lives under Financial → Monitoring RAB.
 */
export default async function FinancialReportPage() {
  await requirePermission('report', 'view')

  const supabase = await createClient()
  const [{ data: financial }, { data: spks }] = await Promise.all([
    supabase.from('v_spk_financial').select('*'),
    supabase.from('spks').select('id, spk_number, site_code, status'),
  ])

  const spkById = new Map((spks ?? []).map((s) => [s.id, s]))

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

  return (
    <>
      <PageHeader
        title="Financial Report"
        description="Rantai Contract sampai Payment per SPK dan sisa tagihan."
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
              Selisih antar kolom inilah yang jadi bahan bottleneck financial.
            </CardDescription>
          </div>
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
              </tr>
            </thead>
            <tbody>
              {live.map((row) => {
                const spk = spkById.get(row.spk_id)
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
