import Link from 'next/link'
import { Card, CardContent } from '@/components/ui/card'
import { EmptyState } from '@/components/ui/page-header'
import { createClient } from '@/lib/supabase/server'
import { DesignTabCards } from './design-tab-cards'

/**
 * The Design tab of Detail SPK — one chain per design record (Desain
 * Siteplan / Finalisasi Desain), each editable via the same popup Desain
 * Siteplan/Finalisasi Desain use, instead of navigating to /design/[id].
 *
 * migration 0020 — an SPK can have up to two design records, one per phase,
 * each opening itself in turn — so this renders one card per record that
 * exists rather than assuming one.
 */
export async function DesignTab({ spkId, mayEdit }: { spkId: string; mayEdit: boolean }) {
  const supabase = await createClient()

  const { data: designs } = await supabase
    .from('designs')
    .select('id, phase, current_stage, title, updated_at')
    .eq('spk_id', spkId)
    .eq('status', 'Active')
    .order('phase')

  if (!designs || designs.length === 0) {
    return (
      <Card>
        <CardContent className="p-0">
          <EmptyState
            title="Belum ada record desain"
            action={
              <Link href="/design" className="text-sm font-bold text-primary hover:underline">
                Buka Design Queue
              </Link>
            }
          />
        </CardContent>
      </Card>
    )
  }

  const designIds = designs.map((d) => d.id)
  const [{ data: revisions }, { data: pics }] = await Promise.all([
    supabase
      .from('design_revisions')
      .select('id, design_id, stage, revision_no, pic_id, pic_pertamina, started_at, completed_at, notes')
      .in('design_id', designIds)
      .eq('status', 'Active')
      .order('revision_no', { ascending: false })
      .order('created_at', { ascending: false }),
    supabase.from('design_pics').select('id, full_name').order('full_name'),
  ])

  const picName = Object.fromEntries((pics ?? []).map((p) => [p.id, p.full_name]))
  const revisionsByDesign: Record<string, NonNullable<typeof revisions>> = {}
  for (const revision of revisions ?? []) {
    ;(revisionsByDesign[revision.design_id] ??= []).push(revision)
  }

  return (
    <DesignTabCards
      designs={designs}
      revisionsByDesign={revisionsByDesign}
      picName={picName}
      pics={(pics ?? []).map((p) => ({ id: p.id, label: p.full_name }))}
      mayEdit={mayEdit}
    />
  )
}
