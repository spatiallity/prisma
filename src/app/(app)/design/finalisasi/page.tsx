import type { Metadata } from 'next'
import { PageHeader, EmptyState } from '@/components/ui/page-header'
import { Card } from '@/components/ui/card'
import { Alert } from '@/components/ui/alert'
import { requirePermission } from '@/lib/auth/session'
import { createClient } from '@/lib/supabase/server'
import { DesignTable } from '../design-table'
import { loadDesignQueue } from '../queue-data'

export const metadata: Metadata = { title: 'Finalisasi Desain' }

/** Finalisasi Desain never opens by hand — it auto-opens once its sibling
 *  Desain Siteplan finishes — so this page has no "Add Data" action. */
export default async function DesignFinalisasiPage() {
  await requirePermission('design', 'view')
  const supabase = await createClient()

  const { designs, error, spkById, picName, currentByDesign, siteplanApprovedBySpk } =
    await loadDesignQueue(supabase, 'finalisasi')

  return (
    <>
      <PageHeader title="Finalisasi Desain" />

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
            siteplanApprovedBySpk={siteplanApprovedBySpk}
          />
        ) : (
          <EmptyState title="Belum ada Finalisasi Desain" />
        )}
      </Card>
    </>
  )
}
