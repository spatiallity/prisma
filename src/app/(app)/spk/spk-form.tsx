'use client'

import { useActionState, useRef, useState } from 'react'
import { useFormStatus } from 'react-dom'
import { Button } from '@/components/ui/button'
import { Field, Input, Select, Textarea, useRestoreFormValues } from '@/components/ui/field'
import { Alert } from '@/components/ui/alert'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { useActionToast } from '@/components/ui/toast'
import { SPK_STATUSES, type SpkRow } from '@/lib/supabase/types'
import { WORK_TYPE_OPTIONS } from '@/lib/spk'
import type { SpkFormState } from './actions'

export type Option = { id: string; label: string }

const initialState: SpkFormState = { error: null }

function Submit({ label }: { label: string }) {
  const { pending } = useFormStatus()
  return (
    <Button type="submit" disabled={pending}>
      {pending ? 'Menyimpan…' : label}
    </Button>
  )
}

/**
 * Section 11 — data dasar SPK. The same form serves create and edit; only the
 * server action differs.
 */
export function SpkForm({
  action,
  submitLabel,
  spk,
  vendors,
  stakeOutTarget,
}: {
  action: (state: SpkFormState, formData: FormData) => Promise<SpkFormState>
  submitLabel: string
  spk?: SpkRow
  vendors: Option[]
  /** Current "Stake Out" activity target (jumlah titik), when editing one. */
  stakeOutTarget?: number | null
}) {
  const [state, formAction] = useActionState(action, initialState)
  useActionToast(state)
  const formRef = useRef<HTMLFormElement>(null)
  useRestoreFormValues(formRef, state.values)
  const [workType, setWorkType] = useState(spk?.work_type ?? '')
  const isStakeOut = workType === 'Stake Out'

  return (
    <form ref={formRef} action={formAction} className="grid gap-5">
      {spk && <input type="hidden" name="id" value={spk.id} />}

      {state.error && <Alert tone="danger">{state.error}</Alert>}
      {state.success && <Alert tone="success">{state.success}</Alert>}

      <Card>
        <CardHeader>
          <CardTitle>Identitas</CardTitle>
        </CardHeader>
        <CardContent className="grid gap-4 sm:grid-cols-2">
          <Field label="Nomor SPK" htmlFor="spk_number" required>
            <Input
              id="spk_number"
              name="spk_number"
              defaultValue={spk?.spk_number}
              placeholder="SPK-2026-001"
              required
            />
          </Field>

          <Field label="Kode Lokasi" htmlFor="site_code">
            <Input
              id="site_code"
              name="site_code"
              defaultValue={spk?.site_code ?? ''}
              placeholder="BNG-A03"
            />
          </Field>

          <Field label="Nama pekerjaan" htmlFor="work_name" required className="sm:col-span-2">
            <Input
              id="work_name"
              name="work_name"
              defaultValue={spk?.work_name}
              placeholder="Survei Topografi Lokasi Bor …"
              required
            />
          </Field>

          <Field label="Jenis pekerjaan" htmlFor="work_type">
            {spk ? (
              <Input
                id="work_type"
                name="work_type"
                defaultValue={spk.work_type ?? ''}
                readOnly
                className="bg-slate-50 text-muted-foreground"
              />
            ) : (
              <Select
                id="work_type"
                name="work_type"
                value={workType}
                onChange={(event) => setWorkType(event.target.value)}
              >
                <option value="">— pilih jenis pekerjaan —</option>
                {WORK_TYPE_OPTIONS.map((option) => (
                  <option key={option} value={option}>
                    {option}
                  </option>
                ))}
              </Select>
            )}
          </Field>

          {isStakeOut && (
            <Field
              label="Jumlah titik Stake Out"
              htmlFor="stake_out_target"
              required
              hint="Jumlah patok yang akan di-stake out — target progress aktivitas Stake Out."
            >
              <Input
                id="stake_out_target"
                name="stake_out_target"
                inputMode="numeric"
                defaultValue={stakeOutTarget ?? ''}
                placeholder="50"
                required
              />
            </Field>
          )}

          <Field label="Status" htmlFor="status">
            <Select id="status" name="status" defaultValue={spk?.status ?? 'Draft'}>
              {SPK_STATUSES.map((status) => (
                <option key={status} value={status}>
                  {status}
                </option>
              ))}
            </Select>
          </Field>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Lokasi &amp; volume</CardTitle>
        </CardHeader>
        <CardContent className="grid gap-4 sm:grid-cols-2">
          <Field label="Lokasi" htmlFor="location" className="sm:col-span-2">
            <Input id="location" name="location" defaultValue={spk?.location ?? ''} />
          </Field>

          <Field label="Kabupaten/Kota" htmlFor="kabupaten">
            <Input id="kabupaten" name="kabupaten" defaultValue={spk?.kabupaten ?? ''} />
          </Field>

          <Field label="Provinsi" htmlFor="provinsi">
            <Input id="provinsi" name="provinsi" defaultValue={spk?.provinsi ?? ''} />
          </Field>

          <Field label="Luas area (Ha)" htmlFor="area_ha">
            <Input
              id="area_ha"
              name="area_ha"
              inputMode="decimal"
              defaultValue={spk?.area_ha ?? ''}
              placeholder="12.06"
            />
          </Field>

          <Field label="Nilai kontrak (Rp)" htmlFor="contract_value">
            <Input
              id="contract_value"
              name="contract_value"
              inputMode="numeric"
              defaultValue={spk?.contract_value ?? ''}
              placeholder="500000000"
            />
          </Field>

          <Field label="Tanggal mulai" htmlFor="start_date">
            <Input
              id="start_date"
              name="start_date"
              type="date"
              defaultValue={spk?.start_date ?? ''}
            />
          </Field>

          <Field label="Tanggal selesai" htmlFor="end_date">
            <Input
              id="end_date"
              name="end_date"
              type="date"
              defaultValue={spk?.end_date ?? ''}
            />
          </Field>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Vendor</CardTitle>
        </CardHeader>
        <CardContent className="grid gap-4 sm:grid-cols-2">
          <Field label="Vendor Jasa Survey" htmlFor="vendor_id">
            <Select id="vendor_id" name="vendor_id" defaultValue={spk?.vendor_id ?? ''}>
              <option value="">— belum ditentukan —</option>
              {vendors.map((vendor) => (
                <option key={vendor.id} value={vendor.id}>
                  {vendor.label}
                </option>
              ))}
            </Select>
          </Field>

          <Field label="Keterangan" htmlFor="notes" className="sm:col-span-2">
            <Textarea id="notes" name="notes" defaultValue={spk?.notes ?? ''} />
          </Field>
        </CardContent>
      </Card>

      <div>
        <Submit label={submitLabel} />
      </div>
    </form>
  )
}
