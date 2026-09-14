import type { Metadata } from 'next'
import { PageHeader, EmptyState } from '@/components/ui/page-header'
import { Card, CardContent } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Table, Td, Th, Tr } from '@/components/ui/table'
import { SpkCell } from '@/components/ui/spk-cell'
import { requirePermission } from '@/lib/auth/session'
import { createClient } from '@/lib/supabase/server'
import { formatDate } from '@/lib/utils'

export const metadata: Metadata = { title: 'PAD' }

/**
 * Section 25.2/25.3 — PAD is a mark on the SPK itself (migration 0018), not a
 * routed document, so this page is a read-only list of who's been marked.
 * Marking/unmarking still happens in the Financial tab of Detail SPK.
 */
export default async function PadPage() {
  await requirePermission('pad', 'view')
  const supabase = await createClient()

  const { data: spks } = await supabase
    .from('spks')
    .select('id, spk_number, site_code, work_name, status, opname_marked_at, pad_marked_at')
    .neq('status', 'Cancelled')
    .order('pad_marked_at', { ascending: false, nullsFirst: false })
    .order('spk_number')

  const rows = spks ?? []
  const padded = rows.filter((s) => s.pad_marked_at)

  return (
    <>
      <PageHeader
        title="PAD"
        description="SPK yang sudah ditandai PAD, sebelum masuk ke Invoice."
      />

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
                <Th>Opname</Th>
                <Th>PAD</Th>
                <Th>Tanggal PAD</Th>
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
                  <Td>
                    <Badge tone={s.opname_marked_at ? 'success' : 'neutral'}>
                      {s.opname_marked_at ? 'Sudah' : 'Belum'}
                    </Badge>
                  </Td>
                  <Td>
                    <Badge tone={s.pad_marked_at ? 'success' : 'neutral'}>
                      {s.pad_marked_at ? 'Sudah' : 'Belum'}
                    </Badge>
                  </Td>
                  <Td className="tnum text-xs text-muted-foreground">
                    {s.pad_marked_at ? formatDate(s.pad_marked_at) : '—'}
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
