'use client'

import { useActionState, useMemo, useState, type ReactNode } from 'react'
import { useFormStatus } from 'react-dom'
import { AlertTriangle, Trash2 } from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { DeleteButton } from '@/components/ui/delete-button'
import { DataTable, type DataTableColumn } from '@/components/ui/data-table'
import { Modal } from '@/components/ui/modal'
import { useActionToast } from '@/components/ui/toast'
import { formatDate, formatDateTime, formatRupiah } from '@/lib/utils'
import { FINANCE_CATEGORY_META } from '@/lib/financial'
import type { FinanceTransactionRow } from '@/lib/supabase/types'
import { deleteFinanceTransaction, deleteFinanceTransactions, type FinanceTxState } from './rab/actions'
import { EditTransactionButton, type AkunOption } from './rab/finance-form'

/** Confirm-then-delete for a set of selected rows at once — same pattern as
 *  the single-row DeleteButton, just with N hidden `id` inputs instead of
 *  one, and a count in the confirm text. */
function BulkDeleteButton({ ids, onDeleted }: { ids: string[]; onDeleted: () => void }) {
  const [state, formAction] = useActionState<FinanceTxState, FormData>(deleteFinanceTransactions, {
    error: null,
  })
  const [open, setOpen] = useState(false)
  useActionToast(state, () => {
    setOpen(false)
    onDeleted()
  })

  return (
    <Modal
      open={open}
      onOpenChange={setOpen}
      title="Apakah Anda yakin?"
      trigger={
        <Button type="button" variant="danger">
          <Trash2 size={16} aria-hidden />
          Hapus {ids.length} terpilih
        </Button>
      }
    >
      <div className="grid gap-4">
        <div className="flex items-start gap-3">
          <AlertTriangle size={20} className="mt-0.5 shrink-0 text-danger" aria-hidden />
          <p className="text-sm text-slate-700">
            Hapus {ids.length} transaksi terpilih? Tindakan ini permanen dan tidak bisa
            dibatalkan.
          </p>
        </div>

        {state.error && <p className="text-sm font-semibold text-danger">{state.error}</p>}

        <form action={formAction} className="flex justify-end gap-2">
          {ids.map((id) => (
            <input key={id} type="hidden" name="id" value={id} />
          ))}
          <Button type="button" variant="secondary" onClick={() => setOpen(false)}>
            Batal
          </Button>
          <BulkDeleteSubmit />
        </form>
      </div>
    </Modal>
  )
}

function BulkDeleteSubmit() {
  const { pending } = useFormStatus()
  return (
    <Button type="submit" variant="danger" disabled={pending}>
      {pending ? 'Menghapus…' : 'Ya, Hapus'}
    </Button>
  )
}

/**
 * Column definitions (and their render closures) have to live in a client
 * component — Next.js can't serialize functions across the server/client
 * boundary, so this can't be built as columns-array-as-a-prop from a server
 * page. Shared by Monitoring RAB and all six per-kategori pages.
 */
