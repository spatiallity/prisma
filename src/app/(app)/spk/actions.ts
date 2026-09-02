'use server'

import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { requirePermission } from '@/lib/auth/session'
import type { SpkStatus } from '@/lib/supabase/types'
import { WORK_TYPE_TEMPLATE_CODE } from '@/lib/spk'
import { pickFormValues } from '@/lib/form-values'

export type SpkFormState = {
  error: string | null
  success?: string
  /** Raw submission, echoed back on error so the form can restore what the
   *  user typed instead of the action's reset wiping it. */
  values?: Record<string, string>
}

function text(formData: FormData, key: string) {
  const value = formData.get(key)
  return typeof value === 'string' ? value.trim() : ''
}

function nullable(formData: FormData, key: string) {
  return text(formData, key) || null
}

/** Empty stays NULL — an unknown area is not the same as zero hectares. */
function numeric(formData: FormData, key: string) {
  const raw = text(formData, key)
  if (!raw) return null
  const parsed = Number(raw.replace(/\./g, '').replace(',', '.'))
  return Number.isFinite(parsed) ? parsed : null
}

/** Ha is typed with a decimal dot/comma (12.06), never an Indonesian
 *  thousands dot — 9.6 must stay 9.6, not become 96. */
function decimal(formData: FormData, key: string) {
  const raw = text(formData, key)
  if (!raw) return null
  const parsed = Number(raw.replace(',', '.'))
  return Number.isFinite(parsed) ? parsed : null
}

type SpkFields = {
  spk_number: string
  site_code: string | null
  work_name: string
  work_type: string | null
  location: string | null
  kabupaten: string | null
  provinsi: string | null
  area_ha: number | null
  contract_value: number | null
  start_date: string | null
  end_date: string | null
  vendor_id: string | null
  status: SpkStatus
  notes: string | null
}

function readFields(formData: FormData): SpkFields | string {
  const spkNumber = text(formData, 'spk_number')
  const workName = text(formData, 'work_name')

  if (!spkNumber || !workName) {
    return 'Nomor SPK dan nama pekerjaan wajib diisi.'
  }

  const startDate = nullable(formData, 'start_date')
  const endDate = nullable(formData, 'end_date')
  if (startDate && endDate && endDate < startDate) {
    return 'Tanggal selesai tidak boleh lebih awal dari tanggal mulai.'
  }

  return {
    spk_number: spkNumber,
    site_code: nullable(formData, 'site_code'),
    work_name: workName,
    work_type: nullable(formData, 'work_type'),
    location: nullable(formData, 'location'),
    kabupaten: nullable(formData, 'kabupaten'),
    provinsi: nullable(formData, 'provinsi'),
    area_ha: decimal(formData, 'area_ha'),
    contract_value: numeric(formData, 'contract_value'),
    start_date: startDate,
    end_date: endDate,
    vendor_id: nullable(formData, 'vendor_id'),
    status: (text(formData, 'status') || 'Draft') as SpkStatus,
    notes: nullable(formData, 'notes'),
  }
}

/** Postgres 23505 — the unique index on spk_number. */
function friendlyError(message: string, code?: string) {
  if (code === '23505' && message.includes('spk_number')) {
    return 'Nomor SPK sudah dipakai. Gunakan nomor lain.'
  }
  return message
}

