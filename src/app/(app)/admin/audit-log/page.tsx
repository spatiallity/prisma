import type { Metadata } from 'next'
import { PageHeader, EmptyState } from '@/components/ui/page-header'
import { Card } from '@/components/ui/card'
import { Alert } from '@/components/ui/alert'
import { requirePermission } from '@/lib/auth/session'
import { createClient } from '@/lib/supabase/server'
import { AuditLogTable } from './audit-log-table'

export const metadata: Metadata = { title: 'Audit Log' }

const PAGE_SIZE = 50

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

  const actorName = Object.fromEntries((actors ?? []).map((actor) => [actor.id, actor.full_name]))

  return (
    <>
      <PageHeader
        title="Audit Log"
        description={`Siapa mengubah apa, kapan, dari nilai berapa. ${PAGE_SIZE} perubahan terakhir.`}
      />

      {error && (
        <Alert tone="danger" className="mb-4" title="Gagal memuat data">
          {error.message}
        </Alert>
      )}

      <Card className="overflow-hidden">
        {entries && entries.length > 0 ? (
          <AuditLogTable entries={entries} actorName={actorName} />
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
