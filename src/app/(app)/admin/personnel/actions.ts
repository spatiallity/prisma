'use server'

import { revalidatePath } from 'next/cache'
import { createClient } from '@/lib/supabase/server'
import { requirePermission } from '@/lib/auth/session'
import type { RecordStatus } from '@/lib/supabase/types'

export type PersonnelState = { error: string | null; success?: string }

function text(formData: FormData, key: string) {
  const value = formData.get(key)
  return typeof value === 'string' ? value.trim() : ''
}

function nullable(formData: FormData, key: string) {
  return text(formData, key) || null
}

/** Section 25.6.2 — the internal team that salary, MCU and honor attach to. */
export async function createPersonnel(
  _prev: PersonnelState,
  formData: FormData,
): Promise<PersonnelState> {
  await requirePermission('master_data', 'edit')

  const fullName = text(formData, 'full_name')
  if (!fullName) return { error: 'Nama lengkap wajib diisi.' }

  const supabase = await createClient()
  const { error } = await supabase.from('personnel').insert({
    full_name: fullName,
    code: nullable(formData, 'code'),
    position: nullable(formData, 'position'),
    join_date: nullable(formData, 'join_date'),
    notes: nullable(formData, 'notes'),
  })

  if (error) {
    return {
      error:
        error.code === '23505' ? 'Kode personel sudah dipakai.' : error.message,
    }
  }

  revalidatePath('/admin/personnel')
  return { error: null, success: `${fullName} ditambahkan.` }
}

export async function updatePersonnel(
  _prev: PersonnelState,
  formData: FormData,
): Promise<PersonnelState> {
  await requirePermission('master_data', 'edit')

  const id = text(formData, 'id')
  const fullName = text(formData, 'full_name')
  if (!id) return { error: 'Personel tidak dikenali.' }
  if (!fullName) return { error: 'Nama lengkap wajib diisi.' }

  const supabase = await createClient()
  const { error } = await supabase
    .from('personnel')
    .update({
      full_name: fullName,
      code: nullable(formData, 'code'),
      position: nullable(formData, 'position'),
      join_date: nullable(formData, 'join_date'),
      notes: nullable(formData, 'notes'),
    })
    .eq('id', id)

  if (error) {
    return {
      error:
        error.code === '23505' ? 'Kode personel sudah dipakai.' : error.message,
    }
  }

  revalidatePath('/admin/personnel')
  return { error: null, success: `${fullName} diperbarui.` }
}

/** Section 4.4 — someone who leaves is deactivated, never deleted; their
 *  recorded costs must stay readable. */
export async function setPersonnelStatus(
  _prev: PersonnelState,
  formData: FormData,
): Promise<PersonnelState> {
  await requirePermission('master_data', 'edit')

  const id = text(formData, 'id')
  const status = text(formData, 'status') as RecordStatus
  if (!id || !status) return { error: 'Data tidak lengkap.' }

  const supabase = await createClient()
  const { error } = await supabase.from('personnel').update({ status }).eq('id', id)
  if (error) return { error: error.message }

  revalidatePath('/admin/personnel')
  return { error: null, success: `Personel di-set ${status}.` }
}

export type DeleteState = { error: string | null }

/** Hard delete — migration 0017. Fails with a clear error if a finance_transactions row still points at this person. */
export async function deletePersonnel(
  _prev: DeleteState,
  formData: FormData,
): Promise<DeleteState> {
  await requirePermission('master_data', 'edit')

  const id = text(formData, 'id')
  if (!id) return { error: 'Personel tidak dikenali.' }

  const supabase = await createClient()
  const { error } = await supabase.from('personnel').delete().eq('id', id)
  if (error) {
    return {
      error:
        error.code === '23503'
          ? 'Personel ini masih punya transaksi finance terkait — lepaskan dulu.'
          : error.message,
    }
  }

  revalidatePath('/admin/personnel')
  return { error: null }
}
