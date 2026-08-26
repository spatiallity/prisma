import type { Metadata } from 'next'
import Link from 'next/link'
import { PageHeader, EmptyState } from '@/components/ui/page-header'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Table, Td, Th, Tr } from '@/components/ui/table'
import { Badge, StatusBadge } from '@/components/ui/badge'
import { Alert } from '@/components/ui/alert'
import { requirePermission } from '@/lib/auth/session'
import { createClient } from '@/lib/supabase/server'
import { can } from '@/lib/auth/permissions'
import { cn, formatDate, formatRupiah } from '@/lib/utils'
import { VENDOR_PAYMENT_TONE } from '@/lib/financial'
import {
  CashEntryForm,
  PersonnelCostForm,
  SpendingStatusToggle,
  TermForm,
  TermPaidToggle,
  VendorPaymentForm,
} from '../spending-forms'

export const metadata: Metadata = { title: 'Spending' }

const PAGE_SIZE = 40

/**
 * Section 25.6 — the three kinds of cost, on one screen because they are read
 * together: petty cash, personnel, and what is owed to vendors.
 */
export default async function SpendingPage() {
  const user = await requirePermission('spending', 'view')
  const mayEdit = can(user.permissions, 'spending', 'edit')

  const supabase = await createClient()

  const [
    { data: ledger, error },
    { data: balance },
    { data: categories },
    { data: personnelCosts },
    { data: personnel },
    { data: vendorPayments },
    { data: terms },
    { data: spks },
    { data: vendors },
  ] = await Promise.all([
    supabase
      .from('v_cash_ledger')
      .select('*')
      .order('entry_date', { ascending: false })
      .limit(PAGE_SIZE),
    supabase.from('v_cash_balance').select('*').maybeSingle(),
    supabase
      .from('cash_ledger_categories')
      .select('id, code, name')
      .eq('status', 'Active')
      .order('sort_order'),
    supabase
      .from('personnel_costs')
      .select('*')
      .order('period', { ascending: false })
      .limit(PAGE_SIZE),
    supabase.from('personnel').select('id, full_name, position').eq('status', 'Active'),
    supabase.from('vendor_payments').select('*').order('created_at', { ascending: false }),
    supabase.from('vendor_payment_terms').select('*').eq('status', 'Active').order('sequence'),
    supabase
      .from('spks')
      .select('id, spk_number, site_code, work_name, status')
      .order('spk_number'),
    supabase.from('vendors').select('id, name, code').eq('status', 'Active').order('name'),
  ])

  const categoryName = new Map((categories ?? []).map((c) => [c.id, c.name]))
  const personnelName = new Map((personnel ?? []).map((p) => [p.id, p.full_name]))
  const vendorName = new Map((vendors ?? []).map((v) => [v.id, v.name]))
  const spkById = new Map((spks ?? []).map((s) => [s.id, s]))

  const termsByPayment = new Map<string, typeof terms>()
  for (const term of terms ?? []) {
    const list = termsByPayment.get(term.vendor_payment_id) ?? []
    list.push(term)
    termsByPayment.set(term.vendor_payment_id, list)
  }

  const spkChoices = (spks ?? [])
    .filter((s) => s.status !== 'Cancelled')
    .map((s) => ({ id: s.id, label: `${s.spk_number} — ${s.work_name}` }))

  const lowBalance = (balance?.balance ?? 0) < 5_000_000

  return (
    <>
      <PageHeader
        title="Spending"
        description="Section 25.6 — kas kecil mess, biaya personel, dan pembayaran vendor. Ketiganya yang membentuk Total Cost per SPK."
      />

      {error && (
        <Alert tone="danger" className="mb-4" title="Gagal memuat data">
          {error.message}
        </Alert>
      )}

      <div className="mb-5 grid gap-4 sm:grid-cols-4">
        <Card className={cn(lowBalance && 'border-danger/40')}>
          <CardContent className="p-4">
            <div className="text-[11px] font-extrabold tracking-wider text-slate-500 uppercase">
              Saldo kas kecil
            </div>
            <div
              className={cn(
                'tnum mt-1 text-2xl font-black',
                lowBalance ? 'text-danger' : 'text-slate-900',
              )}
            >
              {formatRupiah(balance?.balance ?? 0)}
            </div>
            <div className="mt-0.5 text-xs text-muted-foreground">
              {lowBalance ? 'Di bawah threshold Rp 5 juta' : 'Di atas threshold'}
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="text-[11px] font-extrabold tracking-wider text-slate-500 uppercase">
              Total masuk
            </div>
            <div className="tnum mt-1 text-2xl font-black text-slate-900">
              {formatRupiah(balance?.total_in ?? 0)}
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="text-[11px] font-extrabold tracking-wider text-slate-500 uppercase">
              Total keluar
            </div>
            <div className="tnum mt-1 text-2xl font-black text-slate-900">
              {formatRupiah(balance?.total_out ?? 0)}
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="text-[11px] font-extrabold tracking-wider text-slate-500 uppercase">
              Entri terakhir
            </div>
            <div className="tnum mt-1 text-lg font-black text-slate-900">
              {formatDate(balance?.last_entry_date)}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* --- Cash ledger --------------------------------------------------- */}
      <Card className="mb-5 overflow-hidden">
        <CardHeader>
          <div>
            <CardTitle>Kas kecil mess</CardTitle>
            <CardDescription>
              Saldo dihitung dengan window function, bukan disimpan — koreksi
              mundur tidak akan membuat ledger tidak seimbang (Section 4.3).
            </CardDescription>
          </div>
        </CardHeader>

        {ledger && ledger.length > 0 ? (
          <Table>
            <thead>
              <tr>
                <Th>Tanggal</Th>
                <Th>Kategori</Th>
                <Th>Keterangan</Th>
                <Th>SPK</Th>
                <Th className="text-right">Masuk</Th>
                <Th className="text-right">Keluar</Th>
                <Th className="text-right">Saldo</Th>
                {mayEdit && <Th className="text-right">Aksi</Th>}
              </tr>
            </thead>
            <tbody>
              {ledger.map((entry) => {
                const spk = entry.spk_id ? spkById.get(entry.spk_id) : null
                return (
                  <Tr key={entry.id}>
                    <Td className="tnum whitespace-nowrap font-semibold">
                      {formatDate(entry.entry_date)}
                    </Td>
                    <Td className="text-muted-foreground">
                      {entry.category_id ? (categoryName.get(entry.category_id) ?? '—') : '—'}
                    </Td>
                    <Td className="max-w-xs">
                      {entry.description ?? '—'}
                      {entry.pic_name && (
                        <div className="text-xs text-muted-foreground">{entry.pic_name}</div>
                      )}
                    </Td>
                    <Td>
                      {spk ? (
                        <Link
                          href={`/spk/${spk.id}`}
                          className="text-xs font-bold text-primary hover:underline"
                        >
                          {spk.site_code ?? spk.spk_number}
                        </Link>
                      ) : (
                        <Badge>overhead</Badge>
                      )}
                    </Td>
                    <Td className="tnum text-right text-success">
                      {entry.amount_in > 0 ? formatRupiah(entry.amount_in) : '—'}
                    </Td>
                    <Td className="tnum text-right">
                      {entry.amount_out > 0 ? formatRupiah(entry.amount_out) : '—'}
                    </Td>
                    <Td className="tnum text-right font-bold">
                      {formatRupiah(entry.balance)}
                    </Td>
                    {mayEdit && (
                      <Td className="text-right">
                        <SpendingStatusToggle kind="cash" id={entry.id} status={entry.status} />
                      </Td>
                    )}
                  </Tr>
                )
              })}
            </tbody>
          </Table>
        ) : (
          <EmptyState title="Belum ada entri kas" />
        )}

        {mayEdit && (
          <div className="border-t border-slate-100 px-5 py-4">
            <CashEntryForm
              categories={(categories ?? []).map((c) => ({
                id: c.id,
                label: `${c.name} (${c.code})`,
              }))}
              spks={spkChoices}
            />
          </div>
        )}
      </Card>

      {/* --- Personnel cost ------------------------------------------------ */}
      <Card className="mb-5 overflow-hidden">
        <CardHeader>
          <div>
            <CardTitle>Biaya personel</CardTitle>
            <CardDescription>
              Gaji, MCU, honor. Yang tidak ditandai ke SPK dihitung sebagai
              overhead project (Section 26.3).
            </CardDescription>
          </div>
        </CardHeader>

        {personnelCosts && personnelCosts.length > 0 ? (
          <Table>
            <thead>
              <tr>
                <Th>Periode</Th>
                <Th>Personel</Th>
                <Th>Jenis</Th>
                <Th>SPK</Th>
                <Th className="text-right">Jumlah</Th>
                <Th>Status</Th>
                {mayEdit && <Th className="text-right">Aksi</Th>}
              </tr>
            </thead>
            <tbody>
              {personnelCosts.map((cost) => {
                const spk = cost.spk_id ? spkById.get(cost.spk_id) : null
                return (
                  <Tr key={cost.id}>
                    <Td className="tnum whitespace-nowrap font-semibold">
                      {formatDate(cost.period)}
                    </Td>
                    <Td className="font-bold text-slate-900">
                      {personnelName.get(cost.personnel_id) ?? '—'}
                    </Td>
                    <Td>
                      <Badge>{cost.cost_type}</Badge>
                    </Td>
                    <Td>
                      {spk ? (
                        <Link
                          href={`/spk/${spk.id}`}
                          className="text-xs font-bold text-primary hover:underline"
                        >
                          {spk.site_code ?? spk.spk_number}
                        </Link>
                      ) : (
                        <Badge>overhead</Badge>
                      )}
                    </Td>
                    <Td className="tnum text-right font-bold">{formatRupiah(cost.amount)}</Td>
                    <Td>
                      <StatusBadge status={cost.status} />
                    </Td>
                    {mayEdit && (
                      <Td className="text-right">
                        <SpendingStatusToggle
                          kind="personnel"
                          id={cost.id}
                          status={cost.status}
                        />
                      </Td>
                    )}
                  </Tr>
                )
              })}
            </tbody>
          </Table>
        ) : (
          <EmptyState title="Belum ada biaya personel" />
        )}

        {mayEdit && (
          <div className="border-t border-slate-100 px-5 py-4">
            <PersonnelCostForm
              personnel={(personnel ?? []).map((p) => ({
                id: p.id,
                label: p.position ? `${p.full_name} — ${p.position}` : p.full_name,
              }))}
              spks={spkChoices}
            />
          </div>
        )}
      </Card>

      {/* --- Vendor payment ------------------------------------------------ */}
      <Card className="overflow-hidden">
        <CardHeader>
          <div>
            <CardTitle>Pembayaran vendor</CardTitle>
            <CardDescription>
              Payable = nilai kontrak × persentase borongan, dihitung database.
              Status Lunas/Sebagian diturunkan dari termin yang sudah dibayar.
            </CardDescription>
          </div>
        </CardHeader>

        {vendorPayments && vendorPayments.length > 0 ? (
          <div className="divide-y divide-slate-100">
            {vendorPayments.map((payment) => {
              const spk = spkById.get(payment.spk_id)
              const paymentTerms = termsByPayment.get(payment.id) ?? []
              const outstanding = Number(payment.vendor_payable) - Number(payment.amount_paid)

              return (
                <div key={payment.id} className="px-5 py-4">
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div>
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="font-bold text-slate-900">
                          {vendorName.get(payment.vendor_id) ?? 'Vendor'}
                        </span>
                        {spk && (
                          <Link
                            href={`/spk/${spk.id}`}
                            className="text-xs font-bold text-primary hover:underline"
                          >
                            {spk.site_code ?? spk.spk_number}
                          </Link>
                        )}
                        <Badge tone={VENDOR_PAYMENT_TONE[payment.status]}>
                          {payment.status}
                        </Badge>
                      </div>
                      <div className="tnum mt-1 text-xs text-muted-foreground">
                        {formatRupiah(payment.contract_value)} × {payment.agreed_percentage}% ={' '}
                        <strong className="text-slate-900">
                          {formatRupiah(payment.vendor_payable)}
                        </strong>
                      </div>
                    </div>
                    <div className="text-right">
                      <div className="text-[11px] font-extrabold tracking-wider text-slate-500 uppercase">
                        Sisa
                      </div>
                      <div
                        className={cn(
                          'tnum text-lg font-black',
                          outstanding > 0 ? 'text-danger' : 'text-success',
                        )}
                      >
                        {formatRupiah(outstanding)}
                      </div>
                    </div>
                  </div>

                  {paymentTerms.length > 0 && (
                    <ul className="mt-3 grid gap-1.5">
                      {paymentTerms.map((term) => (
                        <li
                          key={term.id}
                          className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-slate-200 bg-surface-muted px-3 py-1.5"
                        >
                          <span className="flex items-center gap-2 text-xs">
                            <Badge tone={term.paid_date ? 'success' : 'neutral'}>
                              {term.term_type} {term.sequence}
                            </Badge>
                            <span className="tnum font-bold text-slate-900">
                              {formatRupiah(term.amount)}
                            </span>
                            <span className="text-muted-foreground">
                              {term.paid_date
                                ? `dibayar ${formatDate(term.paid_date)}`
                                : term.due_date
                                  ? `jatuh tempo ${formatDate(term.due_date)}`
                                  : 'tanpa jatuh tempo'}
                            </span>
                          </span>
                          {mayEdit && (
                            <TermPaidToggle id={term.id} paidDate={term.paid_date} />
                          )}
                        </li>
                      ))}
                    </ul>
                  )}
                </div>
              )
            })}
          </div>
        ) : (
          <EmptyState title="Belum ada perjanjian borongan" />
        )}

        {mayEdit && (
          <div className="grid gap-5 border-t border-slate-100 px-5 py-4">
            <VendorPaymentForm
              spks={spkChoices}
              vendors={(vendors ?? []).map((v) => ({
                id: v.id,
                label: `${v.name} (${v.code})`,
              }))}
            />
            <div className="border-t border-slate-100 pt-4">
              <TermForm
                vendorPayments={(vendorPayments ?? []).map((p) => {
                  const spk = spkById.get(p.spk_id)
                  return {
                    id: p.id,
                    label: `${vendorName.get(p.vendor_id) ?? 'Vendor'} · ${spk?.site_code ?? spk?.spk_number ?? 'SPK'}`,
                  }
                })}
              />
            </div>
          </div>
        )}
      </Card>
    </>
  )
}
