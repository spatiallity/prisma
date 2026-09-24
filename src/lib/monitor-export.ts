import ExcelJS from 'exceljs'

const HEADER_FILL: ExcelJS.Fill = {
  type: 'pattern',
  pattern: 'solid',
  fgColor: { argb: 'FF13B2AA' },
}

function styleHeader(row: ExcelJS.Row) {
  row.eachCell((cell) => {
    cell.font = { bold: true, color: { argb: 'FFFFFFFF' } }
    cell.fill = HEADER_FILL
    cell.alignment = { vertical: 'middle', wrapText: true }
  })
}

function setDate(cell: ExcelJS.Cell, value: string | null) {
  if (!value) return
  cell.value = new Date(`${value.slice(0, 10)}T00:00:00Z`)
  cell.numFmt = 'dd mmm yyyy'
}

function setMoney(cell: ExcelJS.Cell, value: number | null) {
  if (value === null) return
  cell.value = value
  cell.numFmt = '#,##0'
}

export type FinancialReportExportRow = {
  spkNumber: string
  siteCode: string | null
  status: string
  startDate: string | null
  contractValue: number
  opnameDate: string | null
  opnameValue: number | null
  padDate: string | null
  padValue: number | null
  invoiceNumber: string | null
  invoiceDate: string | null
  invoiceValue: number | null
  dendaValue: number | null
}

/** The all-SPK financial report, intentionally independent of the on-screen
 * tabs and DataTable pagination so an export remains a complete snapshot. */
export function buildFinancialReportWorkbook(rows: FinancialReportExportRow[]) {
  const workbook = new ExcelJS.Workbook()
  workbook.creator = 'PRISMA'
  workbook.created = new Date()

  const sheet = workbook.addWorksheet('Laporan Keuangan SPK')
  const columns = [
    ['No.', 7], ['No. SPK', 24], ['Kode Lokasi', 20], ['Status SPK', 15],
    ['Tanggal Mulai', 15], ['Nilai SPK (Rp)', 18], ['Tanggal Opname', 16],
    ['Nilai Opname (Rp)', 18], ['Tanggal PAD', 15], ['Nilai PAD (Rp)', 17],
    ['No. Invoice', 22], ['Tanggal Invoice', 16], ['Nilai Invoice (Rp)', 19], ['Denda (Rp)', 16],
  ] as const
  sheet.columns = columns.map(([, width]) => ({ width }))
  const header = sheet.getRow(1)
  columns.forEach(([label], index) => { header.getCell(index + 1).value = label })
  styleHeader(header)

  const totals = { contract: 0, opname: 0, pad: 0, invoice: 0, denda: 0 }
  rows.forEach((row, index) => {
    const target = sheet.getRow(index + 2)
    target.getCell(1).value = index + 1
    target.getCell(2).value = row.spkNumber
    target.getCell(3).value = row.siteCode ?? ''
    target.getCell(4).value = row.status
    setDate(target.getCell(5), row.startDate)
    setMoney(target.getCell(6), row.contractValue)
    setDate(target.getCell(7), row.opnameDate)
    setMoney(target.getCell(8), row.opnameValue)
    setDate(target.getCell(9), row.padDate)
    setMoney(target.getCell(10), row.padValue)
    target.getCell(11).value = row.invoiceNumber ?? ''
    setDate(target.getCell(12), row.invoiceDate)
    setMoney(target.getCell(13), row.invoiceValue)
    setMoney(target.getCell(14), row.dendaValue)
    totals.contract += row.contractValue
    totals.opname += row.opnameValue ?? 0
    totals.pad += row.padValue ?? 0
    totals.invoice += row.invoiceValue ?? 0
    totals.denda += row.dendaValue ?? 0
  })

  const total = sheet.getRow(rows.length + 2)
  total.getCell(1).value = 'TOTAL'
  ;[[6, totals.contract], [8, totals.opname], [10, totals.pad], [13, totals.invoice], [14, totals.denda]].forEach(([column, value]) => setMoney(total.getCell(column), value))
  total.eachCell((cell) => {
    cell.font = { bold: true }
    cell.border = { top: { style: 'double' } }
  })
  sheet.views = [{ state: 'frozen', ySplit: 1, xSplit: 2 }]

  return workbook
}

