'use client'

import { useActionState, useEffect, useId, useMemo, useRef, useState } from 'react'
import { useFormStatus } from 'react-dom'
import { Download, Pencil, Plus, Upload } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Field, Input, Select, Textarea } from '@/components/ui/field'
import { Alert } from '@/components/ui/alert'
import { Modal } from '@/components/ui/modal'
import { useActionToast } from '@/components/ui/toast'
import { FINANCE_CATEGORY_META } from '@/lib/financial'
import { PERJAB_STATUSES, type FinanceCategory } from '@/lib/supabase/types'
import {
  importFinanceTransactions,
  saveFinanceTransaction,
  updateFinanceTransaction,
  type FinanceTxState,
} from './actions'
import type { FinanceTransactionListRow } from '../finance-transactions-table'

const initialState: FinanceTxState = { error: null }

export type AkunOption = {
  kode_akun: string
  uraian: string
  kategori_roman_label: string | null
}

/** 1.500.000 — matches what the server's money() parser expects back. */
function formatAmountInput(value: number) {
  return new Intl.NumberFormat('id-ID', { maximumFractionDigits: 2 }).format(value)
}

function Submit({ editing }: { editing: boolean }) {
  const { pending } = useFormStatus()
  return (
    <Button type="submit" disabled={pending}>
      <Plus size={16} aria-hidden />
      {pending ? 'Menyimpan…' : editing ? 'Simpan perubahan' : 'Simpan transaksi'}
    </Button>
  )
}

function Feedback({ state }: { state: FinanceTxState }) {
  if (state.error) return <Alert tone="danger">{state.error}</Alert>
  if (state.success) return <Alert tone="success">{state.success}</Alert>
  return null
}

