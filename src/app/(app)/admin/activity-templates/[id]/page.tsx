import type { Metadata } from 'next'
import Link from 'next/link'
import { notFound } from 'next/navigation'
import { ArrowLeft } from 'lucide-react'
import { PageHeader, EmptyState } from '@/components/ui/page-header'
import { Card } from '@/components/ui/card'
import { Table, Td, Th, Tr } from '@/components/ui/table'
import { Badge, StatusBadge } from '@/components/ui/badge'
import { Alert } from '@/components/ui/alert'
import { requirePermission } from '@/lib/auth/session'
import { createClient } from '@/lib/supabase/server'
import { formatPercent } from '@/lib/spk'
import { MEASUREMENT_LABEL } from '@/lib/progress'

export const metadata: Metadata = { title: 'Detail template' }

export default async function ActivityTemplateDetailPage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  await requirePermission('master_data', 'view')
  const { id } = await params

  const supabase = await createClient()
  const [{ data: template }, { data: items }] = await Promise.all([
    supabase.from('activity_templates').select('*').eq('id', id).maybeSingle(),
    supabase
      .from('activity_template_items')
      .select('*')
      .eq('template_id', id)
      .order('sequence'),
  ])

  if (!template) notFound()

  const totalWeight = (items ?? []).reduce((sum, item) => sum + Number(item.weight), 0)
  const complete = Math.abs(totalWeight - 100) < 0.01

  return (
    <>
      <Link
        href="/admin/activity-templates"
        className="mb-4 inline-flex items-center gap-1.5 text-sm font-semibold text-muted-foreground hover:text-primary"
      >
        <ArrowLeft size={16} aria-hidden />
        Kembali ke daftar template
      </Link>

      <PageHeader
        title={template.name}
        description={template.description ?? undefined}
        actions={
          <div className="flex items-center gap-2">
            <span className="code text-xs">{template.code}</span>
            <StatusBadge status={template.status} />
          </div>
        }
      />

      {!complete && (
        <Alert tone="warning" className="mb-4" title="Total bobot bukan 100%">
          Sekarang {formatPercent(totalWeight)}. SPK yang memakai template ini tidak
          akan pernah mencapai Overall Progress 100%.
        </Alert>
      )}

      <Card className="overflow-hidden">
        {items && items.length > 0 ? (
          <Table>
            <thead>
              <tr>
                <Th className="w-10 text-right">#</Th>
                <Th>Aktivitas</Th>
                <Th>Pengukuran</Th>
                <Th>Satuan</Th>
                <Th className="text-right">Target default</Th>
                <Th className="text-right">Bobot</Th>
              </tr>
            </thead>
            <tbody>
              {items.map((item) => (
                <Tr key={item.id}>
                  <Td className="tnum text-right text-muted-foreground">
                    {item.sequence}
                  </Td>
                  <Td className="font-bold text-slate-900">
                    {item.name}
                    {item.target_from_spk_area && (
                      <Badge tone="info" className="ml-2">
                        target = luas SPK
                      </Badge>
                    )}
                  </Td>
                  <Td>
                    <Badge>{MEASUREMENT_LABEL[item.measurement]}</Badge>
                  </Td>
                  <Td className="text-muted-foreground">{item.unit ?? '—'}</Td>
                  <Td className="tnum text-right text-muted-foreground">
                    {item.target_from_spk_area
                      ? 'luas SPK'
                      : (item.default_target ?? '—')}
                  </Td>
                  <Td className="tnum text-right font-bold">
                    {formatPercent(item.weight)}
                  </Td>
                </Tr>
              ))}
            </tbody>
            <tfoot>
              <tr className="bg-surface-muted">
                <Td colSpan={5} className="text-right text-xs font-extrabold tracking-wider text-slate-500 uppercase">
                  Total bobot
                </Td>
                <Td className="text-right">
                  <Badge tone={complete ? 'success' : 'warning'}>
                    {formatPercent(totalWeight)}
                  </Badge>
                </Td>
              </tr>
            </tfoot>
          </Table>
        ) : (
          <EmptyState title="Template ini belum punya aktivitas" />
        )}
      </Card>
    </>
  )
}
