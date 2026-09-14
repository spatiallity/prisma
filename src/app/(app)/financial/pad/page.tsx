import type { Metadata } from 'next'
import { PageHeader, EmptyState } from '@/components/ui/page-header'
import { Card, CardContent } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Table, Td, Th, Tr } from '@/components/ui/table'
import { SpkCell } from '@/components/ui/spk-cell'
import { requirePermission } from '@/lib/auth/session'
import { createClient } from '@/lib/supabase/server'
import { formatDate, formatRupiah } from '@/lib/utils'

export const metadata: Metadata = { title: 'PAD' }

/**
 * PAD is a mark on the SPK itself, not a routed document, so this page is a
 * read-only list of who's been marked. Marking/unmarking still happens in
 * the Financial tab of Detail SPK. An SPK drops off this list once it's both
 * PAD-marked and already has an invoice — from there it's Invoice's list to
 * track, not PAD's.
 */
export default async function PadPage() {
  await requirePermission('pad', 'view')
  const supabase = await createClient()

  const [{ data: spks }, { data: invoiced }] = await Promise.all([
    supabase
      .from('spks')
      .select(
        'id, spk_number, site_code, work_name, status, opname_marked_at, opname_value, pad_marked_at, pad_value',
      )
      .neq('status', 'Cancelled')
      .order('pad_marked_at', { ascending: false, nullsFirst: false })
      .order('spk_number'),
    supabase.from('invoices').select('spk_id').neq('status', 'Cancelled'),
  ])

  const invoicedSpkIds = new Set((invoiced ?? []).map((i) => i.spk_id))
  const rows = (spks ?? []).filter((s) => !(s.pad_marked_at && invoicedSpkIds.has(s.id)))
  const padded = rows.filter((s) => s.pad_marked_at)

  return (
    <>
      <PageHeader title="PAD" />

      <div className="mb-5 grid gap-4 sm:grid-cols-3">
        <Card>
          <CardContent className="p-4">
            <div className="text-[11px] font-extrabold tracking-wider text-slate-500 uppercase">
              Sudah PAD
            </div>
            <div className="tnum mt-1 text-2xl font-black text-slate-900">{padded.length}</div>
          </CardContent>
        </Card>
        <Card className="sm:col-span-2">
          <CardContent className="p-4">
            <div className="text-[11px] font-extrabold tracking-wider text-slate-500 uppercase">
              Total SPK aktif
            </div>
            <div className="tnum mt-1 text-2xl font-black text-slate-900">{rows.length}</div>
          </CardContent>
        </Card>
      </div>

      <Card className="overflow-hidden">
        {rows.length > 0 ? (
          <Table>
            <thead>
              <tr>
                <Th>SPK</Th>
                <Th>Pekerjaan</Th>
                <Th>Tanggal Opname</Th>
                <Th className="text-right">Nilai Opname</Th>
                <Th>Tanggal PAD</Th>
                <Th className="text-right">Nilai PAD</Th>
              </tr>
            </thead>
            <tbody>
              {rows.map((s) => (
                <Tr key={s.id}>
                  <Td>
                    <SpkCell
                      id={s.id}
                      spkNumber={s.spk_number}
                      siteCode={s.site_code}
                      href={`/spk/${s.id}?tab=financial`}
                    />
                  </Td>
                  <Td className="text-xs text-muted-foreground">{s.work_name}</Td>
                  <Td className="tnum text-xs text-muted-foreground">
                    {s.opname_marked_at ? (
                      formatDate(s.opname_marked_at)
                    ) : (
                      <Badge tone="neutral">Belum</Badge>
                    )}
                  </Td>
                  <Td className="tnum text-right text-xs text-muted-foreground">
                    {s.opname_value != null ? formatRupiah(s.opname_value) : '—'}
                  </Td>
                  <Td className="tnum text-xs text-muted-foreground">
                    {s.pad_marked_at ? (
                      formatDate(s.pad_marked_at)
                    ) : (
                      <Badge tone="neutral">Belum</Badge>
                    )}
                  </Td>
                  <Td className="tnum text-right text-xs text-muted-foreground">
                    {s.pad_value != null ? formatRupiah(s.pad_value) : '—'}
                  </Td>
                </Tr>
              ))}
            </tbody>
          </Table>
        ) : (
          <EmptyState title="Belum ada SPK" />
        )}
      </Card>
    </>
  )
}
