'use client'

import { Fragment, useState, useTransition } from 'react'
import { Table, Td, Th, Tr } from '@/components/ui/table'
import { Modal } from '@/components/ui/modal'
import { cn, formatRupiah } from '@/lib/utils'
import { formatMonthLabel } from '@/lib/financial'
import type { FinanceTransactionRow } from '@/lib/supabase/types'
import { FinanceTransactionsTable } from '../finance-transactions-table'
import { getTransactionsByAkun } from './actions'

export type AkunSummaryRow = {
  kode_akun: string
  uraian: string
  kategori_roman_label: string | null
  anggaran_rp: number | null
  realisasi_total: number
  selisih: number | null
}

type AkunOption = { kode_akun: string; uraian: string; kategori_roman_label: string | null }

/**
 * Clicking a row drills into every transaction behind that account, under
 * the same all-time/bulan filter the summary itself is under.
 */
export function AkunSummaryTable({
  groups,
  bulan,
  coa,
  mayEdit,
}: {
  groups: { label: string; rows: AkunSummaryRow[] }[]
  bulan?: string
  coa: AkunOption[]
  mayEdit: boolean
}) {
  const [selected, setSelected] = useState<AkunSummaryRow | null>(null)
  const [rows, setRows] = useState<FinanceTransactionRow[]>([])
  const [isPending, startTransition] = useTransition()

  function openAkun(row: AkunSummaryRow) {
    setSelected(row)
    startTransition(async () => {
      const data = await getTransactionsByAkun(row.kode_akun, bulan)
      setRows(data)
    })
  }

  return (
    <>
      <Table>
        <thead>
          <tr>
            <Th>Kode</Th>
            <Th>Uraian</Th>
            <Th className="text-right">Anggaran</Th>
            <Th className="text-right">Realisasi</Th>
            <Th className="text-right">Selisih</Th>
          </tr>
        </thead>
        <tbody>
          {groups.map(({ label, rows: groupRows }) => (
            <Fragment key={label}>
              <tr className="bg-surface-muted">
                <Td
                  colSpan={5}
                  className="text-xs font-extrabold tracking-wider text-slate-500 uppercase"
                >
                  {label}
                </Td>
              </tr>
              {groupRows.map((row) => {
                const selisih = row.selisih === null ? null : Number(row.selisih)
                return (
                  <Tr
                    key={row.kode_akun}
                    onClick={() => openAkun(row)}
                    className="cursor-pointer"
                  >
                    <Td>
                      <span className="code text-xs">{row.kode_akun}</span>
                    </Td>
                    <Td className="font-semibold text-primary hover:underline">{row.uraian}</Td>
                    <Td className="tnum text-right">{formatRupiah(row.anggaran_rp)}</Td>
                    <Td className="tnum text-right font-bold">
                      {formatRupiah(row.realisasi_total)}
                    </Td>
                    <Td
                      className={cn(
                        'tnum text-right',
                        selisih !== null && selisih < 0 && 'font-bold text-danger',
                      )}
                    >
                      {selisih === null ? '—' : formatRupiah(selisih)}
                    </Td>
                  </Tr>
                )
              })}
            </Fragment>
          ))}
        </tbody>
      </Table>

      <Modal
        open={!!selected}
        onOpenChange={(open) => !open && setSelected(null)}
        size="lg"
        title={selected ? `${selected.kode_akun} — ${selected.uraian}` : ''}
        description={
          bulan
            ? `Seluruh transaksi akun ini pada ${formatMonthLabel(`${bulan}-01`)}.`
            : 'Seluruh transaksi akun ini, akumulasi dari awal project.'
        }
      >
        {isPending ? (
          <p className="py-6 text-center text-sm text-muted-foreground">Memuat…</p>
        ) : (
          <FinanceTransactionsTable
            rows={rows}
            coa={coa}
            mayEdit={mayEdit}
            emptyTitle="Belum ada transaksi"
          />
        )}
      </Modal>
    </>
  )
}
