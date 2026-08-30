'use server'

import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { requirePermission } from '@/lib/auth/session'
import type { RecordStatus } from '@/lib/supabase/types'

export type VendorFormState = { error: string | null; success?: string }

function text(formData: FormData, key: string) {
  const value = formData.get(key)
  return typeof value === 'string' ? value.trim() : ''
}

function nullable(formData: FormData, key: string) {
  return text(formData, key) || null
}

function friendlyError(message: string, code?: string) {
  if (code === '23505') {
    if (message.includes('vendors_code_key')) return 'Kode vendor sudah dipakai.'
    if (message.includes('vendor_teams_vendor_id_name_key')) {
      return 'Nama team sudah ada pada vendor ini.'
    }
    if (message.includes('spk_assignments_unique_active')) {
      return 'Assignment aktif untuk vendor/team ini sudah ada pada SPK tersebut.'
    }
  }
  return message
}

// --- Vendor master (Section 19) ---------------------------------------------

export async function createVendor(
  _prev: VendorFormState,
  formData: FormData,
): Promise<VendorFormState> {
  const user = await requirePermission('vendor', 'edit')

  const code = text(formData, 'code').toUpperCase()
  const name = text(formData, 'name')
  if (!code || !name) return { error: 'Kode dan nama vendor wajib diisi.' }

  const supabase = await createClient()
  const { data, error } = await supabase
    .from('vendors')
    .insert({
      code,
      name,
      contact_person: nullable(formData, 'contact_person'),
      phone: nullable(formData, 'phone'),
      email: nullable(formData, 'email'),
      address: nullable(formData, 'address'),
      notes: nullable(formData, 'notes'),
      created_by: user.id,
    })
    .select('id')
    .single()

  if (error) return { error: friendlyError(error.message, error.code) }

  revalidatePath('/vendor')
  redirect(`/vendor/${data.id}`)
}

/** Hard delete — migration 0017. Fails with a clear error if teams/assignments still reference this vendor. */
export async function deleteVendor(
  _prev: VendorFormState,
  formData: FormData,
): Promise<VendorFormState> {
  await requirePermission('vendor', 'edit')

  const id = text(formData, 'id')
  if (!id) return { error: 'Vendor tidak dikenali.' }

  const supabase = await createClient()
  const { error } = await supabase.from('vendors').delete().eq('id', id)
  if (error) {
    return {
      error:
        error.code === '23503'
          ? 'Vendor ini masih punya team/assignment terkait — hapus dulu.'
          : error.message,
    }
  }

  revalidatePath('/vendor')
  return { error: null }
}

export async function updateVendor(
  _prev: VendorFormState,
  formData: FormData,
): Promise<VendorFormState> {
  await requirePermission('vendor', 'edit')

  const id = text(formData, 'id')
  const code = text(formData, 'code').toUpperCase()
  const name = text(formData, 'name')
  if (!id || !code || !name) return { error: 'Kode dan nama vendor wajib diisi.' }

  const supabase = await createClient()
  const { error } = await supabase
    .from('vendors')
    .update({
      code,
      name,
      contact_person: nullable(formData, 'contact_person'),
      phone: nullable(formData, 'phone'),
      email: nullable(formData, 'email'),
      address: nullable(formData, 'address'),
      notes: nullable(formData, 'notes'),
      status: (text(formData, 'status') || 'Active') as RecordStatus,
    })
    .eq('id', id)

  if (error) return { error: friendlyError(error.message, error.code) }

  revalidatePath('/vendor')
  revalidatePath(`/vendor/${id}`)
  return { error: null, success: 'Perubahan tersimpan.' }
}

// --- Teams and members ------------------------------------------------------

export async function createTeam(
  _prev: VendorFormState,
  formData: FormData,
): Promise<VendorFormState> {
  await requirePermission('vendor', 'edit')

  const vendorId = text(formData, 'vendor_id')
  const name = text(formData, 'name')
  if (!vendorId || !name) return { error: 'Nama team wajib diisi.' }

  const supabase = await createClient()
  const { error } = await supabase
    .from('vendor_teams')
    .insert({ vendor_id: vendorId, name, notes: nullable(formData, 'notes') })

  if (error) return { error: friendlyError(error.message, error.code) }

  revalidatePath(`/vendor/${vendorId}`)
  return { error: null, success: `Team ${name} ditambahkan.` }
}

