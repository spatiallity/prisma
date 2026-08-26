import type { Metadata } from 'next'
import Link from 'next/link'
import { PageHeader, EmptyState } from '@/components/ui/page-header'
import { Card, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Table, Td, Th, Tr } from '@/components/ui/table'
import { Badge } from '@/components/ui/badge'
import { Alert } from '@/components/ui/alert'
import { requirePermission } from '@/lib/auth/session'
import { createClient } from '@/lib/supabase/server'
import { formatDateTime } from '@/lib/utils'

export const metadata: Metadata = { title: 'Recent Activity' }

const PAGE_SIZE = 60

const ACTION_TONE = {
  INSERT: 'success',
  UPDATE: 'info',
  DELETE: 'danger',
} as const

/** Table name → the screen where that record is managed. */
const TABLE_LABEL: Record<string, string> = {
  spks: 'SPK',
  spk_activities: 'Aktivitas',
  activity_progress: 'Progress aktivitas',
  daily_plans: 'Daily Plan',
  daily_progress: 'Daily Progress',
  designs: 'Desain',
  design_revisions: 'Tahap desain',
  spk_routing: 'Dokumen routing',
  routing_history: 'Tahap routing',
  contracts: 'Contract',
  opnames: 'Opname',
  pad: 'PAD',
  invoices: 'Invoice',
  payments: 'Payment',
  cash_ledger: 'Kas kecil',
  personnel_costs: 'Biaya personel',
  vendor_payments: 'Pembayaran vendor',
  vendor_payment_terms: 'Termin vendor',
  vendors: 'Vendor',
  vendor_teams: 'Team',
  vendor_members: 'Anggota team',
  users: 'User',
  roles: 'Role',
  role_permissions: 'Permission',
}

/**
 * Section 33 — the project's change feed. Vendor accounts see only their own
 * actions; RLS applies the `own` scope, so nothing is filtered here.
 */
export default async function RecentActivityPage() {
  await requirePermission('audit_log', 'view')

  const supabase = await createClient()
  const { data: entries, error } = await supabase
    .from('audit_logs')
    .select('*')
    .order('changed_at', { ascending: false })
    .limit(PAGE_SIZE)

  const actorIds = [
    ...new Set((entries ?? []).map((e) => e.changed_by).filter(Boolean)),
  ] as string[]
  const spkIds = [
    ...new Set((entries ?? []).map((e) => e.spk_id).filter(Boolean)),
  ] as string[]

  const [{ data: actors }, { data: spks }] = await Promise.all([
    actorIds.length
      ? supabase.from('users').select('id, full_name').in('id', actorIds)
      : Promise.resolve({ data: [] }),
    spkIds.length
      ? supabase.from('spks').select('id, spk_number, site_code').in('id', spkIds)
      : Promise.resolve({ data: [] }),
  ])

  const actorName = new Map((actors ?? []).map((a) => [a.id, a.full_name]))
  const spkById = new Map((spks ?? []).map((s) => [s.id, s]))

  return (
    <>
      <PageHeader
        title="Recent Activity"
        description={`Section 33 — ${PAGE_SIZE} perubahan terakhir di seluruh project, beserta siapa yang melakukannya.`}
      />

      {error && (
        <Alert tone="danger" className="mb-4" title="Gagal memuat data">
          {error.message}
        </Alert>
      )}

      <Card className="overflow-hidden">
        <CardHeader>
          <div>
            <CardTitle>Perubahan terakhir</CardTitle>
            <CardDescription>
              Dicatat trigger di 33 tabel — tidak ada kode aplikasi yang menulis
              baris ini.
            </CardDescription>
          </div>
          <Link
            href="/admin/audit-log"
            className="text-xs font-bold text-primary hover:underline"
          >
            Audit Log lengkap
          </Link>
        </CardHeader>

        {entries && entries.length > 0 ? (
          <Table>
            <thead>
              <tr>
                <Th>Waktu</Th>
                <Th>User</Th>
                <Th>Aksi</Th>
                <Th>Objek</Th>
                <Th>SPK</Th>
                <Th>Field berubah</Th>
              </tr>
            </thead>
            <tbody>
              {entries.map((entry) => {
                const spk = entry.spk_id ? spkById.get(entry.spk_id) : null
                return (
                  <Tr key={entry.id}>
                    <Td className="tnum whitespace-nowrap text-muted-foreground">
                      {formatDateTime(entry.changed_at)}
                    </Td>
                    <Td className="font-semibold">
                      {entry.changed_by
                        ? (actorName.get(entry.changed_by) ?? 'Tidak dikenal')
                        : 'Sistem'}
                    </Td>
                    <Td>
                      <Badge tone={ACTION_TONE[entry.action]}>{entry.action}</Badge>
                    </Td>
                    <Td className="font-bold text-slate-900">
                      {TABLE_LABEL[entry.table_name] ?? entry.table_name}
                    </Td>
                    <Td>
                      {spk ? (
                        <Link
                          href={`/spk/${spk.id}`}
                          className="font-bold text-primary hover:underline"
                        >
                          {spk.site_code ?? spk.spk_number}
                        </Link>
                      ) : (
                        <span className="text-muted-foreground">—</span>
                      )}
                    </Td>
                    <Td className="max-w-md text-muted-foreground">
                      {entry.changed_fields?.length
                        ? entry.changed_fields.join(', ')
                        : '—'}
                    </Td>
                  </Tr>
                )
              })}
            </tbody>
          </Table>
        ) : (
          <EmptyState
            title="Belum ada perubahan tercatat"
            description="Entri muncul begitu data pertama diubah."
          />
        )}
      </Card>
    </>
  )
}