/** Type-to-filter over the Chart of Accounts leaves — ~35 rows, no debounce needed. */
function AkunCombobox({
  options,
  name,
  defaultValue,
}: {
  options: AkunOption[]
  name: string
  /** kode_akun to pre-select when editing an existing transaction. */
  defaultValue?: string
}) {
  const [query, setQuery] = useState('')
  const [selected, setSelected] = useState<AkunOption | null>(
    () => options.find((o) => o.kode_akun === defaultValue) ?? null,
  )
  const [open, setOpen] = useState(false)

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase()
    if (!q) return options
    return options.filter(
      (o) => o.kode_akun.toLowerCase().includes(q) || o.uraian.toLowerCase().includes(q),
    )
  }, [options, query])

  return (
    <div className="relative">
      <input type="hidden" name={name} value={selected?.kode_akun ?? ''} />
      <Input
        value={selected ? `${selected.kode_akun} — ${selected.uraian}` : query}
        onChange={(event) => {
          setSelected(null)
          setQuery(event.target.value)
          setOpen(true)
        }}
        onFocus={() => setOpen(true)}
        onBlur={() => setTimeout(() => setOpen(false), 150)}
        placeholder="Cari kode atau uraian akun…"
        autoComplete="off"
      />
      {open && filtered.length > 0 && (
        <ul className="absolute z-10 mt-1 max-h-64 w-full overflow-auto rounded-lg border border-slate-200 bg-surface shadow-lg">
          {filtered.map((option) => (
            <li key={option.kode_akun}>
              <button
                type="button"
                className="flex w-full flex-col items-start gap-0.5 px-3 py-2 text-left text-sm hover:bg-slate-50"
                onMouseDown={(event) => event.preventDefault()}
                onClick={() => {
                  setSelected(option)
                  setQuery('')
                  setOpen(false)
                }}
              >
                <span className="font-bold text-slate-900">
                  <span className="code">{option.kode_akun}</span> — {option.uraian}
                </span>
                {option.kategori_roman_label && (
                  <span className="text-xs text-muted-foreground">
                    {option.kategori_roman_label}
                  </span>
                )}
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}

/**
 * One form for all six Excel-tab categories. UMK / PPBJ Barang / PPBJ Jasa
 * search the Chart of Accounts freely; Gaji PTT Project picks Upah/Tunjangan
 * (which fixes the kode_akun); SPPD and MCU need no account choice at all —
 * the server derives their fixed kode_akun.
 */
export function FinanceTransactionForm({
  akunOptions,
  lockedKategori,
  transaction,
  onSaved,
  pjOptions = [],
}: {
  akunOptions: AkunOption[]
  /** Pre-select and hide the kategori field — used by the per-kategori submenu pages. */
  lockedKategori?: FinanceCategory
  /** Present → editing this existing row instead of creating a new one. */
  transaction?: FinanceTransactionListRow
  onSaved?: () => void
  /** Names already used as PJ UMK, for the autocomplete — umk kategori only. */
  pjOptions?: string[]
}) {
  const editing = !!transaction
  const [state, formAction] = useActionState(
    editing ? updateFinanceTransaction : saveFinanceTransaction,
    initialState,
  )
  const [kategori, setKategori] = useState<FinanceCategory>(
    transaction?.kategori ?? lockedKategori ?? 'umk',
  )
  const meta = FINANCE_CATEGORY_META[kategori]
  const isGaji = kategori === 'gaji_ptt'
  const needsAkun = meta.fixedAkun === null && !isGaji
  const isUmk = kategori === 'umk'
  const pjListId = useId()
  useActionToast(state, onSaved)

  return (
    <form action={formAction} className="grid gap-4">
      <Feedback state={state} />

      {transaction && <input type="hidden" name="id" value={transaction.id} />}

      {lockedKategori ? (
        <input type="hidden" name="kategori" value={lockedKategori} />
      ) : (
        <Field label="Kategori" htmlFor="ft_kategori" required>
          <Select
            id="ft_kategori"
            name="kategori"
            required
            value={kategori}
            onChange={(event) => setKategori(event.target.value as FinanceCategory)}
          >
            {(Object.keys(FINANCE_CATEGORY_META) as FinanceCategory[]).map((k) => (
              <option key={k} value={k}>
                {FINANCE_CATEGORY_META[k].label}
              </option>
            ))}
          </Select>
        </Field>
      )}

      {needsAkun && (
        <Field
          label="Kode akun"
          htmlFor="ft_akun"
          required
          hint="Cari berdasarkan kode atau nama akun."
        >
          <AkunCombobox options={akunOptions} name="kode_akun" defaultValue={transaction?.kode_akun} />
        </Field>
      )}

      {isGaji && (
        <Field label="Jenis" htmlFor="ft_jenis" required>
          <Select id="ft_jenis" name="jenis_detail" required defaultValue={transaction?.jenis_detail ?? 'Upah'}>
            <option value="Upah">Upah — 1.7.1</option>
            <option value="Tunjangan">Tunjangan — 1.7.3</option>
          </Select>
        </Field>
      )}

      {!needsAkun && !isGaji && (
        <p className="text-xs text-muted-foreground">
          Kode akun otomatis: <span className="code">{meta.fixedAkun}</span>
        </p>
      )}

      <Field label="Tanggal" htmlFor="ft_tanggal" required>
        <Input
          id="ft_tanggal"
          name="tanggal"
          type="date"
          required
          defaultValue={transaction?.tanggal ?? undefined}
        />
      </Field>

      <Field label="Jumlah (Rp)" htmlFor="ft_jumlah" required>
        <Input
          id="ft_jumlah"
          name="jumlah"
          inputMode="decimal"
          placeholder="1.500.000"
          required
          defaultValue={transaction ? formatAmountInput(Number(transaction.jumlah)) : undefined}
        />
      </Field>

      <Field label="Deskripsi" htmlFor="ft_deskripsi">
        <Textarea id="ft_deskripsi" name="deskripsi" rows={2} defaultValue={transaction?.deskripsi ?? undefined} />
      </Field>

      <div className="grid gap-3 sm:grid-cols-2">
        <Field label="No. bukti" htmlFor="ft_bukti" hint="Opsional">
          <Input id="ft_bukti" name="no_bukti" defaultValue={transaction?.no_bukti ?? undefined} />
        </Field>
        <Field label="Nama personel" htmlFor="ft_nama" hint="Opsional">
          <Input id="ft_nama" name="personil_nama" defaultValue={transaction?.personil_nama ?? undefined} />
        </Field>
      </div>

      {isUmk && (
        <Field
          label="PJ UMK"
          htmlFor="ft_pj"
          hint="Yang mengambil dana dari kas korporat — beda dari Nama Personel di atas."
        >
          <Input
            id="ft_pj"
            name="pj_nama"
            list={pjListId}
            defaultValue={transaction?.pj_nama ?? undefined}
            autoComplete="off"
          />
          <datalist id={pjListId}>
            {pjOptions.map((name) => (
              <option key={name} value={name} />
            ))}
          </datalist>
        </Field>
      )}

      {isUmk && (
        <Field label="Perjab" htmlFor="ft_perjab" required hint="Sudah dipertanggungjawabkan atau belum.">
          <Select id="ft_perjab" name="perjab" required defaultValue={transaction?.perjab ?? 'Belum'}>
            {PERJAB_STATUSES.map((status) => (
              <option key={status} value={status}>
                {status}
              </option>
            ))}
          </Select>
        </Field>
      )}

      <div>
        <Submit editing={editing} />
      </div>
    </form>
  )
}

/** Top-right "Add Data" trigger + popup form — no scrolling to find it. */
export function AddTransactionButton({
  akunOptions,
  lockedKategori,
  label = 'Add Data',
  pjOptions,
}: {
  akunOptions: AkunOption[]
  lockedKategori?: FinanceCategory
  label?: string
  pjOptions?: string[]
}) {
  const [open, setOpen] = useState(false)
  return (
    <Modal
      open={open}
      onOpenChange={setOpen}
      title={lockedKategori ? `Input ${FINANCE_CATEGORY_META[lockedKategori].label}` : 'Input transaksi'}
      description="Kode akun otomatis untuk Gaji PTT Project, SPPD, dan MCU."
      trigger={
        <Button type="button">
          <Plus size={16} aria-hidden />
          {label}
        </Button>
      }
    >
      <FinanceTransactionForm
        akunOptions={akunOptions}
        lockedKategori={lockedKategori}
        onSaved={() => setOpen(false)}
        pjOptions={pjOptions}
      />
    </Modal>
  )
}

/** Row-level "Edit" trigger — opens the same form pre-filled, via updateFinanceTransaction. */
export function EditTransactionButton({
  akunOptions,
  transaction,
  pjOptions,
}: {
  akunOptions: AkunOption[]
  transaction: FinanceTransactionListRow
  pjOptions?: string[]
}) {
  const [open, setOpen] = useState(false)
  return (
    <Modal
      open={open}
      onOpenChange={setOpen}
      title="Edit transaksi"
      trigger={
        <button
          type="button"
          className="flex items-center gap-2 rounded-md px-2 py-1.5 text-left text-xs font-bold text-slate-700 hover:bg-slate-50"
        >
          <Pencil size={14} aria-hidden />
          Edit
        </button>
      }
    >
      <FinanceTransactionForm
        akunOptions={akunOptions}
        transaction={transaction}
        onSaved={() => setOpen(false)}
        pjOptions={pjOptions}
      />
    </Modal>
  )
}

/** Plain GET link — no client JS needed, the browser just downloads it. */
export function DownloadTemplateButton({ kategori }: { kategori: FinanceCategory }) {
  return (
    <a
      href={`/api/financial/template?kategori=${kategori}`}
      className="inline-flex h-10 items-center gap-2 rounded-lg border border-slate-300 bg-surface px-4 text-sm font-bold text-slate-700 transition-colors hover:bg-slate-50"
    >
      <Download size={16} aria-hidden />
      Download Template
    </a>
  )
}

/** Exports the kategori's current transaction list as a report — not to be
 *  confused with the blank template above, which is for bulk-import. */
export function DownloadDataButton({ kategori }: { kategori: FinanceCategory }) {
  return (
    <a
      href={`/api/financial/export?kategori=${kategori}`}
      className="inline-flex h-10 items-center gap-2 rounded-lg border border-slate-300 bg-surface px-4 text-sm font-bold text-slate-700 transition-colors hover:bg-slate-50"
    >
      <Download size={16} aria-hidden />
      Download Data
    </a>
  )
}

/** Every kode akun, every month, anggaran vs realisasi — one sheet, not
 *  filtered to whatever single bulan the page happens to be showing. */
export function DownloadRabButton() {
  return (
    <a
      href="/api/financial/rab-export"
      className="inline-flex h-10 items-center gap-2 rounded-lg border border-slate-300 bg-surface px-4 text-sm font-bold text-slate-700 transition-colors hover:bg-slate-50"
    >
      <Download size={16} aria-hidden />
      Download Serapan RAB
    </a>
  )
}

function ImportSubmit() {
  const { pending } = useFormStatus()
  return (
    <Button type="submit" disabled={pending}>
      {pending ? 'Mengimpor…' : 'Import'}
    </Button>
  )
}

/**
 * Admin fills the downloaded template in Excel, then uploads it here —
 * everything on the sheet is validated and inserted in one go by
 * importFinanceTransactions (all-or-nothing; see actions.ts for why).
 *
 * Deliberately does NOT auto-close on success (unlike every other modal in
 * this file) — a file upload takes a beat longer than a normal form submit,
 * and the transient toast alone wasn't enough for someone to notice it
 * actually landed; they'd re-upload the same file, planting a duplicate row
 * each retry. The row count now stays on screen until they close it
 * themselves, and the file input is cleared after a success so accidentally
 * clicking Import again can't resubmit the same file.
 */
export function ImportTransactionsButton({ kategori }: { kategori: FinanceCategory }) {
  const [open, setOpen] = useState(false)
  const [state, formAction] = useActionState(importFinanceTransactions, initialState)
  const formRef = useRef<HTMLFormElement>(null)
  useEffect(() => {
    if (state.success) formRef.current?.reset()
  }, [state.success])

  return (
    <Modal
      open={open}
      onOpenChange={setOpen}
      title={`Upload Excel — ${FINANCE_CATEGORY_META[kategori].label}`}
      description="File harus dari template yang di-download — sheet dan kolomnya tidak boleh diubah urutannya."
      trigger={
        <Button type="button" variant="secondary">
          <Upload size={16} aria-hidden />
          Upload Excel
        </Button>
      }
    >
      <form ref={formRef} action={formAction} className="grid gap-4">
        {state.error && <Alert tone="danger">{state.error}</Alert>}
        {state.success && <Alert tone="success">{state.success}</Alert>}
        <input type="hidden" name="kategori" value={kategori} />

        <Field label="File Excel (.xlsx)" htmlFor="ft_file" required>
          <input
            id="ft_file"
            name="file"
            type="file"
            accept=".xlsx"
            required
            className="block w-full text-sm text-slate-700 file:mr-3 file:rounded-lg file:border-0 file:bg-primary file:px-3 file:py-2 file:text-sm file:font-bold file:text-white"
          />
        </Field>

        <div className="flex justify-end gap-2">
          <Button type="button" variant="secondary" onClick={() => setOpen(false)}>
            {state.success ? 'Tutup' : 'Batal'}
          </Button>
          <ImportSubmit />
        </div>
      </form>
    </Modal>
  )
}
