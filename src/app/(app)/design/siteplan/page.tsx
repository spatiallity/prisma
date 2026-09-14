import type { Metadata } from 'next'
import { PageHeader, EmptyState } from '@/components/ui/page-header'
import { Card } from '@/components/ui/card'
import { Alert } from '@/components/ui/alert'
import { requirePermission } from '@/lib/auth/session'
import { createClient } from '@/lib/supabase/server'
import { can } from '@/lib/auth/permissions'
import { AddDesignButton } from '../forms'
import { DesignTable } from '../design-table'
import { loadDesignQueue } from '../queue-data'

export const metadata: Metadata = { title: 'Desain Siteplan' }

export default async function DesignSiteplanPage() {
  const user = await requirePermission('design', 'view')
  const mayEdit = can(user.permissions, 'design', 'edit')
  const supabase = await createClient()

  const { designs, error, spkById, picName, currentByDesign, revisionsByDesign, openSpks, pics } =
    await loadDesignQueue(supabase, 'siteplan')

  return (
    <>
      <PageHeader
        title="Desain Siteplan"
        actions={
          mayEdit && (
            <AddDesignButton
              spks={openSpks.map((s) => ({ id: s.id, label: `${s.spk_number} — ${s.work_name}` }))}
              pics={pics.map((p) => ({ id: p.id, label: p.full_name }))}
            />
          )
        }
      />

      {error && (
        <Alert tone="danger" className="mb-4" title="Gagal memuat data">
          {error.message}
        </Alert>
      )}

      <Card className="overflow-hidden">
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
          />
        ) : (
          <EmptyState title="Belum ada Desain Siteplan" />
        )}
      </Card>
    </>
  )
}
