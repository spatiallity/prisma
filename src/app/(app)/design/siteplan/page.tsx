import type { Metadata } from 'next'
import { PageHeader, EmptyState } from '@/components/ui/page-header'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Alert } from '@/components/ui/alert'
import { requirePermission } from '@/lib/auth/session'
import { createClient } from '@/lib/supabase/server'
import { can } from '@/lib/auth/permissions'
import { PHASE_TERMINAL_STAGE, stageDisplayLabel } from '@/lib/design'
import { AddDesignButton } from '../forms'
import { DesignTable } from '../design-table'
import { loadDesignQueue } from '../queue-data'
import { StageFilterChips } from '../stage-filter'

export const metadata: Metadata = { title: 'Desain Siteplan' }

export default async function DesignSiteplanPage({
  searchParams,
}: {
  searchParams: Promise<{ stage?: string }>
}) {
  const { stage } = await searchParams
  const user = await requirePermission('design', 'view')
  const mayEdit = can(user.permissions, 'design', 'edit')
  const supabase = await createClient()

  const { designs, error, spkById, picName, currentByDesign, revisionsByDesign, openSpks, pics } =
    await loadDesignQueue(supabase, 'siteplan', stage)
  const summary = buildSummary(designs, currentByDesign, revisionsByDesign, PHASE_TERMINAL_STAGE.siteplan)
  const activeLabel = stage ? (stage === 'all' ? 'Semua tahap' : stage === 'ongoing' ? 'Berjalan' : stage) : 'Berjalan'

  return (
    <>
      <PageHeader
        title="Desain Siteplan"
        description="Pantau pembuatan desain awal sampai opname, termasuk PIC dan lama pekerjaan di tahap berjalan."
        actions={
          mayEdit && (
            <AddDesignButton
              spks={openSpks.map((s) => ({ id: s.id, label: `${s.spk_number} — ${s.work_name}` }))}
              pics={pics.map((p) => ({ id: p.id, label: p.full_name }))}
            />
          )
        }
      />

      <div className="mb-4 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <SummaryCard label="Antrean tampil" value={designs.length} helper={activeLabel} />
        <SummaryCard label="Draft" value={summary.draft} helper="belum mulai tahap pertama" tone="neutral" />
        <SummaryCard label="Sedang dikerjakan" value={summary.active} helper="punya tahap terbuka" tone="primary" />
        <SummaryCard label={stageDisplayLabel(PHASE_TERMINAL_STAGE.siteplan)} value={summary.terminal} helper="sudah masuk tahap akhir" tone="success" />
      </div>

      <StageFilterChips phase="siteplan" basePath="/design/siteplan" active={stage} />

      {error && (
        <Alert tone="danger" className="mb-4" title="Gagal memuat data">
          {error.message}
        </Alert>
      )}

      <Card className="overflow-hidden">
        <CardHeader>
          <div>
            <CardTitle>Daftar Desain Siteplan</CardTitle>
            <CardDescription>Klik baris untuk melihat detail tahap dan catatan revisi.</CardDescription>
          </div>
          <Badge tone="primary">{designs.length} SPK</Badge>
        </CardHeader>
        {designs.length > 0 ? (
          <DesignTable
            phase="siteplan"
            designs={designs}
            spkById={spkById}
            picName={picName}
            currentByDesign={currentByDesign}
            revisionsByDesign={revisionsByDesign}
            pics={pics.map((p) => ({ id: p.id, label: p.full_name }))}
            mayEdit={mayEdit}
            stageFilter={stage}
          />
        ) : (
          <EmptyState title="Belum ada Desain Siteplan" description="Tidak ada SPK yang cocok dengan filter tahap saat ini." />
        )}
      </Card>
    </>
  )
}

function buildSummary(
  designs: Array<{ id: string; current_stage: string }>,
  currentByDesign: Record<string, unknown>,
  revisionsByDesign: Record<string, unknown[]>,
  terminalStage: string,
) {
  return {
    draft: designs.filter((d) => !(revisionsByDesign[d.id]?.length ?? 0)).length,
    active: designs.filter((d) => currentByDesign[d.id]).length,
    terminal: designs.filter((d) => d.current_stage === terminalStage).length,
  }
}

function SummaryCard({
  label,
  value,
  helper,
  tone = 'neutral',
}: {
  label: string
  value: number
  helper: string
  tone?: 'neutral' | 'primary' | 'success'
}) {
  const toneClass = {
    neutral: 'bg-slate-100 text-slate-900',
    primary: 'bg-primary-soft text-primary',
    success: 'bg-success/10 text-success',
  }[tone]

  return (
    <Card>
      <CardContent className="flex items-center justify-between gap-4 p-4">
        <div>
          <div className="text-[11px] font-extrabold tracking-wider text-slate-500 uppercase">{label}</div>
          <div className="mt-1 text-xs font-semibold text-muted-foreground">{helper}</div>
        </div>
        <div className={`tnum rounded-full px-3 py-1 text-lg font-black ${toneClass}`}>{value}</div>
      </CardContent>
    </Card>
  )
}