export async function createSpk(
  _prev: SpkFormState,
  formData: FormData,
): Promise<SpkFormState> {
  const user = await requirePermission('spk', 'create')

  const fields = readFields(formData)
  if (typeof fields === 'string') return { error: fields, values: pickFormValues(formData) }

  // Stake Out has no natural target elsewhere (unlike an area-based activity,
  // which inherits luas area) — someone has to say how many patok up front.
  let stakeOutTarget: number | null = null
  if (fields.work_type === 'Stake Out') {
    stakeOutTarget = numeric(formData, 'stake_out_target')
    if (stakeOutTarget === null || stakeOutTarget <= 0) {
      return {
        error: 'Jumlah titik Stake Out wajib diisi.',
        values: pickFormValues(formData),
      }
    }
  }

  const supabase = await createClient()

  // Jenis pekerjaan picks its Progress Template automatically — this is the
  // only moment it's chosen (Section 17: changing it later would orphan the
  // activities already instantiated from it). Routing has exactly one
  // template (RT-PERTAMINA), so it's never a user choice either.
  const templateCode = fields.work_type ? WORK_TYPE_TEMPLATE_CODE[fields.work_type] : undefined
  const [{ data: activityTemplate }, { data: routingTemplates }] = await Promise.all([
    templateCode
      ? supabase.from('activity_templates').select('id').eq('code', templateCode).maybeSingle()
      : Promise.resolve({ data: null }),
    supabase
      .from('routing_templates')
      .select('id')
      .eq('status', 'Active')
      .order('created_at')
      .limit(1),
  ])

  const { data, error } = await supabase
    .from('spks')
    .insert({
      ...fields,
      activity_template_id: activityTemplate?.id ?? null,
      routing_template_id: routingTemplates?.[0]?.id ?? null,
      created_by: user.id,
      updated_by: user.id,
    })
    .select('id')
    .single()

  if (error) {
    return { error: friendlyError(error.message, error.code), values: pickFormValues(formData) }
  }

  if (activityTemplate) {
    const { data: items } = await supabase
      .from('activity_template_items')
      .select('*')
      .eq('template_id', activityTemplate.id)
      .order('sequence')

    if (items && items.length > 0) {
      await supabase.from('spk_activities').insert(
        items.map((item) => ({
          spk_id: data.id,
          template_item_id: item.id,
          name: item.name,
          weight: item.weight,
          measurement: item.measurement,
          unit: item.unit,
          sequence: item.sequence,
          target_value: item.target_from_spk_area
            ? fields.area_ha
            : item.name === 'Stake Out' && fields.work_type === 'Stake Out'
              ? stakeOutTarget
              : item.default_target,
        })),
      )
    }
  }

  revalidatePath('/spk')
  redirect(`/spk/${data.id}?created=1`)
}

export async function updateSpk(
  _prev: SpkFormState,
  formData: FormData,
): Promise<SpkFormState> {
  const user = await requirePermission('spk', 'edit')

  const id = text(formData, 'id')
  if (!id) return { error: 'SPK tidak dikenali.' }

  const fields = readFields(formData)
  if (typeof fields === 'string') return { error: fields, values: pickFormValues(formData) }

  let stakeOutTarget: number | null = null
  if (fields.work_type === 'Stake Out') {
    stakeOutTarget = numeric(formData, 'stake_out_target')
    if (stakeOutTarget === null || stakeOutTarget <= 0) {
      return {
        error: 'Jumlah titik Stake Out wajib diisi.',
        values: pickFormValues(formData),
      }
    }
  }

  const supabase = await createClient()
  const { error } = await supabase
    .from('spks')
    .update({ ...fields, updated_by: user.id })
    .eq('id', id)

  if (error) {
    return { error: friendlyError(error.message, error.code), values: pickFormValues(formData) }
  }

  if (fields.work_type === 'Stake Out') {
    await supabase
      .from('spk_activities')
      .update({ target_value: stakeOutTarget })
      .eq('spk_id', id)
      .eq('name', 'Stake Out')
  }

  revalidatePath('/spk')
  revalidatePath(`/spk/${id}`)
  return { error: null, success: 'Perubahan tersimpan.' }
}

/** Section 4.4 — an SPK is archived or cancelled, never deleted. */
export async function setSpkStatus(
  _prev: SpkFormState,
  formData: FormData,
): Promise<SpkFormState> {
  const user = await requirePermission('spk', 'edit')

  const id = text(formData, 'id')
  const status = text(formData, 'status') as SpkStatus
  if (!id || !status) return { error: 'Data tidak lengkap.' }

  const supabase = await createClient()
  const { error } = await supabase
    .from('spks')
    .update({ status, updated_by: user.id })
    .eq('id', id)

  if (error) return { error: error.message }

  revalidatePath('/spk')
  revalidatePath(`/spk/${id}`)
  return { error: null, success: `Status SPK diubah menjadi ${status}.` }
}

/**
 * Hard delete — migration 0017. Cascades everything owned by this SPK
 * (activities, progress, schedule, design, routing, revenue documents);
 * cross-cutting rows (audit log, files, finance_transactions) just lose the
 * reference instead of being deleted.
 */
export async function deleteSpk(
  _prev: SpkFormState,
  formData: FormData,
): Promise<SpkFormState> {
  await requirePermission('spk', 'edit')

  const id = text(formData, 'id')
  if (!id) return { error: 'SPK tidak dikenali.' }

  const supabase = await createClient()
  const { error } = await supabase.from('spks').delete().eq('id', id)
  if (error) return { error: error.message }

  revalidatePath('/spk')
  return { error: null }
}
