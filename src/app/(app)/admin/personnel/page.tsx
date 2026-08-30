import type { Metadata } from 'next'
import { PageHeader, EmptyState } from '@/components/ui/page-header'
import { Card, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Alert } from '@/components/ui/alert'
import { requirePermission } from '@/lib/auth/session'
import { createClient } from '@/lib/supabase/server'
import { can } from '@/lib/auth/permissions'
import { AddPersonnelButton } from './forms'
import { PersonnelTable } from './personnel-table'

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
          .from('finance_transactions')
          .select('personnel_id, jumlah')
          .eq('status', 'Active')
          .not('personnel_id', 'is', null)
      : Promise.resolve({ data: [] }),
  ])

  const spend: Record<string, { count: number; total: number }> = {}
  for (const cost of costs ?? []) {
    if (!cost.personnel_id) continue
    const current = spend[cost.personnel_id] ?? { count: 0, total: 0 }
    current.count += 1
    current.total += Number(cost.jumlah)
    spend[cost.personnel_id] = current
  }

  return (
    <>
      <PageHeader
        title="Master Personnel"
        description="Tim internal project. Biaya gaji, MCU, dan honor dicatat di Finance (RAB) dan menempel ke personel di sini."
        actions={mayEdit && <AddPersonnelButton />}
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
              harus tetap terbaca.
            </CardDescription>
          </div>
        </CardHeader>

        {personnel && personnel.length > 0 ? (
          <PersonnelTable
            personnel={personnel}
            spend={spend}
            seeCost={seeCost}
            mayEdit={mayEdit}
          />
        ) : (
          <EmptyState
            title="Belum ada personel"
            description="Tambahkan tim internal agar biaya gaji dan MCU bisa dicatat."
          />
        )}
      </Card>
    </>
  )
}
