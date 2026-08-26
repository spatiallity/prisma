import type { Metadata } from 'next'
import Link from 'next/link'
import { PageHeader, EmptyState } from '@/components/ui/page-header'
import { Card } from '@/components/ui/card'
import { Table, Td, Th, Tr } from '@/components/ui/table'
import { Badge, StatusBadge } from '@/components/ui/badge'
import { Alert } from '@/components/ui/alert'
import { requirePermission } from '@/lib/auth/session'
import { createClient } from '@/lib/supabase/server'
import { formatPercent } from '@/lib/spk'

export const metadata: Metadata = { title: 'Activity Template' }

/** Section 17 — Progress Template master. */
export default async function ActivityTemplatesPage() {
  await requirePermission('master_data', 'view')

  const supabase = await createClient()
  const [{ data: templates, error }, { data: items }, { data: spks }] = await Promise.all([
    supabase.from('activity_templates').select('*').order('code'),
    supabase.from('activity_template_items').select('template_id, weight'),
    supabase.from('spks').select('activity_template_id'),
  ])

  const stats = new Map<string, { count: number; weight: number }>()
  for (const item of items ?? []) {
    const current = stats.get(item.template_id) ?? { count: 0, weight: 0 }
    current.count += 1
    current.weight += Number(item.weight)
    stats.set(item.template_id, current)
  }

  const usage = new Map<string, number>()
  for (const spk of spks ?? []) {
    if (!spk.activity_template_id) continue
    usage.set(spk.activity_template_id, (usage.get(spk.activity_template_id) ?? 0) + 1)
  }

  return (
    <>
      <PageHeader
        title="Activity Template"
        description="Daftar aktivitas beserta bobot dan jenis pengukurannya, dipakai ulang oleh setiap SPK (Section 17)."
      />

      {error && (
        <Alert tone="danger" className="mb-4" title="Gagal memuat data">
          {error.message}
        </Alert>
      )}

      <Card className="overflow-hidden">
        {templates && templates.length > 0 ? (
          <Table>
            <thead>
              <tr>
                <Th>Template</Th>
                <Th>Deskripsi</Th>
                <Th className="text-right">Aktivitas</Th>
                <Th className="text-right">Total bobot</Th>
                <Th className="text-right">Dipakai SPK</Th>
                <Th>Status</Th>
              </tr>
            </thead>
            <tbody>
              {templates.map((template) => {
                const stat = stats.get(template.id) ?? { count: 0, weight: 0 }
                const complete = Math.abs(stat.weight - 100) < 0.01

                return (
                  <Tr key={template.id}>
                    <Td>
                      <Link
                        href={`/admin/activity-templates/${template.id}`}
                        className="font-bold text-primary hover:underline"
                      >
                        {template.name}
                      </Link>
                      <div className="code mt-0.5 inline-block text-xs">
                        {template.code}
                      </div>
                    </Td>
                    <Td className="max-w-md text-muted-foreground">
                      {template.description ?? '—'}
                    </Td>
                    <Td className="tnum text-right">{stat.count}</Td>
                    <Td className="text-right">
                      <Badge tone={complete ? 'success' : 'warning'}>
                        {formatPercent(stat.weight)}
                      </Badge>
                    </Td>
                    <Td className="tnum text-right">{usage.get(template.id) ?? 0}</Td>
                    <Td>
                      <StatusBadge status={template.status} />
                    </Td>
                  </Tr>
                )
              })}
            </tbody>
          </Table>
        ) : (
          <EmptyState
            title="Belum ada template"
            description="Jalankan supabase/seed/seed.sql untuk memuat Template A dan Template B."
          />
        )}
      </Card>
    </>
  )
}