export async function updateTeam(
  _prev: VendorFormState,
  formData: FormData,
): Promise<VendorFormState> {
  await requirePermission('vendor', 'edit')

  const id = text(formData, 'id')
  const vendorId = text(formData, 'vendor_id')
  const name = text(formData, 'name')
  if (!id || !name) return { error: 'Nama team wajib diisi.' }

  const supabase = await createClient()
  const { error } = await supabase
    .from('vendor_teams')
    .update({ name, notes: nullable(formData, 'notes') })
    .eq('id', id)

  if (error) return { error: friendlyError(error.message, error.code) }

  revalidatePath(`/vendor/${vendorId}`)
  return { error: null, success: `Team ${name} diperbarui.` }
}

export async function setTeamStatus(
  _prev: VendorFormState,
  formData: FormData,
): Promise<VendorFormState> {
  await requirePermission('vendor', 'edit')

  const id = text(formData, 'id')
  const vendorId = text(formData, 'vendor_id')
  const status = text(formData, 'status') as RecordStatus
  if (!id || !status) return { error: 'Data tidak lengkap.' }

  const supabase = await createClient()
  const { error } = await supabase.from('vendor_teams').update({ status }).eq('id', id)
  if (error) return { error: error.message }

  revalidatePath(`/vendor/${vendorId}`)
  return { error: null, success: `Team di-set ${status}.` }
}

/** Hard delete — migration 0017. */
export async function deleteTeam(
  _prev: VendorFormState,
  formData: FormData,
): Promise<VendorFormState> {
  await requirePermission('vendor', 'edit')

  const id = text(formData, 'id')
  const vendorId = text(formData, 'vendor_id')
  if (!id) return { error: 'Team tidak dikenali.' }

  const supabase = await createClient()
  const { error } = await supabase.from('vendor_teams').delete().eq('id', id)
  if (error) {
    return {
      error:
        error.code === '23503'
          ? 'Team ini masih punya anggota/assignment terkait — hapus dulu.'
          : error.message,
    }
  }

  revalidatePath(`/vendor/${vendorId}`)
  return { error: null }
}

export async function createMember(
  _prev: VendorFormState,
  formData: FormData,
): Promise<VendorFormState> {
  await requirePermission('vendor', 'edit')

  const teamId = text(formData, 'team_id')
  const fullName = text(formData, 'full_name')
  const vendorId = text(formData, 'vendor_id')
  if (!teamId || !fullName) return { error: 'Team dan nama anggota wajib diisi.' }

  const supabase = await createClient()
  const { error } = await supabase.from('vendor_members').insert({
    team_id: teamId,
    full_name: fullName,
    position: nullable(formData, 'position'),
    phone: nullable(formData, 'phone'),
  })

  if (error) return { error: friendlyError(error.message, error.code) }

  revalidatePath(`/vendor/${vendorId}`)
  return { error: null, success: `${fullName} ditambahkan.` }
}

export async function updateMember(
  _prev: VendorFormState,
  formData: FormData,
): Promise<VendorFormState> {
  await requirePermission('vendor', 'edit')

  const id = text(formData, 'id')
  const teamId = text(formData, 'team_id')
  const vendorId = text(formData, 'vendor_id')
  const fullName = text(formData, 'full_name')
  if (!id || !teamId || !fullName) return { error: 'Team dan nama anggota wajib diisi.' }

  const supabase = await createClient()
  const { error } = await supabase
    .from('vendor_members')
    .update({
      team_id: teamId,
      full_name: fullName,
      position: nullable(formData, 'position'),
      phone: nullable(formData, 'phone'),
    })
    .eq('id', id)

  if (error) return { error: friendlyError(error.message, error.code) }

  revalidatePath(`/vendor/${vendorId}`)
  return { error: null, success: `${fullName} diperbarui.` }
}

