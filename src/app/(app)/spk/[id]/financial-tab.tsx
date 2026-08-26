import Link from 'next/link'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Table, Td, Th, Tr } from '@/components/ui/table'
import { EmptyState } from '@/components/ui/page-header'
import { createClient } from '@/lib/supabase/server'
import { can, type PermissionMap } from '@/lib/auth/permissions'
import { cn, formatDate, formatRupiah } from '@/lib/utils'
import {
  VENDOR_PAYMENT_TONE,
  marginTone,
  formatPercentSigned,
} from '@/lib/financial'

/**
 * Section 12 — the Financial tab of Detail SPK: the Section 26.1 chain for this
 * SPK, the spending tagged to it, and its margin. Margin is hidden from roles
 * without the `margin` permission even though the rest is visible.
 */
export async function FinancialTab({
  spkId,
  permissions,
}: {
  spkId: string
  permissions: PermissionMap
}) {
  const supabase = await createClient()
  const maySeeMargin = can(permissions, 'margin', 'view')
  const maySeeSpending = can(permissions, 'spending', 'view')

  const [{ data: financial }, { data: margin }, { data: vendorPayments }] =
    await Promise.all([
      supabase.from('v_spk_financial').select('*').eq('spk_id', spkId).maybeSingle(),
      maySeeMargin
        ? supabase.from('v_spk_margin').select('*').eq('spk_id', spkId).maybeSingle()
        : Promise.resolve({ data: null }),
      maySeeSpending
        ? supabase.from('vendor_payments').select('*').eq('spk_id', spkId)
        : Promise.resolve({ data: [] }),
    ])

  const [{ data: cash }, { data: personnelCosts }, { data: vendors }] = await Promise.all([
    maySeeSpending
      ? supabase
          .from('cash_ledger')
          .select('id, entry_date, description, amount_out')
          .eq('spk_id', spkId)
          .eq('status', 'Active')
          .order('entry_date', { ascending: false })
          .limit(8)
      : Promise.resolve({ data: [] }),
    maySeeSpending
      ? supabase
          .from('personnel_costs')
          .select('id, period, cost_type, amount, personnel_id')
          .eq('spk_id', spkId)
          .eq('status', 'Active')
          .order('period', { ascending: false })
          .limit(8)
      : Promise.resolve({ data: [] }),
    supabase.from('vendors').select('id, name'),
  ])

  const vendorName = new Map((vendors ?? []).map((v) => [v.id, v.name]))

  /** Section 26.1 — the revenue chain, each step against the one before it. */
  const chain = [
    { label: 'Contract', value: Number(financial?.contract_total ?? 0) },
    { label: 'Opname', value: Number(financial?.opname_total ?? 0) },
    { label: 'PAD', value: Number(financial?.pad_total ?? 0) },
    { label: 'Invoice', value: Number(financial?.invoice_total ?? 0) },
    { label: 'Payment', value: Number(financial?.payment_total ?? 0) },
  ]
  const peak = Math.max(1, ...chain.map((step) => step.value))

  return (
    <div className="grid gap-5">
      <Card>
        <CardHeader>
          <div>
            <CardTitle>Contract → Payment</CardTitle>
            <CardDescription>
              Section 26.1 — selisih antar tahap inilah yang jadi bahan bottleneck
              financial.
            </CardDescription>
          </div>
          {Number(financial?.outstanding_payment ?? 0) > 0 && (
            <Badge tone="danger">
              Outstanding {formatRupiah(financial?.outstanding_payment)}
            </Badge>
          )}
        </CardHeader>
        <CardContent className="grid gap-3">
          {chain.map((step) => (
            <div key={step.label} className="grid gap-1">
              <div className="flex items-baseline justify-between gap-3">
                <span className="text-xs font-extrabold tracking-wider text-slate-500 uppercase">
                  {step.label}
                </span>
                <span className="tnum text-sm font-bold text-slate-900">
                  {step.value > 0 ? formatRupiah(step.value) : '—'}
                </span>
              </div>
              <div className="h-1.5 overflow-hidden rounded-full bg-slate-100">
                <div
                  className="h-full rounded-full bg-primary"
                  style={{ width: `${(step.value / peak) * 100}%` }}
                />
              </div>
            </div>
          ))}
        </CardContent>
      </Card>

      {maySeeMargin && margin && (
        <Card>
          <CardHeader>
            <div>
              <CardTitle>Margin</CardTitle>
              <CardDescription>
                Invoice − (vendor payable + personnel + kas yang ditandai ke SPK ini).
              </CardDescription>
            </div>
            <Badge tone={marginTone(margin.margin_percent === null ? null : Number(margin.margin_percent))}>
              {formatPercentSigned(
                margin.margin_percent === null ? null : Number(margin.margin_percent),
              )}
            </Badge>
          </CardHeader>
          <CardContent className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            <Figure label="Invoice" value={margin.invoice_total} />
            <Figure label="Total cost" value={margin.total_cost} />
            <Figure
              label="Margin"
              value={margin.margin}
              tone={Number(margin.margin) < 0 ? 'danger' : 'success'}
            />
            <Figure label="Vendor payable" value={margin.vendor_payable} muted />
          </CardContent>
        </Card>
      )}

      {maySeeSpending && (
        <div className="grid gap-5 lg:grid-cols-3">
          <Card className="lg:col-span-2">
            <CardHeader>
              <div>
                <CardTitle>Spending ditandai ke SPK ini</CardTitle>
                <CardDescription>
                  Hanya yang ditandai; kas dan gaji umum masuk overhead project.
                </CardDescription>
              </div>
              <Link
                href="/financial/spending"
                className="text-xs font-bold text-primary hover:underline"
              >
                Kelola
              </Link>
            </CardHeader>
            <CardContent className="p-0">
              {(cash ?? []).length > 0 || (personnelCosts ?? []).length > 0 ? (
                <Table>
                  <thead>
                    <tr>
                      <Th>Tanggal</Th>
                      <Th>Jenis</Th>
                      <Th>Keterangan</Th>
                      <Th className="text-right">Jumlah</Th>
                    </tr>
                  </thead>
                  <tbody>
                    {(cash ?? []).map((entry) => (
                      <Tr key={entry.id}>
                        <Td className="tnum whitespace-nowrap">
                          {formatDate(entry.entry_date)}
                        </Td>
                        <Td>
                          <Badge>Kas</Badge>
                        </Td>
                        <Td className="text-muted-foreground">
                          {entry.description ?? '—'}
                        </Td>
                        <Td className="tnum text-right font-bold">
                          {formatRupiah(entry.amount_out)}
                        </Td>
                      </Tr>
                    ))}
                    {(personnelCosts ?? []).map((cost) => (
                      <Tr key={cost.id}>
                        <Td className="tnum whitespace-nowrap">
                          {formatDate(cost.period)}
                        </Td>
                        <Td>
                          <Badge tone="info">{cost.cost_type}</Badge>
                        </Td>
                        <Td className="text-muted-foreground">Biaya personel</Td>
                        <Td className="tnum text-right font-bold">
                          {formatRupiah(cost.amount)}
                        </Td>
                      </Tr>
                    ))}
                  </tbody>
                </Table>
              ) : (
                <EmptyState
                  title="Belum ada spending ditandai"
                  description="Kas dan biaya personel yang tidak ditandai dihitung sebagai overhead."
                />
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Pembayaran vendor</CardTitle>
            </CardHeader>
            <CardContent className="p-0">
              {(vendorPayments ?? []).length > 0 ? (
                <ul className="divide-y divide-slate-100">
                  {(vendorPayments ?? []).map((payment) => (
                    <li key={payment.id} className="px-5 py-3">
                      <div className="flex items-center justify-between gap-2">
                        <span className="text-sm font-bold text-slate-900">
                          {vendorName.get(payment.vendor_id) ?? 'Vendor'}
                        </span>
                        <Badge tone={VENDOR_PAYMENT_TONE[payment.status]}>
                          {payment.status}
                        </Badge>
                      </div>
                      <div className="tnum mt-0.5 text-xs text-muted-foreground">
                        {formatRupiah(payment.amount_paid)} dari{' '}
                        {formatRupiah(payment.vendor_payable)}
                      </div>
                    </li>
                  ))}
                </ul>
              ) : (
                <EmptyState title="Belum ada perjanjian borongan" />
              )}
            </CardContent>
          </Card>
        </div>
      )}
    </div>
  )
}

function Figure({
  label,
  value,
  tone,
  muted,
}: {
  label: string
  value: number | string
  tone?: 'success' | 'danger'
  muted?: boolean
}) {
  return (
    <div>
      <div className="text-[11px] font-extrabold tracking-wider text-slate-500 uppercase">
        {label}
      </div>
      <div
        className={cn(
          'tnum mt-0.5 text-lg font-black',
          tone === 'danger'
            ? 'text-danger'
            : tone === 'success'
              ? 'text-success'
              : muted
                ? 'text-muted-foreground'
                : 'text-slate-900',
        )}
      >
        {formatRupiah(value)}
      </div>
    </div>
  )
}
