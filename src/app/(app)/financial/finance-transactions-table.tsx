'use client'

import { useMemo } from 'react'
import { Badge } from '@/components/ui/badge'
import { DeleteButton } from '@/components/ui/delete-button'
import { DataTable, type DataTableColumn } from '@/components/ui/data-table'
import { formatDate, formatRupiah } from '@/lib/utils'
import { FINANCE_CATEGORY_META } from '@/lib/financial'
import type { FinanceTransactionRow } from '@/lib/supabase/types'
import { deleteFinanceTransaction } from './rab/actions'

type AkunOption = { kode_akun: string; uraian: string }

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
}: {
  rows: FinanceTransactionRow[]
  coa: AkunOption[]
  mayEdit: boolean
  showKategori?: boolean
  emptyTitle?: string
  searchPlaceholder?: string
}) {
  const akunByKode = useMemo(() => new Map(coa.map((a) => [a.kode_akun, a])), [coa])
  const showJenis = rows.some((r) => r.jenis_detail)

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
            render: (row: FinanceTransactionRow) => (
              <DeleteButton
                action={deleteFinanceTransaction}
                hiddenFields={{ id: row.id }}
                itemLabel="transaksi ini"
              />
            ),
          } satisfies DataTableColumn<FinanceTransactionRow>,
        ]
      : []),
  ]

  return (
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
    />
  )
}