export async function setMemberStatus(
  _prev: VendorFormState,
  formData: FormData,
): Promise<VendorFormState> {
  await requirePermission('vendor', 'edit')

  const id = text(formData, 'id')
  const vendorId = text(formData, 'vendor_id')
  const status = text(formData, 'status') as RecordStatus
  if (!id || !status) return { error: 'Data tidak lengkap.' }

  const supabase = await createClient()
  const { error } = await supabase.from('vendor_members').update({ status }).eq('id', id)
  if (error) return { error: error.message }

  revalidatePath(`/vendor/${vendorId}`)
  return { error: null, success: `Anggota di-set ${status}.` }
}

/** Hard delete — migration 0017. */
export async function deleteMember(
  _prev: VendorFormState,
  formData: FormData,
): Promise<VendorFormState> {
  await requirePermission('vendor', 'edit')

  const id = text(formData, 'id')
  const vendorId = text(formData, 'vendor_id')
  if (!id) return { error: 'Anggota tidak dikenali.' }

  const supabase = await createClient()
  const { error } = await supabase.from('vendor_members').delete().eq('id', id)
  if (error) return { error: error.message }

  revalidatePath(`/vendor/${vendorId}`)
  return { error: null }
}

// --- Assignment (Section 19 — drives vendor RLS scope) ----------------------

export async function createAssignment(
  _prev: VendorFormState,
  formData: FormData,
): Promise<VendorFormState> {
  const user = await requirePermission('vendor', 'edit')

  const spkId = text(formData, 'spk_id')
  const vendorId = text(formData, 'vendor_id')
  if (!spkId || !vendorId) return { error: 'SPK dan vendor wajib dipilih.' }

  const from = nullable(formData, 'assigned_from')
  const to = nullable(formData, 'assigned_to')
  if (from && to && to < from) {
    return { error: 'Tanggal selesai tidak boleh lebih awal dari tanggal mulai.' }
  }

  const supabase = await createClient()
  const { error } = await supabase.from('spk_assignments').insert({
    spk_id: spkId,
    vendor_id: vendorId,
    team_id: nullable(formData, 'team_id'),
    assigned_from: from,
    assigned_to: to,
    notes: nullable(formData, 'notes'),
    created_by: user.id,
  })

  if (error) return { error: friendlyError(error.message, error.code) }

  revalidatePath('/vendor/assignment')
  revalidatePath(`/spk/${spkId}`)
  return { error: null, success: 'Assignment dibuat.' }
}

/** Section 4.4 — an assignment ends by going Inactive, it is never deleted. */
export async function setAssignmentStatus(
  _prev: VendorFormState,
  formData: FormData,
): Promise<VendorFormState> {
  await requirePermission('vendor', 'edit')

  const id = text(formData, 'id')
  const spkId = text(formData, 'spk_id')
  const status = text(formData, 'status') as RecordStatus
  if (!id || !status) return { error: 'Data tidak lengkap.' }

  const supabase = await createClient()
  const { error } = await supabase.from('spk_assignments').update({ status }).eq('id', id)
  if (error) return { error: error.message }

  revalidatePath('/vendor/assignment')
  if (spkId) revalidatePath(`/spk/${spkId}`)
  return { error: null, success: `Assignment di-set ${status}.` }
}

/** Hard delete — migration 0017. */
export async function deleteAssignment(
  _prev: VendorFormState,
  formData: FormData,
): Promise<VendorFormState> {
  await requirePermission('vendor', 'edit')

  const id = text(formData, 'id')
  const spkId = text(formData, 'spk_id')
  if (!id) return { error: 'Assignment tidak dikenali.' }

  const supabase = await createClient()
  const { error } = await supabase.from('spk_assignments').delete().eq('id', id)
  if (error) return { error: error.message }

  revalidatePath('/vendor/assignment')
  if (spkId) revalidatePath(`/spk/${spkId}`)
  return { error: null }
}
