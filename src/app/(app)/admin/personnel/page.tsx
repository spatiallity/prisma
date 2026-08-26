import type { Metadata } from 'next'
import { PageHeader, EmptyState } from '@/components/ui/page-header'
import { Card, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Table, Td, Th, Tr } from '@/components/ui/table'
import { StatusBadge } from '@/components/ui/badge'
import { Alert } from '@/components/ui/alert'
import { requirePermission } from '@/lib/auth/session'
import { createClient } from '@/lib/supabase/server'
import { can } from '@/lib/auth/permissions'
import { formatDate, formatRupiah } from '@/lib/utils'
import { PersonnelForm, PersonnelStatusToggle } from './forms'

export const metadata: Metadata = { title: 'Master Personnel' }

/** Section 25.6.2 — the internal team whose salary, MCU and honor are recorded. */
export default async function PersonnelPage() {
  const user = await requirePermission('master_data', 'view')
  const mayEdit = can(user.permissions, 'master_data', 'edit')
  const seeCost = can(user.permissions, 'spending', 'view')

  const supabase = await createClient()
  const [{ data: personnel, error }, { data: costs }] = await Promise.all([
    supabase.from('personnel').select('*').order('full_name'),
    seeCost
      ? supabase
          .from('personnel_costs')
          .select('personnel_id, amount')
          .eq('status', 'Active')
      : Promise.resolve({ data: [] }),
  ])

  const spend = new Map<string, { count: number; total: number }>()
  for (const cost of costs ?? []) {
    const current = spend.get(cost.personnel_id) ?? { count: 0, total: 0 }
    current.count += 1
    current.total += Number(cost.amount)
    spend.set(cost.personnel_id, current)
  }

  return (
    <>
      <PageHeader
        title="Master Personnel"
        description="Tim internal project. Biaya gaji, MCU, dan honor dicatat di Spending dan menempel ke personel di sini."
      />

      {error && (
        <Alert tone="danger" className="mb-4" title="Gagal memuat data">
          {error.message}
        </Alert>
      )}

      <Card className="overflow-hidden">
        <CardHeader>
          <div>
            <CardTitle>{personnel?.length ?? 0} personel</CardTitle>
            <CardDescription>
              Yang keluar dinonaktifkan, bukan dihapus — biaya yang sudah tercatat
              harus tetap terbaca (Section 4.4).
            </CardDescription>
          </div>
        </CardHeader>

        {personnel && personnel.length > 0 ? (
          <Table>
            <thead>
              <tr>
                <Th>Nama</Th>
                <Th>Kode</Th>
                <Th>Posisi</Th>
                <Th>Masuk</Th>
                {seeCost && <Th className="text-right">Entri biaya</Th>}
                {seeCost && <Th className="text-right">Total biaya</Th>}
                <Th>Status</Th>
                {mayEdit && <Th className="text-right">Aksi</Th>}
              </tr>
            </thead>
            <tbody>
              {personnel.map((person) => {
                const stat = spend.get(person.id) ?? { count: 0, total: 0 }
                return (
                  <Tr key={person.id}>
                    <Td className="font-bold text-slate-900">{person.full_name}</Td>
                    <Td>
                      {person.code ? (
                        <span className="code text-xs">{person.code}</span>
                      ) : (
                        <span className="text-muted-foreground">—</span>
                      )}
                    </Td>
                    <Td className="text-muted-foreground">{person.position ?? '—'}</Td>
                    <Td className="tnum text-muted-foreground">
                      {formatDate(person.join_date)}
                    </Td>
                    {seeCost && <Td className="tnum text-right">{stat.count}</Td>}
                    {seeCost && (
                      <Td className="tnum text-right font-bold">
                        {stat.total > 0 ? formatRupiah(stat.total) : '—'}
                      </Td>
                    )}
                    <Td>
                      <StatusBadge status={person.status} />
                    </Td>
                    {mayEdit && (
                      <Td className="text-right">
                        <PersonnelStatusToggle id={person.id} status={person.status} />
                      </Td>
                    )}
                  </Tr>
                )
              })}
            </tbody>
          </Table>
        ) : (
          <EmptyState
            title="Belum ada personel"
            description="Tambahkan tim internal agar biaya gaji dan MCU bisa dicatat."
          />
        )}

        {mayEdit && (
          <div className="border-t border-slate-100 px-5 py-4">
            <PersonnelForm />
          </div>
        )}
      </Card>
    </>
  )
}
