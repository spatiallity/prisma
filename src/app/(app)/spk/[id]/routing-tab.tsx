import Link from 'next/link'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Table, Td, Th, Tr } from '@/components/ui/table'
import { EmptyState } from '@/components/ui/page-header'
import { createClient } from '@/lib/supabase/server'
import { cn, formatDateTime } from '@/lib/utils'
import type { RoutingLeadTimeView } from '@/lib/supabase/types'
import { ROUTING_TONE, formatDays } from '@/lib/routing'

/**
 * Section 12 — the Routing tab of Detail SPK: which documents this SPK has in
 * flight and where each one sits. Read-only; /routing owns the workflow.
 */
export async function RoutingTab({ spkId }: { spkId: string }) {
  const supabase = await createClient()

  const [{ data: documents }, { data: lead }, { data: stages }] = await Promise.all([
    supabase
      .from('spk_routing')
      .select('*')
      .eq('spk_id', spkId)
      .order('created_at', { ascending: false }),
    supabase.from('v_routing_lead_time').select('*').eq('spk_id', spkId),
    supabase.from('routing_history').select('id, spk_routing_id, pic_name'),
  ])

  if (!documents || documents.length === 0) {
    return (
      <Card>
        <CardContent className="p-0">
          <EmptyState
            title="Belum ada dokumen dirutekan"
            description="Rutekan Berita Acara, PAD, atau Invoice dari Routing Monitor."
            action={
              <Link
                href="/routing"
                className="text-sm font-bold text-primary hover:underline"
              >
                Buka Routing Monitor
              </Link>
            }
          />
        </CardContent>
      </Card>
    )
  }

  const picByStage = new Map((stages ?? []).map((s) => [s.id, s.pic_name]))

  const currentByDoc = new Map<string, RoutingLeadTimeView>()
  const totalByDoc = new Map<string, number>()
  for (const row of lead ?? []) {
    totalByDoc.set(
      row.spk_routing_id,
      (totalByDoc.get(row.spk_routing_id) ?? 0) + Number(row.duration_days ?? 0),
    )
    if (row.status === 'Completed') continue
    const held = currentByDoc.get(row.spk_routing_id)
    if (!held || row.sequence < held.sequence) currentByDoc.set(row.spk_routing_id, row)
  }

  return (
    <Card className="overflow-hidden">
      <CardHeader>
        <div>
          <CardTitle>Dokumen SPK ini</CardTitle>
        </div>
        <Link href="/routing" className="text-xs font-bold text-primary hover:underline">
          Kelola
        </Link>
      </CardHeader>

      <Table>
        <thead>
          <tr>
            <Th>Dokumen</Th>
            <Th>Posisi sekarang</Th>
            <Th>PIC</Th>
            <Th className="text-right">Di tahap ini</Th>
            <Th className="text-right">Total lead time</Th>
            <Th>Status</Th>
          </tr>
        </thead>
        <tbody>
          {documents.map((doc) => {
            const current = currentByDoc.get(doc.id)
            const late = current?.is_overdue ?? false
            return (
              <Tr key={doc.id}>
                <Td>
                  <Link
                    href={`/routing/${doc.id}`}
                    className="font-bold text-primary hover:underline"
                  >
                    {doc.document_type}
                  </Link>
                  {doc.document_number && (
                    <div className="text-xs text-muted-foreground">
                      {doc.document_number}
                    </div>
                  )}
                </Td>
                <Td className="text-muted-foreground">
                  {current?.step_name ?? 'Selesai'}
                  {current?.started_at && (
                    <div className="text-xs">{formatDateTime(current.started_at)}</div>
                  )}
                </Td>
                <Td className="text-muted-foreground">
                  {current ? (picByStage.get(current.routing_history_id) ?? '—') : '—'}
                </Td>
                <Td className={cn('tnum text-right', late && 'font-bold text-danger')}>
                  {formatDays(current?.elapsed_days ?? null)}
                </Td>
                <Td className="tnum text-right">
                  {formatDays(totalByDoc.get(doc.id) ?? 0)}
                </Td>
                <Td>
                  <Badge tone={late ? 'danger' : ROUTING_TONE[doc.status]}>
                    {late ? 'Lewat SLA' : doc.status}
                  </Badge>
                </Td>
              </Tr>
            )
          })}
        </tbody>
      </Table>
    </Card>
  )
}
