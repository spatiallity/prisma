import type { Metadata } from 'next'
import { PageHeader, EmptyState } from '@/components/ui/page-header'
import { Card } from '@/components/ui/card'
import { Alert } from '@/components/ui/alert'
import { requirePermission } from '@/lib/auth/session'
import { createClient } from '@/lib/supabase/server'
import { can } from '@/lib/auth/permissions'
import { DesignTable } from '../design-table'
import { loadDesignQueue } from '../queue-data'
import { StageFilterChips } from '../stage-filter'

export const metadata: Metadata = { title: 'Finalisasi Desain' }

/** Finalisasi Desain never opens by hand — it auto-opens once its sibling
 *  Desain Siteplan finishes — so this page has no "Add Data" action. */
export default async function DesignFinalisasiPage({
  searchParams,
}: {
  searchParams: Promise<{ stage?: string }>
}) {
  const { stage } = await searchParams
  const user = await requirePermission('design', 'view')
  const mayEdit = can(user.permissions, 'design', 'edit')
  const supabase = await createClient()

  const { designs, error, spkById, picName, currentByDesign, revisionsByDesign, siteplanApprovedBySpk, pics } =
    await loadDesignQueue(supabase, 'finalisasi', stage)

  return (
    <>
      <PageHeader title="Finalisasi Desain" />

      <StageFilterChips phase="finalisasi" basePath="/design/finalisasi" active={stage} />

      {error && (
        <Alert tone="danger" className="mb-4" title="Gagal memuat data">
          {error.message}
        </Alert>
      )}

      <Card className="overflow-hidden">
        {designs.length > 0 ? (
          <DesignTable
            phase="finalisasi"
            designs={designs}
            spkById={spkById}
            picName={picName}
            currentByDesign={currentByDesign}
            revisionsByDesign={revisionsByDesign}
            siteplanApprovedBySpk={siteplanApprovedBySpk}
            pics={pics.map((p) => ({ id: p.id, label: p.full_name }))}
            mayEdit={mayEdit}
            stageFilter={stage}
          />
        ) : (
          <EmptyState title="Belum ada Finalisasi Desain" />
        )}
      </Card>
    </>
  )
}
