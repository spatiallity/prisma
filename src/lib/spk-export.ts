import ExcelJS from 'exceljs'
import type { SpkRow } from '@/lib/supabase/types'

type InvoiceExportRow = {
  spk_id: string
  invoice_date: string | null
  invoice_value: number
}

const HEADER_FILL: ExcelJS.Fill = {
  type: 'pattern',
  pattern: 'solid',
  fgColor: { argb: 'FF13B2AA' },
}

function asExcelDate(value: string | null) {
  return value ? new Date(`${value.slice(0, 10)}T00:00:00Z`) : null
}

/** A compact financial recap: one row per SPK, with every recorded invoice
 * rolled up so the exported value remains meaningful even after re-invoicing. */
export function buildSpkExportWorkbook(spks: SpkRow[], invoices: InvoiceExportRow[]) {
  const invoiceBySpk = new Map<string, { total: number; latestDate: string | null }>()
  for (const invoice of invoices) {
    const current = invoiceBySpk.get(invoice.spk_id) ?? { total: 0, latestDate: null }
    current.total += Number(invoice.invoice_value ?? 0)
    if ((invoice.invoice_date ?? '') > (current.latestDate ?? '')) {
      current.latestDate = invoice.invoice_date
    }
    invoiceBySpk.set(invoice.spk_id, current)
  }

  const workbook = new ExcelJS.Workbook()
  workbook.creator = 'PRISMA'
  workbook.created = new Date()

  const sheet = workbook.addWorksheet('Data SPK')
  const headers = [
    { header: 'No.', width: 7 },
    { header: 'Kode SPK', width: 18 },
    { header: 'Nomor SPK', width: 26 },
    { header: 'Nama Pekerjaan', width: 42 },
    { header: 'Nilai SPK (Rp)', width: 18 },
    { header: 'Tanggal Opname', width: 16 },
    { header: 'Nilai Opname (Rp)', width: 20 },
    { header: 'Tanggal PAD', width: 16 },
    { header: 'Nilai PAD (Rp)', width: 18 },
    { header: 'Tanggal Invoice', width: 17 },
    { header: 'Nilai Invoice (Rp)', width: 20 },
  ]
  sheet.columns = headers.map((header) => ({ width: header.width }))
  const headerRow = sheet.getRow(1)
  headers.forEach((header, index) => {
    const cell = headerRow.getCell(index + 1)
    cell.value = header.header
    cell.font = { bold: true, color: { argb: 'FFFFFFFF' } }
    cell.fill = HEADER_FILL
    cell.alignment = { vertical: 'middle' }
  })
  headerRow.height = 24

  spks.forEach((spk, index) => {
    const invoice = invoiceBySpk.get(spk.id)
    const row = sheet.getRow(index + 2)
    row.values = [
      index + 1,
      spk.site_code ?? '',
      spk.spk_number,
      spk.work_name,
      Number(spk.contract_value ?? 0),
      asExcelDate(spk.opname_marked_at),
      spk.opname_value === null ? null : Number(spk.opname_value),
      asExcelDate(spk.pad_marked_at),
      spk.pad_value === null ? null : Number(spk.pad_value),
      asExcelDate(invoice?.latestDate ?? null),
      invoice ? invoice.total : null,
    ]
    ;[5, 7, 9, 11].forEach((column) => {
      row.getCell(column).numFmt = '#,##0'
    })
    ;[6, 8, 10].forEach((column) => {
      row.getCell(column).numFmt = 'yyyy-mm-dd'
    })
  })

  sheet.views = [{ state: 'frozen', ySplit: 1, xSplit: 4 }]
  sheet.autoFilter = `A1:K${Math.max(1, spks.length + 1)}`
  return workbook
}
