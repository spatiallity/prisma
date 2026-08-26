'use client'

import { useActionState, useState } from 'react'
import { useFormStatus } from 'react-dom'
import { Plus } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Field, Input, Select } from '@/components/ui/field'
import { Alert } from '@/components/ui/alert'
import {
  PERSONNEL_COST_TYPES,
  VENDOR_PAYMENT_TERM_TYPES,
  type PersonnelCostType,
} from '@/lib/supabase/types'
import { formatRupiah } from '@/lib/utils'
import {
  saveCashEntry,
  savePersonnelCost,
  saveVendorPayment,
  saveVendorPaymentTerm,
  setSpendingStatus,
  setTermPaid,
  type FinancialState,
} from './actions'

const initialState: FinancialState = { error: null }

export type Choice = { id: string; label: string }

function Feedback({ state }: { state: FinancialState }) {
  if (state.error) return <Alert tone="danger">{state.error}</Alert>
  if (state.success) return <Alert tone="success">{state.success}</Alert>
  return null
}

function Submit({ label }: { label: string }) {
  const { pending } = useFormStatus()
  return (
    <Button type="submit" disabled={pending}>
      <Plus size={16} aria-hidden />
      {pending ? 'Menyimpan…' : label}
    </Button>
  )
}

/** Section 25.6.1 — petty cash. Top-up and spending are the same form. */
export function CashEntryForm({
  categories,
  spks,
}: {
  categories: Choice[]
  spks: Choice[]
}) {
  const [state, formAction] = useActionState(saveCashEntry, initialState)
  const today = new Date().toISOString().slice(0, 10)

  return (
    <form action={formAction} className="grid gap-4">
      <Feedback state={state} />

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Field label="Tanggal" htmlFor="c_date" required>
          <Input id="c_date" name="entry_date" type="date" defaultValue={today} required />
        </Field>

        <Field label="Arah" htmlFor="c_dir" required>
          <Select id="c_dir" name="direction" defaultValue="out">
            <option value="out">Uang keluar</option>
            <option value="in">Uang masuk (top-up)</option>
          </Select>
        </Field>

        <Field label="Jumlah (Rp)" htmlFor="c_amount" required>
          <Input id="c_amount" name="amount" inputMode="numeric" required placeholder="450000" />
        </Field>

        <Field label="Kategori" htmlFor="c_cat">
          <Select id="c_cat" name="category_id" defaultValue="">
            <option value="">— tanpa kategori —</option>
            {categories.map((category) => (
              <option key={category.id} value={category.id}>
                {category.label}
              </option>
            ))}
          </Select>
        </Field>

        <Field
          label="Ditandai ke SPK"
          htmlFor="c_spk"
          hint="Kosong = overhead project, tidak masuk margin SPK mana pun."
          className="sm:col-span-2"
        >
          <Select id="c_spk" name="spk_id" defaultValue="">
            <option value="">— overhead project —</option>
            {spks.map((spk) => (
              <option key={spk.id} value={spk.id}>
                {spk.label}
              </option>
            ))}
          </Select>
        </Field>

        <Field label="PIC" htmlFor="c_pic">
          <Input id="c_pic" name="pic_name" />
        </Field>

        <Field label="Referensi" htmlFor="c_ref">
          <Input id="c_ref" name="reference" placeholder="Nota / kuitansi" />
        </Field>

        <Field label="Keterangan" htmlFor="c_desc" className="sm:col-span-2 lg:col-span-4">
          <Input id="c_desc" name="description" placeholder="BBM Terios" />
        </Field>
      </div>

      <div>
        <Submit label="Catat entri kas" />
      </div>
    </form>
  )
}

