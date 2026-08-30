'use client'

import { useActionState, useEffect, useMemo, useRef, useState } from 'react'
import { useFormStatus } from 'react-dom'
import { Plus } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Field, Input, Select, Textarea } from '@/components/ui/field'
import { Alert } from '@/components/ui/alert'
import { Modal } from '@/components/ui/modal'
import { FINANCE_CATEGORY_META } from '@/lib/financial'
import type { FinanceCategory, FinanceTransactionRow } from '@/lib/supabase/types'
import { saveFinanceTransaction, updateFinanceTransaction, type FinanceTxState } from './actions'

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
}: {
  akunOptions: AkunOption[]
  /** Pre-select and hide the kategori field — used by the per-kategori submenu pages. */
  lockedKategori?: FinanceCategory
  /** Present → editing this existing row instead of creating a new one. */
  transaction?: FinanceTransactionRow
  onSaved?: () => void
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
  const savedKey = useRef<string | undefined>(undefined)

  useEffect(() => {
    if (state.success && state.success !== savedKey.current) {
      savedKey.current = state.success
      onSaved?.()
    }
  }, [state.success, onSaved])

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
}: {
  akunOptions: AkunOption[]
  lockedKategori?: FinanceCategory
  label?: string
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
      />
    </Modal>
  )
}

/** Row-level "Edit" trigger — opens the same form pre-filled, via updateFinanceTransaction. */
export function EditTransactionButton({
  akunOptions,
  transaction,
}: {
  akunOptions: AkunOption[]
  transaction: FinanceTransactionRow
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
          className="inline-flex items-center gap-1 text-xs font-bold text-primary hover:underline"
        >
          Edit
        </button>
      }
    >
      <FinanceTransactionForm
        akunOptions={akunOptions}
        transaction={transaction}
        onSaved={() => setOpen(false)}
      />
    </Modal>
  )
}