export type RoutingMonitorExportRow = {
  spkNumber: string
  siteCode: string | null
  workName: string
  spkStatus: string
  routingStatus: string
  currentStage: string | null
  currentStageStatus: string | null
  pic: string | null
  startedAt: string | null
  completedAt: string | null
  opnameDate: string | null
  opnameValue: number | null
  padDate: string | null
  padValue: number | null
  updatedAt: string | null
}

export type RoutingHistoryExportRow = {
  spkNumber: string
  siteCode: string | null
  workName: string
  routingStatus: string
  sequence: number
  stage: string
  stageStatus: string
  pic: string | null
  startedAt: string | null
  completedAt: string | null
  note: string | null
}

/** Routing has two sheets: the monitor's latest position and the full step
 * history. That keeps the daily operating view compact without discarding
 * prior revisions from the downloadable record. */
export function buildRoutingMonitorWorkbook(
  rows: RoutingMonitorExportRow[],
  historyRows: RoutingHistoryExportRow[],
) {
  const workbook = new ExcelJS.Workbook()
  workbook.creator = 'PRISMA'
  workbook.created = new Date()

  const monitor = workbook.addWorksheet('Routing Monitor')
  const monitorColumns = [
    ['No.', 7], ['No. SPK', 24], ['Kode Lokasi', 20], ['Pekerjaan', 36], ['Status SPK', 15],
    ['Status Routing', 16], ['Tahap Saat Ini', 26], ['Status Tahap', 16], ['PIC', 22],
    ['Mulai Tahap', 16], ['Selesai Tahap', 16], ['Tanggal Opname', 16], ['Nilai Opname (Rp)', 18],
    ['Tanggal PAD', 15], ['Nilai PAD (Rp)', 17], ['Diperbarui', 16],
  ] as const
  monitor.columns = monitorColumns.map(([, width]) => ({ width }))
  const monitorHeader = monitor.getRow(1)
  monitorColumns.forEach(([label], index) => { monitorHeader.getCell(index + 1).value = label })
  styleHeader(monitorHeader)
  rows.forEach((row, index) => {
    const target = monitor.getRow(index + 2)
    target.getCell(1).value = index + 1
    target.getCell(2).value = row.spkNumber
    target.getCell(3).value = row.siteCode ?? ''
    target.getCell(4).value = row.workName
    target.getCell(5).value = row.spkStatus
    target.getCell(6).value = row.routingStatus
    target.getCell(7).value = row.currentStage ?? ''
    target.getCell(8).value = row.currentStageStatus ?? ''
    target.getCell(9).value = row.pic ?? ''
    setDate(target.getCell(10), row.startedAt)
    setDate(target.getCell(11), row.completedAt)
    setDate(target.getCell(12), row.opnameDate)
    setMoney(target.getCell(13), row.opnameValue)
    setDate(target.getCell(14), row.padDate)
    setMoney(target.getCell(15), row.padValue)
    setDate(target.getCell(16), row.updatedAt)
  })
  monitor.views = [{ state: 'frozen', ySplit: 1, xSplit: 2 }]

  const history = workbook.addWorksheet('Riwayat Tahapan')
  const historyColumns = [
    ['No.', 7], ['No. SPK', 24], ['Kode Lokasi', 20], ['Pekerjaan', 36], ['Status Routing', 16],
    ['Urutan', 10], ['Tahap', 28], ['Status Tahap', 16], ['PIC', 22], ['Tanggal Mulai', 16],
    ['Tanggal Selesai', 16], ['Catatan', 44],
  ] as const
  history.columns = historyColumns.map(([, width]) => ({ width }))
  const historyHeader = history.getRow(1)
  historyColumns.forEach(([label], index) => { historyHeader.getCell(index + 1).value = label })
  styleHeader(historyHeader)
  historyRows.forEach((row, index) => {
    const target = history.getRow(index + 2)
    target.getCell(1).value = index + 1
    target.getCell(2).value = row.spkNumber
    target.getCell(3).value = row.siteCode ?? ''
    target.getCell(4).value = row.workName
    target.getCell(5).value = row.routingStatus
    target.getCell(6).value = row.sequence
    target.getCell(7).value = row.stage
    target.getCell(8).value = row.stageStatus
    target.getCell(9).value = row.pic ?? ''
    setDate(target.getCell(10), row.startedAt)
    setDate(target.getCell(11), row.completedAt)
    target.getCell(12).value = row.note ?? ''
    target.getCell(12).alignment = { vertical: 'top', wrapText: true }
  })
  history.views = [{ state: 'frozen', ySplit: 1, xSplit: 2 }]

  return workbook
}