/** Section 25.6.2 — salary, MCU, honor. */
export function PersonnelCostForm({
  personnel,
  spks,
}: {
  personnel: Choice[]
  spks: Choice[]
}) {
  const [state, formAction] = useActionState(savePersonnelCost, initialState)
  const [costType, setCostType] = useState<PersonnelCostType>('Gaji')
  const thisMonth = `${new Date().toISOString().slice(0, 7)}-01`

  if (personnel.length === 0) {
    return (
      <Alert tone="warning">
        Belum ada data personel. Tambahkan lewat master Personnel lebih dulu.
      </Alert>
    )
  }

  return (
    <form action={formAction} className="grid gap-4">
      <Feedback state={state} />

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Field label="Personel" htmlFor="p_person" required className="lg:col-span-2">
          <Select id="p_person" name="personnel_id" required>
            {personnel.map((person) => (
              <option key={person.id} value={person.id}>
                {person.label}
              </option>
            ))}
          </Select>
        </Field>

        <Field label="Jenis biaya" htmlFor="p_type" required>
          <Select
            id="p_type"
            name="cost_type"
            value={costType}
            onChange={(event) => setCostType(event.target.value as PersonnelCostType)}
          >
            {PERSONNEL_COST_TYPES.map((type) => (
              <option key={type} value={type}>
                {type}
              </option>
            ))}
          </Select>
        </Field>

        <Field
          label="Periode"
          htmlFor="p_period"
          required
          hint={costType === 'Gaji' ? 'Bulan berlakunya gaji.' : 'Tanggal kejadian.'}
        >
          <Input id="p_period" name="period" type="date" defaultValue={thisMonth} required />
        </Field>

        <Field label="Jumlah (Rp)" htmlFor="p_amount" required>
          <Input id="p_amount" name="amount" inputMode="numeric" required placeholder="6500000" />
        </Field>

        <Field
          label="Ditandai ke SPK"
          htmlFor="p_spk"
          hint="Biasanya kosong — gaji tim adalah overhead, bukan biaya satu SPK."
          className="sm:col-span-2"
        >
          <Select id="p_spk" name="spk_id" defaultValue="">
            <option value="">— overhead project —</option>
            {spks.map((spk) => (
              <option key={spk.id} value={spk.id}>
                {spk.label}
              </option>
            ))}
          </Select>
        </Field>

        <Field label="Keterangan" htmlFor="p_desc" className="lg:col-span-4">
          <Input id="p_desc" name="description" />
        </Field>
      </div>

      <div>
        <Submit label="Catat biaya personel" />
      </div>
    </form>
  )
}

/** Section 25.6.3 — borongan: payable is contract value × agreed percentage. */
export function VendorPaymentForm({
  spks,
  vendors,
}: {
  spks: Choice[]
  vendors: Choice[]
}) {
  const [state, formAction] = useActionState(saveVendorPayment, initialState)
  const [value, setValue] = useState('')
  const [percent, setPercent] = useState('')

  const preview =
    value && percent
      ? (Number(value.replace(/\./g, '').replace(',', '.')) *
          Number(percent.replace(',', '.'))) /
        100
      : null

  if (spks.length === 0 || vendors.length === 0) {
    return <Alert tone="warning">Butuh minimal satu SPK dan satu vendor aktif.</Alert>
  }

  return (
    <form action={formAction} className="grid gap-4">
      <Feedback state={state} />

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Field label="SPK" htmlFor="v_spk" required className="lg:col-span-2">
          <Select id="v_spk" name="spk_id" required>
            {spks.map((spk) => (
              <option key={spk.id} value={spk.id}>
                {spk.label}
              </option>
            ))}
          </Select>
        </Field>

        <Field label="Vendor" htmlFor="v_vendor" required className="lg:col-span-2">
          <Select id="v_vendor" name="vendor_id" required>
            {vendors.map((vendor) => (
              <option key={vendor.id} value={vendor.id}>
                {vendor.label}
              </option>
            ))}
          </Select>
        </Field>

        <Field label="Nilai kontrak (Rp)" htmlFor="v_value" required>
          <Input
            id="v_value"
            name="contract_value"
            inputMode="numeric"
            required
            value={value}
            onChange={(event) => setValue(event.target.value)}
          />
        </Field>

        <Field label="Borongan (%)" htmlFor="v_pct" required>
          <Input
            id="v_pct"
            name="agreed_percentage"
            inputMode="decimal"
            required
            value={percent}
            onChange={(event) => setPercent(event.target.value)}
            placeholder="60"
          />
        </Field>

        <Field
          label="Payable"
          htmlFor="v_preview"
          hint="Dihitung database, bukan disimpan dari sini."
          className="lg:col-span-2"
        >
          <Input
            id="v_preview"
            value={preview === null ? '—' : formatRupiah(preview)}
            readOnly
            tabIndex={-1}
            className="bg-surface-muted font-bold"
          />
        </Field>

        <Field label="Catatan" htmlFor="v_notes" className="lg:col-span-4">
          <Input id="v_notes" name="notes" />
        </Field>
      </div>

      <div>
        <Submit label="Simpan perjanjian borongan" />
      </div>
    </form>
  )
}

