import ExcelJS from 'exceljs'
import { FINANCE_CATEGORY_META, formatMonthLabel } from '@/lib/financial'
import type { FinanceCategory, FinanceTransactionRow } from '@/lib/supabase/types'

const HEADER_FILL: ExcelJS.Fill = {
  type: 'pattern',
  pattern: 'solid',
  fgColor: { argb: 'FF13B2AA' },
}

function styleHeaderRow(row: ExcelJS.Row) {
  row.eachCell((cell) => {
    cell.font = { bold: true, color: { argb: 'FFFFFFFF' } }
    cell.fill = HEADER_FILL
  })
  row.commit()
}

/**
 * One kategori's current transaction list, as a report — not to be confused
 * with the blank fillable template from finance-import.ts. Read-only: no
 * data validation, no instructions sheet, just the data as it stands.
 */
export function buildTransactionsExportWorkbook(
  kategori: FinanceCategory,
  rows: FinanceTransactionRow[],
  akunUraian: Map<string, string>,
  actorName: Map<string, string>,
): ExcelJS.Workbook {
  const meta = FINANCE_CATEGORY_META[kategori]
  const isUmk = kategori === 'umk'
  const isGaji = kategori === 'gaji_ptt'

  const wb = new ExcelJS.Workbook()
  wb.creator = 'PRISMA'
  wb.created = new Date()

  const sheet = wb.addWorksheet('Data')
  const headers = [
    { header: 'Tanggal', width: 14 },
    { header: 'Kode Akun', width: 12 },
    { header: 'Uraian', width: 32 },
    ...(isGaji ? [{ header: 'Jenis', width: 14 }] : []),
    ...(isUmk ? [{ header: 'PJ UMK', width: 20 }, { header: 'Perjab', width: 10 }] : []),
    { header: 'Jumlah (Rp)', width: 16 },
    { header: 'Deskripsi', width: 32 },
    { header: 'No. Bukti', width: 18 },
    { header: 'Nama Personel', width: 20 },
    { header: 'Dicatat Oleh', width: 20 },
    { header: 'Dibuat Pada', width: 18 },
  ]
  sheet.columns = headers.map((h) => ({ width: h.width }))
  const headerRow = sheet.getRow(1)
  headers.forEach((h, i) => {
    headerRow.getCell(i + 1).value = h.header
  })
  styleHeaderRow(headerRow)

  let total = 0
  rows.forEach((row, i) => {
    const r = sheet.getRow(i + 2)
    let col = 1
    const tanggalCell = r.getCell(col++)
    tanggalCell.value = row.tanggal ? new Date(`${row.tanggal}T00:00:00Z`) : null
    tanggalCell.numFmt = 'yyyy-mm-dd'
    r.getCell(col++).value = row.kode_akun
    r.getCell(col++).value = akunUraian.get(row.kode_akun) ?? ''
    if (isGaji) r.getCell(col++).value = row.jenis_detail ?? ''
    if (isUmk) {
      r.getCell(col++).value = row.pj_nama ?? ''
      r.getCell(col++).value = row.perjab ?? ''
    }
    const jumlahCell = r.getCell(col++)
    jumlahCell.value = Number(row.jumlah)
    jumlahCell.numFmt = '#,##0'
    total += Number(row.jumlah)
    r.getCell(col++).value = row.deskripsi ?? ''
    r.getCell(col++).value = row.no_bukti ?? ''
    r.getCell(col++).value = row.personil_nama ?? ''
    r.getCell(col++).value = row.created_by ? (actorName.get(row.created_by) ?? '') : ''
    const createdCell = r.getCell(col++)
    createdCell.value = new Date(row.created_at)
    createdCell.numFmt = 'yyyy-mm-dd hh:mm'
  })

  const totalRowIndex = rows.length + 2
  const totalRow = sheet.getRow(totalRowIndex)
  const jumlahColIndex = headers.findIndex((h) => h.header === 'Jumlah (Rp)') + 1
  totalRow.getCell(1).value = `Total ${meta.label} (${rows.length} transaksi)`
  const totalCell = totalRow.getCell(jumlahColIndex)
  totalCell.value = total
  totalCell.numFmt = '#,##0'
  totalRow.eachCell((cell) => {
    cell.font = { bold: true }
    cell.border = { top: { style: 'thin' } }
  })

  return wb
}

export type AkunSummaryForExport = {
  kode_akun: string
  uraian: string
  kategori_roman_label: string | null
  anggaran_rp: number | null
  realisasi_total: number
}

