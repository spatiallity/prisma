'use server'

import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { requirePermission } from '@/lib/auth/session'
import type { SpkStatus } from '@/lib/supabase/types'

export type SpkFormState = { error: string | null; success?: string }

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
  project_manager_id: string | null
  activity_template_id: string | null
  routing_template_id: string | null
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
    area_ha: numeric(formData, 'area_ha'),
    contract_value: numeric(formData, 'contract_value'),
    start_date: startDate,
    end_date: endDate,
    vendor_id: nullable(formData, 'vendor_id'),
    project_manager_id: nullable(formData, 'project_manager_id'),
    activity_template_id: nullable(formData, 'activity_template_id'),
    routing_template_id: nullable(formData, 'routing_template_id'),
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
  if (typeof fields === 'string') return { error: fields }

  const supabase = await createClient()
  const { data, error } = await supabase
    .from('spks')
    .insert({ ...fields, created_by: user.id, updated_by: user.id })
    .select('id')
    .single()

  if (error) return { error: friendlyError(error.message, error.code) }

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
  if (typeof fields === 'string') return { error: fields }

  const supabase = await createClient()
  const { error } = await supabase
    .from('spks')
    .update({ ...fields, updated_by: user.id })
    .eq('id', id)

  if (error) return { error: friendlyError(error.message, error.code) }

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
