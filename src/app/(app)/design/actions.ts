'use server'

import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { requirePermission } from '@/lib/auth/session'
import type { DesignStage, RecordStatus } from '@/lib/supabase/types'

export type DesignState = { error: string | null; success?: string }

function text(formData: FormData, key: string) {
  const value = formData.get(key)
  return typeof value === 'string' ? value.trim() : ''
}

function nullable(formData: FormData, key: string) {
  return text(formData, key) || null
}

/**
 * Section 21 — opens the design record for an SPK and lays down its first
 * stage. `designs.current_stage` is maintained by the trigger in migration
 * 0006, so the stage is only ever written through design_revisions.
 */
export async function createDesign(
  _prev: DesignState,
  formData: FormData,
): Promise<DesignState> {
  const user = await requirePermission('design', 'edit')

  const spkId = text(formData, 'spk_id')
  if (!spkId) return { error: 'SPK wajib dipilih.' }

  const supabase = await createClient()

  const { data: existing } = await supabase
    .from('designs')
    .select('id')
    .eq('spk_id', spkId)
    .eq('status', 'Active')
    .maybeSingle()

  if (existing) {
    return { error: 'SPK ini sudah punya record desain aktif.' }
  }

  const { data: design, error } = await supabase
    .from('designs')
    .insert({
      spk_id: spkId,
      title: nullable(formData, 'title'),
      pic_id: nullable(formData, 'pic_id'),
      target_date: nullable(formData, 'target_date'),
      notes: nullable(formData, 'notes'),
      created_by: user.id,
    })
    .select('id')
    .single()

  if (error) return { error: error.message }

  const { error: revisionError } = await supabase.from('design_revisions').insert({
    design_id: design.id,
    revision_no: 0,
    stage: 'Desain Awal',
    pic_id: nullable(formData, 'pic_id'),
    started_at: new Date().toISOString(),
    created_by: user.id,
  })

  if (revisionError) return { error: revisionError.message }

  revalidatePath('/design')
  revalidatePath(`/spk/${spkId}`)
  redirect(`/design/${design.id}`)
}

/**
 * Moves the design to its next stage. Each move closes the current revision
 * and opens a new one, which is what makes the Section 24-style lead time per
 * stage measurable at all.
 */
export async function advanceStage(
  _prev: DesignState,
  formData: FormData,
): Promise<DesignState> {
  const user = await requirePermission('design', 'edit')

  const designId = text(formData, 'design_id')
  const stage = text(formData, 'stage') as DesignStage
  if (!designId || !stage) return { error: 'Tahap tujuan wajib dipilih.' }

  const supabase = await createClient()

  const { data: revisions, error: readError } = await supabase
    .from('design_revisions')
    .select('id, revision_no, stage, completed_at')
    .eq('design_id', designId)
    .eq('status', 'Active')
    .order('revision_no', { ascending: false })
    .order('created_at', { ascending: false })

  if (readError) return { error: readError.message }

  const current = revisions?.[0]
  if (current?.stage === stage) {
    return { error: `Desain sudah berada di tahap ${stage}.` }
  }

  const now = new Date().toISOString()

  if (current && !current.completed_at) {
    const { error } = await supabase
      .from('design_revisions')
      .update({ completed_at: now })
      .eq('id', current.id)
    if (error) return { error: error.message }
  }

  // Returning to Revisi starts a new numbered round; everything else continues
  // the current one, so revision_no counts actual rework, not stage hops.
  const nextRevisionNo =
    stage === 'Revisi' ? (current?.revision_no ?? 0) + 1 : (current?.revision_no ?? 0)

  const { error: insertError } = await supabase.from('design_revisions').insert({
    design_id: designId,
    revision_no: nextRevisionNo,
    stage,
    pic_id: nullable(formData, 'pic_id'),
    started_at: now,
    notes: nullable(formData, 'notes'),
    created_by: user.id,
  })

  if (insertError) {
    return {
      error: insertError.code === '23505'
        ? `Tahap ${stage} pada revisi ${nextRevisionNo} sudah pernah dicatat.`
        : insertError.message,
    }
  }

  // Approval is a property of the design itself, not of one revision.
  if (stage === 'Approved') {
    await supabase
      .from('designs')
      .update({ approved_at: now, approved_by: user.id })
      .eq('id', designId)
  } else {
    await supabase
      .from('designs')
      .update({ approved_at: null, approved_by: null })
      .eq('id', designId)
  }

  revalidatePath('/design')
  revalidatePath(`/design/${designId}`)
  return { error: null, success: `Desain dipindahkan ke ${stage}.` }
}

export async function updateDesign(
  _prev: DesignState,
  formData: FormData,
): Promise<DesignState> {
  await requirePermission('design', 'edit')

  const id = text(formData, 'id')
  if (!id) return { error: 'Desain tidak dikenali.' }

  const supabase = await createClient()
  const { error } = await supabase
    .from('designs')
    .update({
      title: nullable(formData, 'title'),
      pic_id: nullable(formData, 'pic_id'),
      target_date: nullable(formData, 'target_date'),
      notes: nullable(formData, 'notes'),
      status: (text(formData, 'status') || 'Active') as RecordStatus,
    })
    .eq('id', id)

  if (error) return { error: error.message }

  revalidatePath('/design')
  revalidatePath(`/design/${id}`)
  return { error: null, success: 'Perubahan tersimpan.' }
}
