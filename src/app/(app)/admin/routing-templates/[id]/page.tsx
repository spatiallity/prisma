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
import { formatDays } from '@/lib/routing'

export const metadata: Metadata = { title: 'Detail routing template' }

export default async function RoutingTemplateDetailPage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  await requirePermission('master_data', 'view')
  const { id } = await params

  const supabase = await createClient()
  const [{ data: template }, { data: steps }, { data: averages }] = await Promise.all([
    supabase.from('routing_templates').select('*').eq('id', id).maybeSingle(),
    supabase
      .from('routing_template_steps')
      .select('*')
      .eq('template_id', id)
      .order('sequence'),
    supabase.from('v_routing_stage_average').select('*'),
  ])

  if (!template) notFound()

  const averageByStep = new Map((averages ?? []).map((a) => [a.step_name, a]))
  const totalSla = (steps ?? []).reduce((sum, s) => sum + Number(s.sla_days ?? 0), 0)

  return (
    <>
      <Link
        href="/admin/routing-templates"
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

      <Alert tone="warning" className="mb-4" title="SLA masih angka sementara">
        Nilai di bawah adalah placeholder dari seed. Ganti dengan SLA yang
        disepakati bersama Pertamina sebelum deteksi bottleneck dipakai serius.
      </Alert>

      <Card className="overflow-hidden">
        {steps && steps.length > 0 ? (
          <Table>
            <thead>
              <tr>
                <Th className="w-10 text-right">#</Th>
                <Th>Tahap</Th>
                <Th>PIC default</Th>
                <Th>Approval</Th>
                <Th className="text-right">SLA</Th>
                <Th className="text-right">Rata-rata aktual</Th>
              </tr>
            </thead>
            <tbody>
              {steps.map((step) => {
                const actual = averageByStep.get(step.name)
                const slower =
                  actual?.avg_duration_days != null &&
                  step.sla_days != null &&
                  Number(actual.avg_duration_days) > Number(step.sla_days)

                return (
                  <Tr key={step.id}>
                    <Td className="tnum text-right text-muted-foreground">
                      {step.sequence}
                    </Td>
                    <Td className="font-bold text-slate-900">{step.name}</Td>
                    <Td className="text-muted-foreground">
                      {step.default_pic_role ?? '—'}
                    </Td>
                    <Td>
                      {step.requires_approval ? (
                        <Badge tone="primary">Perlu approval</Badge>
                      ) : (
                        <Badge>Lewat saja</Badge>
                      )}
                    </Td>
                    <Td className="tnum text-right">{formatDays(step.sla_days)}</Td>
                    <Td className="text-right">
                      {actual?.avg_duration_days == null ? (
                        <span className="text-muted-foreground">belum ada data</span>
                      ) : (
                        <Badge tone={slower ? 'danger' : 'success'}>
                          {formatDays(actual.avg_duration_days)}
                        </Badge>
                      )}
                    </Td>
                  </Tr>
                )
              })}
            </tbody>
            <tfoot>
              <tr className="bg-surface-muted">
                <Td
                  colSpan={4}
                  className="text-right text-xs font-extrabold tracking-wider text-slate-500 uppercase"
                >
                  Total SLA
                </Td>
                <Td className="tnum text-right font-black">{formatDays(totalSla)}</Td>
                <Td />
              </tr>
            </tfoot>
          </Table>
        ) : (
          <EmptyState title="Template ini belum punya tahap" />
        )}
      </Card>
    </>
  )
}
