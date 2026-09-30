'use server'

import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { requirePermission } from '@/lib/auth/session'
import type { SpkStatus } from '@/lib/supabase/types'
import { WORK_TYPE_TEMPLATE_CODE, spkStatusLabel } from '@/lib/spk'
import { pickFormValues } from '@/lib/form-values'

export type SpkFormState = {
  error: string | null
  success?: string
  /** Present only when a new SPK was created from the form with a PDF waiting
   *  to be uploaded by the browser. */
  spkId?: string
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

/** A picked date becomes noon that day. Super Admin may omit a mark date;
 *  a completion mark still needs a timestamp, so use now in that case. */
function pickedOrNow(formData: FormData, key: string) {
  const raw = text(formData, key)
  return raw ? new Date(`${raw}T12:00:00`).toISOString() : new Date().toISOString()
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
  site_code: string
  work_name: string
  work_type: string | null
  location_type: string | null
  location: string
  kabupaten: string | null
  provinsi: string | null
  area_ha: number | null
  contract_value: number | null
  start_date: string | null
  end_date: string | null
  status: SpkStatus
  notes: string | null
}

function readFields(formData: FormData): SpkFields | string {
  const spkNumber = text(formData, 'spk_number')
  const workName = text(formData, 'work_name')
  const siteCode = text(formData, 'site_code')
  const location = text(formData, 'location')

  if (!spkNumber || !workName) {
    return 'Nomor SPK dan nama pekerjaan wajib diisi.'
  }
  if (!siteCode) return 'Kode Lokasi wajib diisi.'
  if (!location) return 'Desa wajib diisi.'

  const startDate = nullable(formData, 'start_date')
  const endDate = nullable(formData, 'end_date')
  if (startDate && endDate && endDate < startDate) {
    return 'Tanggal selesai tidak boleh lebih awal dari tanggal mulai.'
  }

  return {
    spk_number: spkNumber,
    site_code: siteCode,
    work_name: workName,
    work_type: nullable(formData, 'work_type'),
    location_type: nullable(formData, 'location_type'),
    location,
    kabupaten: nullable(formData, 'kabupaten'),
    provinsi: nullable(formData, 'provinsi'),
    area_ha: decimal(formData, 'area_ha'),
    contract_value: numeric(formData, 'contract_value'),
    start_date: startDate,
    end_date: endDate,
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

  // Optional up front — can be filled in later from the SPK edit form or
  // straight from the Progress tab once the survey knows the real count.
  const stakeOutTarget = fields.work_type === 'Stake Out' ? numeric(formData, 'stake_out_target') : null

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
      stake_out_patok: stakeOutTarget,
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
  revalidatePath('/spk/keuangan-bulanan')
  // A browser-selected File cannot be forwarded through this Server Action to
  // R2. Return the new id so the client can upload it through the existing,
  // permission-checked document endpoint before taking the user to the SPK.
  if (text(formData, 'create_with_file') === '1') {
    return { error: null, spkId: data.id }
  }
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

  const stakeOutTarget = fields.work_type === 'Stake Out' ? numeric(formData, 'stake_out_target') : null

  const supabase = await createClient()
  const { data: current } = await supabase
    .from('spks')
    .select('work_type')
    .eq('id', id)
    .maybeSingle()

  if (!current) return { error: 'SPK tidak ditemukan.' }

  if (current.work_type !== fields.work_type) {
    const [{ count: designCount }, { count: routingCount }] = await Promise.all([
      supabase.from('designs').select('*', { count: 'exact', head: true }).eq('spk_id', id).eq('status', 'Active'),
      supabase.from('spk_routing').select('*', { count: 'exact', head: true }).eq('spk_id', id),
    ])
    if ((designCount ?? 0) > 0 || (routingCount ?? 0) > 0) {
      return { error: 'Jenis pekerjaan tidak dapat diubah setelah proses desain atau routing dimulai.' }
    }
  }

  const { error } = await supabase
    .from('spks')
    .update({ ...fields, stake_out_patok: stakeOutTarget, updated_by: user.id })
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
  revalidatePath('/spk/keuangan-bulanan')
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
  revalidatePath('/spk/keuangan-bulanan')
  return { error: null, success: `Status SPK diubah menjadi ${spkStatusLabel(status)}.` }
}

/**
 * Migration 0018 — Opname and PAD are just a mark on the SPK, not a routed
 * document. PAD only makes sense once opname is marked; unmarking opname
 * clears PAD too so the two can't go out of order.
 */
export async function markOpname(
  _prev: SpkFormState,
  formData: FormData,
): Promise<SpkFormState> {
  const user = await requirePermission('spk', 'edit')

  const id = text(formData, 'id')
  if (!id) return { error: 'SPK tidak dikenali.' }
  if (!text(formData, 'tanggal') && user.role.code !== 'super_admin') {
    return { error: 'Tanggal opname wajib diisi.' }
  }

  const supabase = await createClient()
  const { error } = await supabase
    .from('spks')
    .update({
      opname_marked_at: pickedOrNow(formData, 'tanggal'),
      opname_marked_by: user.id,
      opname_value: numeric(formData, 'value'),
    })
    .eq('id', id)

  if (error) return { error: error.message }

  revalidatePath(`/spk/${id}`)
  revalidatePath('/design')
  revalidatePath('/spk/progress')
  revalidatePath('/routing')
  revalidatePath('/dashboard')
  revalidatePath('/spk/keuangan-bulanan')
  return { error: null, success: 'Opname disimpan.' }
}

export async function unmarkOpname(
  _prev: SpkFormState,
  formData: FormData,
): Promise<SpkFormState> {
  await requirePermission('spk', 'edit')

  const id = text(formData, 'id')
  if (!id) return { error: 'SPK tidak dikenali.' }

  const supabase = await createClient()
  const { error } = await supabase
    .from('spks')
    .update({
      opname_marked_at: null,
      opname_marked_by: null,
      opname_value: null,
      pad_marked_at: null,
      pad_marked_by: null,
      pad_value: null,
    })
    .eq('id', id)

  if (error) return { error: error.message }

  revalidatePath(`/spk/${id}`)
  revalidatePath('/design')
  revalidatePath('/spk/progress')
  revalidatePath('/routing')
  revalidatePath('/dashboard')
  revalidatePath('/spk/keuangan-bulanan')
  return { error: null, success: 'Tanda opname dibatalkan.' }
}

export async function markPad(
  _prev: SpkFormState,
  formData: FormData,
): Promise<SpkFormState> {
  const user = await requirePermission('spk', 'edit')

  const id = text(formData, 'id')
  if (!id) return { error: 'SPK tidak dikenali.' }
  if (!text(formData, 'tanggal') && user.role.code !== 'super_admin') {
    return { error: 'Tanggal PAD wajib diisi.' }
  }

  const supabase = await createClient()
  const { data: spk } = await supabase
    .from('spks')
    .select('opname_marked_at')
    .eq('id', id)
    .maybeSingle()
  if (!spk?.opname_marked_at) return { error: 'Tandai opname selesai dulu sebelum PAD.' }

  const { error } = await supabase
    .from('spks')
    .update({
      pad_marked_at: pickedOrNow(formData, 'tanggal'),
      pad_marked_by: user.id,
      pad_value: numeric(formData, 'value'),
    })
    .eq('id', id)

  if (error) return { error: error.message }

  revalidatePath(`/spk/${id}`)
  revalidatePath('/routing')
  return { error: null, success: 'PAD disimpan.' }
}

export async function unmarkPad(
  _prev: SpkFormState,
  formData: FormData,
): Promise<SpkFormState> {
  await requirePermission('spk', 'edit')

  const id = text(formData, 'id')
  if (!id) return { error: 'SPK tidak dikenali.' }

  const supabase = await createClient()
  const { error } = await supabase
    .from('spks')
    .update({ pad_marked_at: null, pad_marked_by: null, pad_value: null })
    .eq('id', id)

  if (error) return { error: error.message }

  revalidatePath(`/spk/${id}`)
  revalidatePath('/routing')
  return { error: null, success: 'Tanda PAD dibatalkan.' }
}

/**
 * Financial Report's one-stop correction popup for a row: Nilai/Tanggal SPK,
 * PAD, Invoice, and Denda are typed once from source documents (Excel,
 * contracts) rather than lived through day by day, so this writes them
 * straight through instead of routing PAD through markPad's "opname first"
 * workflow gate. Opname itself stays out of this form — it's still marked
 * through the Design Opname stage like every other stage. Invoice lives on
 * the routing document's own Invoiced step (routing_history), not on spks,
 * so it's only saved when that step already exists for this SPK; if it
 * doesn't, the SPK/PAD/Denda fields still save and the response says so.
 */
export async function updateFinancialReportRow(
  _prev: SpkFormState,
  formData: FormData,
): Promise<SpkFormState> {
  const user = await requirePermission('spk', 'edit')

  const id = text(formData, 'id')
  if (!id) return { error: 'SPK tidak dikenali.' }

  const supabase = await createClient()

  const padTanggalRaw = text(formData, 'pad_tanggal')
  const padTanggal = padTanggalRaw ? new Date(`${padTanggalRaw}T12:00:00`).toISOString() : null

  const { error: spkError } = await supabase
    .from('spks')
    .update({
      contract_value: numeric(formData, 'nilai_spk'),
      start_date: nullable(formData, 'tanggal_spk'),
      pad_value: padTanggal ? numeric(formData, 'pad_value') : null,
      pad_marked_at: padTanggal,
      pad_marked_by: padTanggal ? user.id : null,
      denda_value: numeric(formData, 'denda_value'),
    })
    .eq('id', id)
  if (spkError) return { error: spkError.message }

  const invoiceValueRaw = text(formData, 'invoice_value')
  const invoiceTanggalRaw = text(formData, 'invoice_tanggal')

  const { data: routingDoc } = await supabase
    .from('spk_routing')
    .select('id')
    .eq('spk_id', id)
    .maybeSingle()
  const { data: invoicedStep } = routingDoc
    ? await supabase
        .from('routing_history')
        .select('id')
        .eq('spk_routing_id', routingDoc.id)
        .eq('step_name', 'Invoiced')
        .maybeSingle()
    : { data: null }

  let invoiceWarning = ''
  if (invoicedStep) {
    const { error: invoiceError } = await supabase
      .from('routing_history')
      .update({
        invoice_value: numeric(formData, 'invoice_value'),
        invoice_date: nullable(formData, 'invoice_tanggal'),
      })
      .eq('id', invoicedStep.id)
    if (invoiceError) return { error: invoiceError.message }
  } else if (invoiceValueRaw || invoiceTanggalRaw) {
    invoiceWarning = ' Invoice belum tersimpan — dokumen routing belum mencapai tahap Invoiced.'
  }

  revalidatePath('/reports/financial')
  revalidatePath(`/spk/${id}`)
  revalidatePath('/routing')
  revalidatePath('/spk/keuangan-bulanan')
  return { error: null, success: `Perubahan disimpan.${invoiceWarning}` }
}

/**
 * Terrain survey collapses the old Survei Pendahuluan..Pengolahan Data Topo
 * activity chain into one On Going/Selesai mark — those sub-steps were never
 * actually tracked day to day, so a percentage there was noise.
 */
export async function markTerrainSurvey(
  _prev: SpkFormState,
  formData: FormData,
): Promise<SpkFormState> {
  const user = await requirePermission('spk', 'edit')

  const id = text(formData, 'id')
  if (!id) return { error: 'SPK tidak dikenali.' }
  if (!text(formData, 'tanggal') && user.role.code !== 'super_admin') {
    return { error: 'Tanggal survei wajib diisi.' }
  }

  const supabase = await createClient()
  const { error } = await supabase
    .from('spks')
    .update({ terrain_survey_completed_at: pickedOrNow(formData, 'tanggal'), terrain_survey_marked_by: user.id })
    .eq('id', id)

  if (error) return { error: error.message }

  revalidatePath(`/spk/${id}`)
  revalidatePath('/spk')
  revalidatePath('/dashboard')
  return { error: null, success: 'Survei Terestris selesai.' }
}

export async function unmarkTerrainSurvey(
  _prev: SpkFormState,
  formData: FormData,
): Promise<SpkFormState> {
  await requirePermission('spk', 'edit')

  const id = text(formData, 'id')
  if (!id) return { error: 'SPK tidak dikenali.' }

  const supabase = await createClient()
  const { error } = await supabase
    .from('spks')
    .update({ terrain_survey_completed_at: null, terrain_survey_marked_by: null })
    .eq('id', id)

  if (error) return { error: error.message }

  revalidatePath(`/spk/${id}`)
  revalidatePath('/spk')
  revalidatePath('/dashboard')
  return { error: null, success: 'Survei Terestris dikembalikan ke Sedang Berjalan.' }
}

/** Pengecekan Bersama — just a date on the SPK, same as Opname/PAD. */
export async function setJointCheckDate(
  _prev: SpkFormState,
  formData: FormData,
): Promise<SpkFormState> {
  await requirePermission('spk', 'edit')

  const id = text(formData, 'id')
  if (!id) return { error: 'SPK tidak dikenali.' }

  const date = nullable(formData, 'joint_check_date')

  const supabase = await createClient()
  const { error } = await supabase
    .from('spks')
    .update({ joint_check_date: date, joint_check_completed_at: new Date().toISOString() })
    .eq('id', id)

  if (error) return { error: error.message }

  revalidatePath(`/spk/${id}`)
  revalidatePath('/spk')
  revalidatePath('/dashboard')
  return { error: null, success: date ? 'Pengecekan Bersama selesai dan tanggal disimpan.' : 'Pengecekan Bersama selesai.' }
}

export async function unmarkJointCheck(
  _prev: SpkFormState,
  formData: FormData,
): Promise<SpkFormState> {
  await requirePermission('spk', 'edit')

  const id = text(formData, 'id')
  if (!id) return { error: 'SPK tidak dikenali.' }

  const supabase = await createClient()
  const { error } = await supabase
    .from('spks')
    .update({ joint_check_date: null, joint_check_completed_at: null })
    .eq('id', id)

  if (error) return { error: error.message }

  revalidatePath(`/spk/${id}`)
  revalidatePath('/spk')
  revalidatePath('/dashboard')
  return { error: null, success: 'Pengecekan Bersama dikembalikan ke Sedang Berjalan.' }
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
  revalidatePath('/spk/keuangan-bulanan')
  return { error: null }
}
