import type { Metadata } from 'next'
import Link from 'next/link'
import { PageHeader, EmptyState } from '@/components/ui/page-header'
import { Card } from '@/components/ui/card'
import { Table, Td, Th, Tr } from '@/components/ui/table'
import { StatusBadge } from '@/components/ui/badge'
import { Alert } from '@/components/ui/alert'
import { requirePermission } from '@/lib/auth/session'
import { createClient } from '@/lib/supabase/server'
import { formatDays } from '@/lib/routing'

export const metadata: Metadata = { title: 'Routing Template' }

/** Section 23 — the chains a document can be sent along. */
export default async function RoutingTemplatesPage() {
  await requirePermission('master_data', 'view')

  const supabase = await createClient()
  const [{ data: templates, error }, { data: steps }, { data: documents }] =
    await Promise.all([
      supabase.from('routing_templates').select('*').order('code'),
      supabase.from('routing_template_steps').select('template_id, sla_days'),
      supabase.from('spk_routing').select('template_id'),
    ])

  const stats = new Map<string, { count: number; sla: number }>()
  for (const step of steps ?? []) {
    const current = stats.get(step.template_id) ?? { count: 0, sla: 0 }
    current.count += 1
    current.sla += Number(step.sla_days ?? 0)
    stats.set(step.template_id, current)
  }

  const usage = new Map<string, number>()
  for (const doc of documents ?? []) {
    if (!doc.template_id) continue
    usage.set(doc.template_id, (usage.get(doc.template_id) ?? 0) + 1)
  }

  return (
    <>
      <PageHeader
        title="Routing Template"
        description="Urutan tahap beserta SLA-nya. Dokumen menyalin SLA saat dirutekan, jadi perubahan di sini tidak mengubah dokumen yang sedang berjalan."
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
                <Th className="text-right">Tahap</Th>
                <Th className="text-right">Total SLA</Th>
                <Th className="text-right">Dipakai dokumen</Th>
                <Th>Status</Th>
              </tr>
            </thead>
            <tbody>
              {templates.map((template) => {
                const stat = stats.get(template.id) ?? { count: 0, sla: 0 }
                return (
                  <Tr key={template.id}>
                    <Td>
                      <Link
                        href={`/admin/routing-templates/${template.id}`}
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
                    <Td className="tnum text-right">{formatDays(stat.sla)}</Td>
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
            title="Belum ada template routing"
            description="Jalankan supabase/seed/seed.sql untuk memuat rantai Pertamina."
          />
        )}
      </Card>
    </>
  )
}