/**
 * The monthly absorption report: one row per Chart of Accounts leaf, one
 * column per month that has any realisasi, plus a running total and selisih
 * — the same shape as the Monitoring RAB page's own table, just every month
 * side by side instead of one filterable month at a time.
 */
export function buildRabSerapanWorkbook(
  akunSummary: AkunSummaryForExport[],
  monthlyByAkun: Map<string, Map<string, number>>,
  months: string[],
): ExcelJS.Workbook {
  const wb = new ExcelJS.Workbook()
  wb.creator = 'PRISMA'
  wb.created = new Date()

  const sheet = wb.addWorksheet('Serapan RAB')
  const headers = [
    { header: 'Kode Akun', width: 12 },
    { header: 'Uraian', width: 34 },
    { header: 'Kategori', width: 22 },
    { header: 'Anggaran (Rp)', width: 16 },
    ...months.map((m) => ({ header: formatMonthLabel(m), width: 14 })),
    { header: 'Realisasi Total (Rp)', width: 18 },
    { header: 'Selisih (Rp)', width: 16 },
    { header: '% Terpakai', width: 12 },
  ]
  sheet.columns = headers.map((h) => ({ width: h.width }))
  const headerRow = sheet.getRow(1)
  headers.forEach((h, i) => {
    headerRow.getCell(i + 1).value = h.header
  })
  styleHeaderRow(headerRow)

  const sorted = [...akunSummary].sort((a, b) => a.kode_akun.localeCompare(b.kode_akun))

  const monthTotals = new Array(months.length).fill(0)
  let grandAnggaran = 0
  let grandRealisasi = 0

  sorted.forEach((akun, i) => {
    const r = sheet.getRow(i + 2)
    let col = 1
    r.getCell(col++).value = akun.kode_akun
    r.getCell(col++).value = akun.uraian
    r.getCell(col++).value = akun.kategori_roman_label ?? ''
    const anggaran = Number(akun.anggaran_rp ?? 0)
    const anggaranCell = r.getCell(col++)
    anggaranCell.value = anggaran
    anggaranCell.numFmt = '#,##0'
    grandAnggaran += anggaran

    const perMonth = monthlyByAkun.get(akun.kode_akun)
    months.forEach((m, mi) => {
      const value = perMonth?.get(m) ?? 0
      const cell = r.getCell(col++)
      cell.value = value
      cell.numFmt = '#,##0'
      monthTotals[mi] += value
    })

    const realisasiTotal = Number(akun.realisasi_total)
    const realisasiCell = r.getCell(col++)
    realisasiCell.value = realisasiTotal
    realisasiCell.numFmt = '#,##0'
    grandRealisasi += realisasiTotal

    const selisihCell = r.getCell(col++)
    selisihCell.value = anggaran - realisasiTotal
    selisihCell.numFmt = '#,##0'

    const pctCell = r.getCell(col++)
    pctCell.value = anggaran > 0 ? realisasiTotal / anggaran : 0
    pctCell.numFmt = '0.0%'
  })

  const totalRowIndex = sorted.length + 2
  const totalRow = sheet.getRow(totalRowIndex)
  let col = 1
  // Not merged: a merged non-master cell hijacks .value writes meant for the
  // cells after it, which silently shifted every total in this row by one
  // column the first time this was written. Leaving Uraian/Kategori blank
  // instead keeps every column's value exactly where its header says it is.
  totalRow.getCell(col++).value = 'TOTAL KESELURUHAN'
  col += 2 // skip Uraian, Kategori
  const anggaranTotalCell = totalRow.getCell(col++)
  anggaranTotalCell.value = grandAnggaran
  anggaranTotalCell.numFmt = '#,##0'
  months.forEach((_m, mi) => {
    const cell = totalRow.getCell(col++)
    cell.value = monthTotals[mi]
    cell.numFmt = '#,##0'
  })
  const realisasiTotalCell = totalRow.getCell(col++)
  realisasiTotalCell.value = grandRealisasi
  realisasiTotalCell.numFmt = '#,##0'
  const selisihTotalCell = totalRow.getCell(col++)
  selisihTotalCell.value = grandAnggaran - grandRealisasi
  selisihTotalCell.numFmt = '#,##0'
  const pctTotalCell = totalRow.getCell(col++)
  pctTotalCell.value = grandAnggaran > 0 ? grandRealisasi / grandAnggaran : 0
  pctTotalCell.numFmt = '0.0%'

  totalRow.eachCell((cell) => {
    cell.font = { bold: true }
    cell.border = { top: { style: 'double' } }
  })
  sheet.views = [{ state: 'frozen', ySplit: 1, xSplit: 3 }]

  return wb
}