export function FinanceTransactionsTable({
  rows,
  coa,
  mayEdit,
  showKategori = false,
  emptyTitle = 'Belum ada transaksi',
  searchPlaceholder = 'Cari deskripsi, personel, kode akun…',
  actorName = {},
  pjOptions,
}: {
  rows: FinanceTransactionRow[]
  coa: AkunOption[]
  mayEdit: boolean
  showKategori?: boolean
  emptyTitle?: string
  searchPlaceholder?: string
  /** user id -> full_name, for "ditambahkan oleh" in the row detail popup. */
  actorName?: Record<string, string>
  /** Names already used as PJ UMK, for the Edit form's autocomplete. */
  pjOptions?: string[]
}) {
  const akunByKode = useMemo(() => new Map(coa.map((a) => [a.kode_akun, a])), [coa])
  const showJenis = rows.some((r) => r.jenis_detail)
  const showPerjab = rows.some((r) => r.perjab)
  const [detail, setDetail] = useState<FinanceTransactionRow | null>(null)
  const [selected, setSelected] = useState<Set<string>>(new Set())

  const columns: DataTableColumn<FinanceTransactionRow>[] = [
    ...(showKategori
      ? [
          {
            key: 'kategori',
            label: 'Kategori',
            sortAccessor: (row) => FINANCE_CATEGORY_META[row.kategori].label,
            render: (row) => (
              <>
                <Badge tone="info">{FINANCE_CATEGORY_META[row.kategori].label}</Badge>
                {row.jenis_detail && (
                  <span className="ml-1 text-xs text-muted-foreground">{row.jenis_detail}</span>
                )}
              </>
            ),
          } satisfies DataTableColumn<FinanceTransactionRow>,
        ]
      : []),
    {
      key: 'kode_akun',
      label: 'Kode akun',
      sortAccessor: (row) => row.kode_akun,
      render: (row) => {
        const akun = akunByKode.get(row.kode_akun)
        return (
          <>
            <span className="code text-xs">{row.kode_akun}</span>
            {akun && <div className="text-xs text-muted-foreground">{akun.uraian}</div>}
          </>
        )
      },
    },
    ...(!showKategori && showJenis
      ? [
          {
            key: 'jenis_detail',
            label: 'Jenis',
            sortAccessor: (row: FinanceTransactionRow) => row.jenis_detail,
            render: (row: FinanceTransactionRow) =>
              row.jenis_detail ? <Badge tone="info">{row.jenis_detail}</Badge> : '—',
          } satisfies DataTableColumn<FinanceTransactionRow>,
        ]
      : []),
    {
      key: 'tanggal',
      label: 'Tanggal',
      className: 'whitespace-nowrap tnum text-muted-foreground',
      sortAccessor: (row) => row.tanggal ?? row.bulan,
      render: (row) => formatDate(row.tanggal ?? row.bulan),
    },
    {
      key: 'deskripsi',
      label: 'Deskripsi',
      className: 'max-w-xs text-muted-foreground',
      render: (row) => <span className="line-clamp-2">{row.deskripsi ?? '—'}</span>,
    },
    {
      key: 'personil_nama',
      label: 'Personel',
      className: 'text-muted-foreground',
      sortAccessor: (row) => row.personil_nama,
      render: (row) => row.personil_nama ?? '—',
    },
    ...(showPerjab
      ? [
          {
            key: 'perjab',
            label: 'Perjab',
            sortAccessor: (row: FinanceTransactionRow) => row.perjab,
            render: (row: FinanceTransactionRow) =>
              row.perjab ? (
                <Badge tone={row.perjab === 'Sudah' ? 'success' : 'warning'}>{row.perjab}</Badge>
              ) : (
                '—'
              ),
          } satisfies DataTableColumn<FinanceTransactionRow>,
        ]
      : []),
    ...(!showKategori
      ? [
          {
            key: 'no_bukti',
            label: 'No. bukti',
            className: 'text-muted-foreground',
            render: (row: FinanceTransactionRow) => row.no_bukti ?? '—',
          } satisfies DataTableColumn<FinanceTransactionRow>,
        ]
      : []),
    {
      key: 'jumlah',
      label: 'Jumlah',
      align: 'right',
      className: 'font-bold',
      sortAccessor: (row) => Number(row.jumlah),
      render: (row) => formatRupiah(row.jumlah),
    },
    ...(mayEdit
      ? [
          {
            key: 'aksi',
            label: 'Aksi',
            align: 'right',
            stopRowClick: true,
            render: (row: FinanceTransactionRow) => (
              <div className="flex items-center justify-end gap-3">
                <EditTransactionButton akunOptions={coa} transaction={row} pjOptions={pjOptions} />
                <DeleteButton
                  action={deleteFinanceTransaction}
                  hiddenFields={{ id: row.id }}
                  itemLabel="transaksi ini"
                />
              </div>
            ),
          } satisfies DataTableColumn<FinanceTransactionRow>,
        ]
      : []),
  ]

  return (
    <>
      {mayEdit && selected.size > 0 && (
        <div className="flex items-center justify-between gap-3 border-b border-slate-100 bg-slate-50 px-3 py-2">
          <span className="text-sm font-bold text-slate-700">{selected.size} dipilih</span>
          <BulkDeleteButton ids={[...selected]} onDeleted={() => setSelected(new Set())} />
        </div>
      )}

      <DataTable
        columns={columns}
        rows={rows}
        rowKey={(row) => row.id}
        searchAccessor={(row) =>
          [
            showKategori ? FINANCE_CATEGORY_META[row.kategori].label : null,
            row.kode_akun,
            row.deskripsi,
            row.personil_nama,
            row.no_bukti,
          ]
            .filter(Boolean)
            .join(' ')
        }
        searchPlaceholder={searchPlaceholder}
        emptyTitle={emptyTitle}
        defaultSort={{ key: 'tanggal', dir: 'desc' }}
        onRowClick={setDetail}
        selectedKeys={mayEdit ? selected : undefined}
        onSelectionChange={mayEdit ? setSelected : undefined}
      />

      <Modal
        open={!!detail}
        onOpenChange={(open) => !open && setDetail(null)}
        title={detail ? `${detail.kode_akun} — ${akunByKode.get(detail.kode_akun)?.uraian ?? ''}` : ''}
        description="Detail transaksi."
      >
        {detail && (
          <dl className="grid grid-cols-1 gap-x-4 gap-y-3 text-sm sm:grid-cols-2">
            {showKategori && (
              <Field label="Kategori">
                {FINANCE_CATEGORY_META[detail.kategori].label}
              </Field>
            )}
            {detail.jenis_detail && <Field label="Jenis">{detail.jenis_detail}</Field>}
            <Field label="Tanggal">{formatDate(detail.tanggal ?? detail.bulan)}</Field>
            <Field label="Jumlah">
              <span className="font-bold">{formatRupiah(detail.jumlah)}</span>
            </Field>
            <Field label="Personel">{detail.personil_nama ?? '—'}</Field>
            {detail.pj_nama && <Field label="PJ UMK">{detail.pj_nama}</Field>}
            {detail.perjab && (
              <Field label="Perjab">
                <Badge tone={detail.perjab === 'Sudah' ? 'success' : 'warning'}>
                  {detail.perjab}
                </Badge>
              </Field>
            )}
            <Field label="No. bukti">{detail.no_bukti ?? '—'}</Field>
            <Field label="Deskripsi" full>
              <span className="whitespace-pre-wrap break-words">{detail.deskripsi ?? '—'}</span>
            </Field>
            <Field label="Ditambahkan oleh">
              {detail.created_by ? (actorName[detail.created_by] ?? 'Tidak diketahui') : 'Sistem'}
            </Field>
            <Field label="Pada">{formatDateTime(detail.created_at)}</Field>
            {detail.updated_at !== detail.created_at && (
              <Field label="Terakhir diubah">{formatDateTime(detail.updated_at)}</Field>
            )}
          </dl>
        )}
      </Modal>
    </>
  )
}

function Field({
  label,
  full = false,
  children,
}: {
  label: string
  full?: boolean
  children: ReactNode
}) {
  return (
    <div className={full ? 'sm:col-span-2' : undefined}>
      <dt className="text-[11px] font-extrabold tracking-wider text-slate-500 uppercase">
        {label}
      </dt>
      <dd className="mt-0.5 text-slate-900">{children}</dd>
    </div>
  )
}
