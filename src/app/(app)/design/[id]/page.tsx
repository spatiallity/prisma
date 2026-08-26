import type { Metadata } from 'next'
import Link from 'next/link'
import { notFound } from 'next/navigation'
import { ArrowLeft, Check } from 'lucide-react'
import { PageHeader, EmptyState } from '@/components/ui/page-header'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { requirePermission } from '@/lib/auth/session'
import { createClient } from '@/lib/supabase/server'
import { can } from '@/lib/auth/permissions'
import { cn, formatDate, formatDateTime } from '@/lib/utils'
import { DESIGN_STAGES } from '@/lib/supabase/types'
import { STAGE_ORDER, STAGE_TONE, daysInStage } from '@/lib/design'
import { AdvanceStageForm, DesignDetailsForm } from '../forms'

export const metadata: Metadata = { title: 'Detail desain' }

/** Whole days between two instants, for the per-stage lead time column. */
function spanDays(from: string | null, to: string | null) {
  if (!from) return null
  const start = new Date(from).getTime()
  const end = to ? new Date(to).getTime() : Date.now()
  if (Number.isNaN(start) || Number.isNaN(end)) return null
  return Math.max(0, Math.round(((end - start) / 86_400_000) * 10) / 10)
}

export default async function DesignDetailPage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const user = await requirePermission('design', 'view')
  const { id } = await params
  const mayEdit = can(user.permissions, 'design', 'edit')

  const supabase = await createClient()
  const { data: design } = await supabase
    .from('designs')
    .select('*')
    .eq('id', id)
    .maybeSingle()

  if (!design) notFound()

  const [{ data: spk }, { data: revisions }, { data: pics }] = await Promise.all([
    supabase
      .from('spks')
      .select('id, spk_number, site_code, work_name')
      .eq('id', design.spk_id)
      .maybeSingle(),
    supabase
      .from('design_revisions')
      .select('*')
      .eq('design_id', id)
      .eq('status', 'Active')
      .order('revision_no', { ascending: true })
      .order('created_at', { ascending: true }),
    supabase.from('users').select('id, full_name').eq('status', 'Active').order('full_name'),
  ])

  const picName = new Map((pics ?? []).map((p) => [p.id, p.full_name]))
  const reached = new Set((revisions ?? []).map((r) => r.stage))
  const currentOrder = STAGE_ORDER[design.current_stage]
  const held = daysInStage(design.updated_at)
  const rounds = Math.max(0, ...(revisions ?? []).map((r) => r.revision_no))

  return (
    <>
      <Link
        href="/design"
        className="mb-4 inline-flex items-center gap-1.5 text-sm font-semibold text-muted-foreground hover:text-primary"
      >
        <ArrowLeft size={16} aria-hidden />
        Kembali ke Design Queue
      </Link>

      <PageHeader
        title={design.title ?? spk?.work_name ?? 'Desain'}
        description={
          spk ? `${spk.spk_number}${spk.site_code ? ` · ${spk.site_code}` : ''}` : undefined
        }
        actions={
          <div className="flex items-center gap-2">
            <Badge tone={STAGE_TONE[design.current_stage]}>{design.current_stage}</Badge>
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

      {/* Section 21 — the chain, with what has actually been reached. */}
      <Card className="mb-5">
        <CardContent className="p-5">
          <ol className="flex flex-wrap items-center gap-y-3">
            {DESIGN_STAGES.map((stage, index) => {
              const done = reached.has(stage) && STAGE_ORDER[stage] < currentOrder
              const now = stage === design.current_stage
              return (
                <li key={stage} className="flex items-center">
                  <div className="flex items-center gap-2">
                    <span
                      className={cn(
                        'grid h-6 w-6 shrink-0 place-items-center rounded-full border-2 text-[10px] font-extrabold',
                        now
                          ? 'border-primary bg-primary text-white'
                          : done
                            ? 'border-success bg-success text-white'
                            : 'border-slate-200 bg-white text-slate-400',
                      )}
                    >
                      {done ? <Check size={12} aria-hidden /> : index + 1}
                    </span>
                    <span
                      className={cn(
                        'text-xs font-bold whitespace-nowrap',
                        now
                          ? 'text-primary'
                          : done
                            ? 'text-slate-700'
                            : 'text-slate-400',
                      )}
                    >
                      {stage}
                    </span>
                  </div>
                  {index < DESIGN_STAGES.length - 1 && (
                    <span
                      className={cn(
                        'mx-3 h-0.5 w-6 rounded-full',
                        done ? 'bg-success' : 'bg-slate-200',
                      )}
                      aria-hidden
                    />
                  )}
                </li>
              )
            })}
          </ol>
        </CardContent>
      </Card>

      <div className="grid gap-5 lg:grid-cols-3">
        <Card className="lg:col-span-2">
          <CardHeader>
            <div>
              <CardTitle>Riwayat tahap</CardTitle>
              <CardDescription>
                Setiap perpindahan menutup tahap sebelumnya, sehingga lama tiap
                tahap terukur.
              </CardDescription>
            </div>
            <Badge tone="neutral">{rounds} putaran revisi</Badge>
          </CardHeader>
          <CardContent className="p-0">
            {revisions && revisions.length > 0 ? (
              <ul className="divide-y divide-slate-100">
                {[...revisions].reverse().map((revision) => {
                  const duration = spanDays(revision.started_at, revision.completed_at)
                  const open = !revision.completed_at
                  return (
                    <li key={revision.id} className="px-5 py-3.5">
                      <div className="flex flex-wrap items-center justify-between gap-2">
                        <div className="flex items-center gap-2">
                          <Badge tone={STAGE_TONE[revision.stage]}>{revision.stage}</Badge>
                          <span className="text-xs font-bold text-slate-500">
                            Revisi {revision.revision_no}
                          </span>
                          {open && <Badge tone="primary">berjalan</Badge>}
                        </div>
                        <span
                          className={cn(
                            'tnum text-xs font-bold',
                            open && duration !== null && duration > 7
                              ? 'text-danger'
                              : 'text-muted-foreground',
                          )}
                        >
                          {duration === null ? '—' : `${duration} hari`}
                        </span>
                      </div>
                      <div className="mt-1 text-xs text-muted-foreground">
                        {revision.pic_id
                          ? (picName.get(revision.pic_id) ?? 'PIC tidak dikenal')
                          : 'PIC belum ditentukan'}
                        {' · '}
                        {formatDateTime(revision.started_at)}
                        {revision.completed_at && ` → ${formatDateTime(revision.completed_at)}`}
                      </div>
                      {revision.notes && (
                        <p className="mt-1.5 text-sm text-slate-700">{revision.notes}</p>
                      )}
                    </li>
                  )
                })}
              </ul>
            ) : (
              <EmptyState title="Belum ada riwayat tahap" />
            )}
          </CardContent>
        </Card>

        <div className="grid content-start gap-5">
          <Card>
            <CardHeader>
              <CardTitle>Ringkasan</CardTitle>
            </CardHeader>
            <CardContent className="grid gap-3 text-sm">
              <div className="flex justify-between gap-3">
                <span className="text-muted-foreground">Tahap sekarang</span>
                <Badge tone={STAGE_TONE[design.current_stage]}>
                  {design.current_stage}
                </Badge>
              </div>
              <div className="flex justify-between gap-3">
                <span className="text-muted-foreground">Di tahap ini</span>
                <span
                  className={cn(
                    'tnum font-bold',
                    held !== null && held > 7 && design.current_stage !== 'Approved'
                      ? 'text-danger'
                      : 'text-slate-900',
                  )}
                >
                  {held === null ? '—' : `${held} hari`}
                </span>
              </div>
              <div className="flex justify-between gap-3">
                <span className="text-muted-foreground">PIC</span>
                <span className="font-bold text-slate-900">
                  {design.pic_id ? (picName.get(design.pic_id) ?? '—') : '—'}
                </span>
              </div>
              <div className="flex justify-between gap-3">
                <span className="text-muted-foreground">Target selesai</span>
                <span className="tnum font-bold text-slate-900">
                  {formatDate(design.target_date)}
                </span>
              </div>
              <div className="flex justify-between gap-3">
                <span className="text-muted-foreground">Disetujui</span>
                <span className="tnum font-bold text-slate-900">
                  {design.approved_at ? formatDateTime(design.approved_at) : '—'}
                </span>
              </div>
            </CardContent>
          </Card>

          {mayEdit && (
            <Card>
              <CardHeader>
                <CardTitle>Pindah tahap</CardTitle>
              </CardHeader>
              <CardContent>
                <AdvanceStageForm
                  designId={design.id}
                  currentStage={design.current_stage}
                  pics={(pics ?? []).map((p) => ({ id: p.id, label: p.full_name }))}
                />
              </CardContent>
            </Card>
          )}
        </div>
      </div>

      {mayEdit && (
        <Card className="mt-5">
          <CardHeader>
            <CardTitle>Data desain</CardTitle>
          </CardHeader>
          <CardContent>
            <DesignDetailsForm
              design={design}
              pics={(pics ?? []).map((p) => ({ id: p.id, label: p.full_name }))}
            />
          </CardContent>
        </Card>
      )}
    </>
  )
}