/** DP / Progress / Final instalments under one borongan agreement. */
export function TermForm({ vendorPayments }: { vendorPayments: Choice[] }) {
  const [state, formAction] = useActionState(saveVendorPaymentTerm, initialState)

  if (vendorPayments.length === 0) return null

  return (
    <form action={formAction} className="grid gap-3">
      <Feedback state={state} />

      <div className="flex flex-wrap items-end gap-3">
        <Field label="Perjanjian" htmlFor="t_parent" required className="min-w-[240px]">
          <Select id="t_parent" name="vendor_payment_id" required>
            {vendorPayments.map((item) => (
              <option key={item.id} value={item.id}>
                {item.label}
              </option>
            ))}
          </Select>
        </Field>

        <Field label="Jenis" htmlFor="t_type" className="w-32">
          <Select id="t_type" name="term_type" defaultValue="DP">
            {VENDOR_PAYMENT_TERM_TYPES.map((type) => (
              <option key={type} value={type}>
                {type}
              </option>
            ))}
          </Select>
        </Field>

        <Field label="Urutan" htmlFor="t_seq" className="w-24">
          <Input id="t_seq" name="sequence" inputMode="numeric" defaultValue="1" />
        </Field>

        <Field label="Jumlah (Rp)" htmlFor="t_amount" required className="w-40">
          <Input id="t_amount" name="amount" inputMode="numeric" required />
        </Field>

        <Field label="Jatuh tempo" htmlFor="t_due" className="w-44">
          <Input id="t_due" name="due_date" type="date" />
        </Field>

        <Submit label="Tambah termin" />
      </div>
    </form>
  )
}

function InlineSubmit({ label }: { label: string }) {
  const { pending } = useFormStatus()
  return (
    <button
      type="submit"
      disabled={pending}
      className="text-xs font-bold text-primary hover:underline disabled:opacity-50"
    >
      {pending ? '…' : label}
    </button>
  )
}

export function TermPaidToggle({ id, paidDate }: { id: string; paidDate: string | null }) {
  const [state, formAction] = useActionState(setTermPaid, initialState)
  const today = new Date().toISOString().slice(0, 10)

  return (
    <form action={formAction} className="inline">
      <input type="hidden" name="id" value={id} />
      <input type="hidden" name="paid_date" value={paidDate ? '' : today} />
      <InlineSubmit label={paidDate ? 'Batalkan lunas' : 'Tandai lunas'} />
      {state.error && <span className="ml-2 text-xs text-danger">{state.error}</span>}
    </form>
  )
}

export function SpendingStatusToggle({
  kind,
  id,
  status,
}: {
  kind: 'cash' | 'personnel'
  id: string
  status: string
}) {
  const [state, formAction] = useActionState(setSpendingStatus, initialState)
  const next = status === 'Active' ? 'Inactive' : 'Active'

  return (
    <form action={formAction} className="inline">
      <input type="hidden" name="kind" value={kind} />
      <input type="hidden" name="id" value={id} />
      <input type="hidden" name="status" value={next} />
      <InlineSubmit label={next === 'Active' ? 'Aktifkan' : 'Batalkan'} />
      {state.error && <span className="ml-2 text-xs text-danger">{state.error}</span>}
    </form>
  )
}
