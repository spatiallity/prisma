import type { Metadata } from 'next'
import Link from 'next/link'
import { notFound } from 'next/navigation'
import { ArrowLeft, Check, X } from 'lucide-react'
import { PageHeader } from '@/components/ui/page-header'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { requirePermission } from '@/lib/auth/session'
import { createClient } from '@/lib/supabase/server'
import { can } from '@/lib/auth/permissions'
import { cn, formatDateTime } from '@/lib/utils'
import { ROUTING_TONE, formatDays, stageTone } from '@/lib/routing'
import { AdvanceStepForm, RoutingDetailsForm, StepStatusForm } from '../forms'

export const metadata: Metadata = { title: 'Detail routing' }

export default async function RoutingDetailPage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const user = await requirePermission('routing', 'view')
  const { id } = await params
  const mayEdit = can(user.permissions, 'routing', 'edit')

  const supabase = await createClient()
  const { data: routing } = await supabase
    .from('spk_routing')
    .select('*')
    .eq('id', id)
    .maybeSingle()

  if (!routing) notFound()

  const [{ data: steps }, { data: lead }, { data: spk }] = await Promise.all([
    supabase
      .from('routing_history')
      .select('*')
      .eq('spk_routing_id', id)
      .order('sequence'),
    supabase.from('v_routing_lead_time').select('*').eq('spk_routing_id', id),
    supabase
      .from('spks')
      .select('id, spk_number, site_code, work_name')
      .eq('id', routing.spk_id)
      .maybeSingle(),
  ])

  const leadByStep = new Map((lead ?? []).map((row) => [row.routing_history_id, row]))

  // The stage holding the document: lowest sequence that has not completed.
  const current = (steps ?? []).find((step) => step.status !== 'Completed')
  const totalDays = (steps ?? []).reduce(
    (sum, step) => sum + Number(step.duration_days ?? 0),
    0,
  )
  const done = (steps ?? []).filter((s) => s.status === 'Completed').length

  return (
    <>
      <Link
        href="/routing"
        className="mb-4 inline-flex items-center gap-1.5 text-sm font-semibold text-muted-foreground hover:text-primary"
      >
        <ArrowLeft size={16} aria-hidden />
        Kembali ke Routing Monitor
      </Link>

      <PageHeader
        title={routing.document_type}
        description={
          [
            routing.document_number,
            spk ? `${spk.spk_number} — ${spk.work_name}` : null,
          ]
            .filter(Boolean)
            .join(' · ') || undefined
        }
        actions={
          <div className="flex items-center gap-2">
            <Badge tone={ROUTING_TONE[routing.status]}>{routing.status}</Badge>
            {spk && (
              <Link
                href={`/spk/${spk.id}`}
                className="text-sm font-bold text-primary hover:underline"
              >
                Buka SPK
              </Link>
            )}
          </div>
        }
      />

      <div className="mb-5 grid gap-4 sm:grid-cols-3">
        <Card>
          <CardContent className="p-4">
            <div className="text-[11px] font-extrabold tracking-wider text-slate-500 uppercase">
              Tahap selesai
            </div>
            <div className="tnum mt-1 text-2xl font-black text-slate-900">
              {done}/{steps?.length ?? 0}
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="text-[11px] font-extrabold tracking-wider text-slate-500 uppercase">
              Lead time terpakai
            </div>
            <div className="tnum mt-1 text-2xl font-black text-slate-900">
              {formatDays(totalDays)}
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="text-[11px] font-extrabold tracking-wider text-slate-500 uppercase">
              Posisi sekarang
            </div>
            <div className="mt-1 truncate text-lg font-black text-slate-900">
              {current?.step_name ?? 'Selesai'}
            </div>
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-5 lg:grid-cols-3">
        <Card className="lg:col-span-2">
          <CardHeader>
            <div>
              <CardTitle>Rantai routing</CardTitle>
              <CardDescription>
                Lead time per tahap dihitung dari selisih mulai dan selesai.
              </CardDescription>
            </div>
          </CardHeader>
          <CardContent>
            <ol className="grid">
              {(steps ?? []).map((step, index) => {
                const stat = leadByStep.get(step.id)
                const late = stat?.is_overdue ?? false
                const isCurrent = current?.id === step.id
                const finished = step.status === 'Completed'
                const refused = step.status === 'Rejected'
                const last = index === (steps?.length ?? 0) - 1

                return (
                  <li key={step.id} className="grid grid-cols-[26px_1fr_auto] gap-3">
                    <div className="flex flex-col items-center">
                      <span
                        className={cn(
                          'grid h-6 w-6 shrink-0 place-items-center rounded-full border-2 text-[10px] font-extrabold',
                          finished
                            ? 'border-success bg-success text-white'
                            : refused
                              ? 'border-danger bg-danger text-white'
                              : isCurrent
                                ? late
                                  ? 'border-danger bg-danger text-white'
                                  : 'border-primary bg-primary text-white'
                                : 'border-slate-200 bg-white text-slate-400',
                        )}
                      >
                        {finished ? (
                          <Check size={12} aria-hidden />
                        ) : refused ? (
                          <X size={12} aria-hidden />
                        ) : (
                          step.sequence
                        )}
                      </span>
                      {!last && (
                        <span
                          className={cn(
                            'w-0.5 flex-1',
                            finished ? 'bg-success' : 'bg-slate-200',
                          )}
                          style={{ minHeight: 28 }}
                          aria-hidden
                        />
                      )}
                    </div>

                    <div className={cn('pb-5', last && 'pb-0')}>
                      <div className="text-sm font-bold text-slate-900">
                        {step.step_name}
                      </div>
                      <div className="text-xs text-muted-foreground">
                        {step.pic_name ?? 'PIC belum ditentukan'}
                        {step.started_at && ` · mulai ${formatDateTime(step.started_at)}`}
                        {step.completed_at && ` → ${formatDateTime(step.completed_at)}`}
                        {!step.started_at && ' · belum mulai'}
                      </div>
                      {step.note && (
                        <p className="mt-1 text-sm text-slate-700">{step.note}</p>
                      )}
                    </div>

                    <div className="flex flex-col items-end gap-1 pb-5">
                      <Badge tone={stageTone(step.status, late)}>
                        {late && step.status !== 'Completed' ? 'Lewat SLA' : step.status}
                      </Badge>
                      <span
                        className={cn(
                          'tnum text-xs font-bold',
                          late ? 'text-danger' : 'text-muted-foreground',
                        )}
                      >
                        {formatDays(stat?.elapsed_days ?? step.duration_days)}
                      </span>
                      {step.sla_days !== null && (
                        <span className="tnum text-[11px] text-slate-400">
                          SLA {formatDays(step.sla_days)}
                        </span>
                      )}
                    </div>
                  </li>
                )
              })}
            </ol>
          </CardContent>
        </Card>

        <div className="grid content-start gap-5">
          {mayEdit && current && (
            <>
              <Card>
                <CardHeader>
                  <div>
                    <CardTitle>Teruskan</CardTitle>
                    <CardDescription>{current.step_name}</CardDescription>
                  </div>
                </CardHeader>
                <CardContent>
                  <AdvanceStepForm
                    routingId={routing.id}
                    stepId={current.id}
                    defaultPic={current.pic_name}
                  />
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle>Kembalikan / tolak</CardTitle>
                </CardHeader>
                <CardContent>
                  <StepStatusForm
                    routingId={routing.id}
                    stepId={current.id}
                    status={current.status}
                  />
                </CardContent>
              </Card>
            </>
          )}

          {!current && (
            <Card>
              <CardContent className="p-5 text-sm text-muted-foreground">
                Seluruh tahap sudah selesai. Total lead time{' '}
                <strong className="text-slate-900">{formatDays(totalDays)}</strong>.
              </CardContent>
            </Card>
          )}
        </div>
      </div>

      {mayEdit && (
        <Card className="mt-5">
          <CardHeader>
            <CardTitle>Data dokumen</CardTitle>
          </CardHeader>
          <CardContent>
            <RoutingDetailsForm routing={routing} />
          </CardContent>
        </Card>
      )}
    </>
  )
}
