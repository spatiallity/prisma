import type { Metadata } from 'next'
import Link from 'next/link'
import { PageHeader, EmptyState } from '@/components/ui/page-header'
import { Card, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Table, Td, Th, Tr } from '@/components/ui/table'
import { Badge } from '@/components/ui/badge'
import { requirePermission } from '@/lib/auth/session'
import { createClient } from '@/lib/supabase/server'
import { can } from '@/lib/auth/permissions'
import { cn, formatDate, formatRupiah } from '@/lib/utils'
import { SPK_STATUS_TONE, daysLeft, formatArea, formatPercent } from '@/lib/spk'

export const metadata: Metadata = { title: 'SPK Report' }

/**
 * One row per SPK carrying every headline number the project asks about, so a
 * recap can be read or copied without opening each SPK in turn — the thing
 * Section 2 says the spreadsheets were being used for.
 */
export default async function SpkReportPage() {
  const user = await requirePermission('report', 'view')
  const seeFinancial = can(user.permissions, 'contract', 'view')

  const supabase = await createClient()
  const [{ data: spks }, { data: progress }, { data: financial }, { data: vendors }] =
    await Promise.all([
      supabase.from('spks').select('*').order('spk_number'),
      supabase.from('v_spk_progress').select('*'),
      seeFinancial
        ? supabase.from('v_spk_financial').select('*')
        : Promise.resolve({ data: [] }),
      supabase.from('vendors').select('id, name'),
    ])

  const progressBySpk = new Map((progress ?? []).map((p) => [p.spk_id, p]))
  const financialBySpk = new Map((financial ?? []).map((f) => [f.spk_id, f]))
  const vendorName = new Map((vendors ?? []).map((v) => [v.id, v.name]))

  const totalContract = (spks ?? []).reduce(
    (sum, s) => sum + Number(s.contract_value ?? 0),
    0,
  )
  const totalArea = (spks ?? []).reduce((sum, s) => sum + Number(s.area_ha ?? 0), 0)

  return (
    <>
      <PageHeader
        title="SPK Report"
        description="Satu baris per SPK dengan seluruh angka utamanya — untuk rekap tanpa membuka satu per satu."
      />

      <Card className="overflow-hidden">
        <CardHeader>
          <div>
            <CardTitle>{spks?.length ?? 0} SPK</CardTitle>
            <CardDescription>
              Total {formatArea(totalArea)} · {formatRupiah(totalContract)}
            </CardDescription>
          </div>
        </CardHeader>

        {spks && spks.length > 0 ? (
          <Table>
            <thead>
              <tr>
                <Th>SPK</Th>
                <Th>Pekerjaan</Th>
                <Th>Vendor</Th>
                <Th className="text-right">Luas</Th>
                <Th className="text-right">Nilai kontrak</Th>
                <Th>Periode</Th>
                <Th className="text-right">Progress</Th>
                {seeFinancial && <Th className="text-right">Invoice</Th>}
                {seeFinancial && <Th className="text-right">Outstanding</Th>}
                <Th>Status</Th>
              </tr>
            </thead>
            <tbody>
              {spks.map((spk) => {
                const prog = progressBySpk.get(spk.id)
                const fin = financialBySpk.get(spk.id)
                const remaining = daysLeft(spk.end_date)
                const overdue =
                  remaining !== null && remaining < 0 && spk.status === 'On Going'

                return (
                  <Tr key={spk.id}>
                    <Td>
                      <Link
                        href={`/spk/${spk.id}`}
                        className="font-bold text-primary hover:underline"
                      >
                        {spk.spk_number}
                      </Link>
                      {spk.site_code && (
                        <div className="text-xs text-muted-foreground">
                          {spk.site_code}
                        </div>
                      )}
                    </Td>
                    <Td className="max-w-xs">
                      <span className="line-clamp-1 font-bold text-slate-900">
                        {spk.work_name}
                      </span>
                      {spk.location && (
                        <div className="text-xs text-muted-foreground">
                          {spk.location}
                        </div>
                      )}
                    </Td>
                    <Td className="text-muted-foreground">
                      {spk.vendor_id ? (vendorName.get(spk.vendor_id) ?? '—') : '—'}
                    </Td>
                    <Td className="tnum text-right">{formatArea(spk.area_ha)}</Td>
                    <Td className="tnum text-right">{formatRupiah(spk.contract_value)}</Td>
                    <Td className="tnum whitespace-nowrap text-muted-foreground">
                      {formatDate(spk.start_date)} – {formatDate(spk.end_date)}
                      {overdue && (
                        <div className="text-xs font-bold text-danger">
                          Lewat {Math.abs(remaining)} hari
                        </div>
                      )}
                    </Td>
                    <Td className="tnum text-right font-bold">
                      {formatPercent(prog?.overall_progress ?? 0)}
                    </Td>
                    {seeFinancial && (
                      <Td className="tnum text-right">
                        {formatRupiah(fin?.invoice_total ?? 0)}
                      </Td>
                    )}
                    {seeFinancial && (
                      <Td
                        className={cn(
                          'tnum text-right',
                          Number(fin?.outstanding_payment ?? 0) > 0 && 'font-bold text-danger',
                        )}
                      >
                        {Number(fin?.outstanding_payment ?? 0) > 0
                          ? formatRupiah(fin?.outstanding_payment)
                          : '—'}
                      </Td>
                    )}
                    <Td>
                      <Badge tone={SPK_STATUS_TONE[spk.status]}>{spk.status}</Badge>
                    </Td>
                  </Tr>
                )
              })}
            </tbody>
          </Table>
        ) : (
          <EmptyState title="Belum ada SPK" />
        )}
      </Card>
    </>
  )
}
