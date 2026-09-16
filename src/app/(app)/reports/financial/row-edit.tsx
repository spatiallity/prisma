'use client'

import { useActionState, useState } from 'react'
import { useFormStatus } from 'react-dom'
import { Pencil } from 'lucide-react'
import { Modal } from '@/components/ui/modal'
import { Field, Input } from '@/components/ui/field'
import { Button } from '@/components/ui/button'
import { useActionToast } from '@/components/ui/toast'
import { updateFinancialReportRow, type SpkFormState } from '../../spk/actions'
import type { FinancialRow } from './financial-report-table'

const initialState: SpkFormState = { error: null }

function Submit() {
  const { pending } = useFormStatus()
  return (
    <Button type="submit" disabled={pending}>
      {pending ? 'Menyimpan…' : 'Simpan perubahan'}
    </Button>
  )
}

/** One popup edits everything this row shows — Nilai/Tanggal SPK, PAD,
 *  Invoice, Denda — typed once from source documents rather than marked day
 *  by day, so it skips the usual "opname before PAD" workflow gate. Opname
 *  itself isn't here — still marked through the Design Opname stage. */
export function FinancialRowEditButton({ row }: { row: FinancialRow }) {
  const [open, setOpen] = useState(false)
  const [state, formAction] = useActionState(updateFinancialReportRow, initialState)
  useActionToast(state, () => setOpen(false))

  return (
    <Modal
      open={open}
      onOpenChange={setOpen}
      title={`Edit ${row.siteCode ?? row.spkNumber}`}
      trigger={
        <button
          type="button"
          className="inline-flex h-8 w-8 items-center justify-center rounded-lg border border-slate-300 bg-white text-slate-600 hover:bg-slate-50"
          aria-label={`Edit ${row.siteCode ?? row.spkNumber}`}
        >
          <Pencil size={14} aria-hidden />
        </button>
      }
    >
      <form action={formAction} className="grid gap-4">
        <input type="hidden" name="id" value={row.spkId} />
        <div className="grid grid-cols-2 gap-4">
          <Field label="Nilai SPK (Rp)" htmlFor="nilai_spk">
            <Input id="nilai_spk" name="nilai_spk" inputMode="numeric" defaultValue={row.nilaiSpk} />
          </Field>
          <Field label="Tanggal SPK" htmlFor="tanggal_spk">
            <Input id="tanggal_spk" name="tanggal_spk" type="date" defaultValue={row.tanggalMulai ?? ''} />
          </Field>
          <Field label="Nilai PAD (Rp)" htmlFor="pad_value">
            <Input id="pad_value" name="pad_value" inputMode="numeric" defaultValue={row.padValue ?? ''} />
          </Field>
          <Field label="Tanggal PAD" htmlFor="pad_tanggal">
            <Input
              id="pad_tanggal"
              name="pad_tanggal"
              type="date"
              defaultValue={row.padMarkedAt?.slice(0, 10) ?? ''}
            />
          </Field>
          <Field label="Nilai Invoice (Rp)" htmlFor="invoice_value">
            <Input id="invoice_value" name="invoice_value" inputMode="numeric" defaultValue={row.invoiceValue ?? ''} />
          </Field>
          <Field label="Tanggal Invoice" htmlFor="invoice_tanggal">
            <Input id="invoice_tanggal" name="invoice_tanggal" type="date" defaultValue={row.invoiceDate ?? ''} />
          </Field>
          <Field
            label="Nilai Denda (Rp)"
            htmlFor="denda_value"
            hint="Kosongkan kalau tidak ada denda."
            className="col-span-2"
          >
            <Input id="denda_value" name="denda_value" inputMode="numeric" defaultValue={row.dendaValue ?? ''} />
          </Field>
        </div>
        <Submit />
      </form>
    </Modal>
  )
}
