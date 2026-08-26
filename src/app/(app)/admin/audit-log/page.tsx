import type { Metadata } from 'next'
import { PageHeader, EmptyState } from '@/components/ui/page-header'
import { Card } from '@/components/ui/card'
import { Table, Td, Th, Tr } from '@/components/ui/table'
import { Badge } from '@/components/ui/badge'
import { Alert } from '@/components/ui/alert'
import { requirePermission } from '@/lib/auth/session'
import { createClient } from '@/lib/supabase/server'
import { formatDateTime } from '@/lib/utils'

export const metadata: Metadata = { title: 'Audit Log' }

const PAGE_SIZE = 50

const ACTION_TONE = {
  INSERT: 'success',
  UPDATE: 'info',
  DELETE: 'danger',
} as const

export default async function AuditLogPage() {
  await requirePermission('audit_log', 'view')

  const supabase = await createClient()

  // RLS narrows this to the caller's own rows when their scope is 'own'
  // (migration 0012), so no extra filter is needed here.
  const { data: entries, error } = await supabase
    .from('audit_logs')
    .select('*')
    .order('changed_at', { ascending: false })
    .limit(PAGE_SIZE)

  const actorIds = [
    ...new Set((entries ?? []).map((entry) => entry.changed_by).filter(Boolean)),
  ] as string[]

  const { data: actors } = actorIds.length
    ? await supabase.from('users').select('id, full_name').in('id', actorIds)
    : { data: [] }

  const actorName = new Map((actors ?? []).map((actor) => [actor.id, actor.full_name]))

  return (
    <>
      <PageHeader
        title="Audit Log"
        description={`Section 33 — siapa mengubah apa, kapan, dari nilai berapa. ${PAGE_SIZE} perubahan terakhir.`}
      />

      {error && (
        <Alert tone="danger" className="mb-4" title="Gagal memuat data">
          {error.message}
        </Alert>
      )}

      <Card className="overflow-hidden">
        {entries && entries.length > 0 ? (
          <Table>
            <thead>
              <tr>
                <Th>Waktu</Th>
                <Th>User</Th>
                <Th>Aksi</Th>
                <Th>Tabel</Th>
                <Th>Field berubah</Th>
              </tr>
            </thead>
            <tbody>
              {entries.map((entry) => (
                <Tr key={entry.id}>
                  <Td className="tnum whitespace-nowrap text-muted-foreground">
                    {formatDateTime(entry.changed_at)}
                  </Td>
                  <Td>
                    {entry.changed_by
                      ? (actorName.get(entry.changed_by) ?? 'Tidak dikenal')
                      : 'Sistem'}
                  </Td>
                  <Td>
                    <Badge tone={ACTION_TONE[entry.action]}>{entry.action}</Badge>
                  </Td>
                  <Td className="code text-xs">{entry.table_name}</Td>
                  <Td className="max-w-md text-muted-foreground">
                    {entry.changed_fields?.length
                      ? entry.changed_fields.join(', ')
                      : '—'}
                  </Td>
                </Tr>
              ))}
            </tbody>
          </Table>
        ) : (
          <EmptyState
            title="Belum ada perubahan tercatat"
            description="Trigger audit aktif di 33 tabel; entri muncul begitu data pertama diubah."
          />
        )}
      </Card>
    </>
  )
}
