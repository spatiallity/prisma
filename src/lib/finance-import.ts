import ExcelJS from 'exceljs'
import { FINANCE_CATEGORY_META, isValidFinanceDate } from '@/lib/financial'
import type { FinanceCategory } from '@/lib/supabase/types'

/** Same three kategori that never let the user pick a kode_akun — mirrors
 *  parseTransactionFields() in financial/rab/actions.ts. */
const FIXED_AKUN: Partial<Record<FinanceCategory, string>> = {
  sppd: '3.1.2',
  mcu: '1.6.1',
}

/** Separates "kode — uraian" in the akun dropdown's list values, so picking
 *  one shows the account name right there instead of needing the Referensi
 *  Akun sheet open in another tab. Never appears inside a real kode_akun or
 *  uraian, so splitting on it is unambiguous. */
const AKUN_LABEL_SEP = ' — '

export type ImportColumnKey =
  | 'tanggal'
  | 'tanggal_perjab'
  | 'kode_akun'
  | 'jenis_detail'
  | 'pj_nama'
  | 'perjab'
  | 'jumlah'
  | 'deskripsi'
  | 'no_bukti'
  | 'personil_nama'

export type ImportColumn = {
  key: ImportColumnKey
  header: string
  required: boolean
  width: number
}

/** One row shape per kategori — the same field groups as the manual form
 *  (needsAkun / isGaji / fixed / PJ UMK), just as spreadsheet columns. */
export function importColumnsFor(kategori: FinanceCategory): ImportColumn[] {
  const needsAkun = FINANCE_CATEGORY_META[kategori].fixedAkun === null && kategori !== 'gaji_ptt'
  const isGaji = kategori === 'gaji_ptt'
  const isUmk = kategori === 'umk'

  const columns: ImportColumn[] = [
    { key: 'tanggal', header: 'Tanggal Pengeluaran', required: true, width: 20 },
  ]
  if (needsAkun) {
    columns.push({ key: 'kode_akun', header: 'Kode Akun', required: true, width: 45 })
  }
  if (isGaji) {
    columns.push({ key: 'jenis_detail', header: 'Jenis (Upah/Tunjangan)', required: true, width: 20 })
  }
  if (isUmk) {
    // Who withdrew the money — different from Nama Personel (who it was
    // spent on/for), see the pj_nama column comment on FinanceTransactionRow.
    columns.push({ key: 'pj_nama', header: 'PJ UMK', required: false, width: 20 })
    columns.push({ key: 'perjab', header: 'Perjab (Belum/Sudah)', required: false, width: 18 })
  }
  columns.push({ key: 'tanggal_perjab', header: 'Tanggal Perjab', required: false, width: 18 })
  columns.push(
    { key: 'jumlah', header: 'Jumlah (Rp)', required: true, width: 16 },
    { key: 'deskripsi', header: 'Deskripsi', required: false, width: 32 },
    { key: 'no_bukti', header: 'No. Bukti', required: false, width: 16 },
    { key: 'personil_nama', header: 'Nama Personel', required: false, width: 20 },
  )
  return columns
}

const HEADER_FILL: ExcelJS.Fill = {
  type: 'pattern',
  pattern: 'solid',
  fgColor: { argb: 'FF13B2AA' },
}

/**
 * Data starts on row 2 of the "Data" sheet — row 1 is always the header,
 * matched by position (not by label text), so parseFinanceWorkbook() never
 * has to guess which column is which.
 */
export function buildFinanceTemplateWorkbook(
  kategori: FinanceCategory,
  akunOptions: { kode_akun: string; uraian: string }[],
  pjOptions: string[] = [],
): ExcelJS.Workbook {
  const meta = FINANCE_CATEGORY_META[kategori]
  const columns = importColumnsFor(kategori)
  const needsAkun = columns.some((c) => c.key === 'kode_akun')
  const isGaji = columns.some((c) => c.key === 'jenis_detail')
  const isUmk = columns.some((c) => c.key === 'pj_nama')

  const wb = new ExcelJS.Workbook()
  wb.creator = 'PRISMA'
  wb.created = new Date()

  const info = wb.addWorksheet('Petunjuk')
  info.columns = [{ width: 90 }]

  const steps = [
    'Isi data pada sheet "Data", mulai baris ke-2 (baris 1 adalah judul kolom, jangan diubah/dihapus).',
    'Satu baris = satu transaksi.',
    'Tanggal Pengeluaran wajib diisi (format tanggal Excel, atau ketik YYYY-MM-DD). Tanggal Perjab opsional.',
    'Jumlah wajib diisi, angka saja tanpa "Rp" atau titik pemisah ribuan.',
    needsAkun
      ? 'Kode Akun wajib diisi — klik cell-nya, muncul panah dropdown berisi kode + nama akun, tinggal pilih (tidak perlu buka sheet lain).'
      : isGaji
        ? 'Jenis wajib diisi: "Upah" atau "Tunjangan" — pilih dari dropdown.'
        : `Kode akun untuk ${meta.label} otomatis (${meta.fixedAkun}) — tidak perlu diisi di sini.`,
    isUmk
      ? 'PJ UMK boleh dikosongkan — orang yang mengambil dana dari kas korporat (beda dari Nama Personel, yaitu yang dananya dipakai/dituju).'
      : 'Deskripsi, No. Bukti, dan Nama Personel boleh dikosongkan.',
    ...(isUmk
      ? ['Perjab boleh dikosongkan (default "Belum") — sudah/belum dipertanggungjawabkan.']
      : []),
    'Simpan file, lalu upload lewat tombol "Upload Excel" di halaman ini.',
    'Baris yang kosong semua akan dilewati. Kalau ada baris yang salah, seluruh file akan ditolak — perbaiki dulu baru upload ulang.',
  ]
  const lines = [
    `Template import — ${meta.label}`,
    '',
    'Cara pakai:',
    ...steps.map((step, i) => `${i + 1}. ${step}`),
  ]
  lines.forEach((line, i) => {
    const cell = info.getCell(i + 1, 1)
    cell.value = line
    if (i === 0) cell.font = { bold: true, size: 14 }
    cell.alignment = { wrapText: true, vertical: 'top' }
  })

  const sheet = wb.addWorksheet('Data')
  sheet.columns = columns.map((c) => ({ width: c.width }))
  const headerRow = sheet.getRow(1)
  columns.forEach((c, i) => {
    const cell = headerRow.getCell(i + 1)
    cell.value = c.header + (c.required ? ' *' : '')
    cell.font = { bold: true, color: { argb: 'FFFFFFFF' } }
    cell.fill = HEADER_FILL
  })
  headerRow.commit()

  // 200 blank rows pre-formatted so pasted/typed data keeps the right types.
  const tanggalCol = columns.findIndex((c) => c.key === 'tanggal') + 1
  const tanggalPerjabCol = columns.findIndex((c) => c.key === 'tanggal_perjab') + 1
  const jumlahCol = columns.findIndex((c) => c.key === 'jumlah') + 1
  const jenisCol = columns.findIndex((c) => c.key === 'jenis_detail') + 1
  const akunCol = columns.findIndex((c) => c.key === 'kode_akun') + 1
  const pjCol = columns.findIndex((c) => c.key === 'pj_nama') + 1
  const perjabCol = columns.findIndex((c) => c.key === 'perjab') + 1
  for (let r = 2; r <= 201; r++) {
    if (tanggalCol) sheet.getCell(r, tanggalCol).numFmt = 'yyyy-mm-dd'
    if (tanggalPerjabCol) sheet.getCell(r, tanggalPerjabCol).numFmt = 'yyyy-mm-dd'
    if (jumlahCol) sheet.getCell(r, jumlahCol).numFmt = '#,##0'
    if (jenisCol) {
      sheet.getCell(r, jenisCol).dataValidation = {
        type: 'list',
        allowBlank: true,
        formulae: ['"Upah,Tunjangan"'],
      }
    }
    if (akunCol && akunOptions.length > 0) {
      // Column C of Referensi Akun is the "kode — uraian" label the dropdown
      // shows; parseFinanceWorkbook splits it back into a bare code.
      sheet.getCell(r, akunCol).dataValidation = {
        type: 'list',
        allowBlank: true,
        formulae: [`'Referensi Akun'!$C$2:$C$${akunOptions.length + 1}`],
      }
    }
    if (pjCol && pjOptions.length > 0) {
      sheet.getCell(r, pjCol).dataValidation = {
        type: 'list',
        allowBlank: true,
        formulae: [`'Referensi PJ'!$A$2:$A$${pjOptions.length + 1}`],
      }
    }
    if (perjabCol) {
      sheet.getCell(r, perjabCol).dataValidation = {
        type: 'list',
        allowBlank: true,
        formulae: ['"Belum,Sudah"'],
      }
    }
  }

  if (needsAkun) {
    const ref = wb.addWorksheet('Referensi Akun')
    ref.columns = [{ width: 14 }, { width: 50 }, { width: 60 }]
    ref.getRow(1).values = ['Kode Akun', 'Uraian', 'Pilihan Dropdown']
    ref.getRow(1).font = { bold: true }
    akunOptions.forEach((a, i) => {
      ref.getRow(i + 2).values = [a.kode_akun, a.uraian, `${a.kode_akun}${AKUN_LABEL_SEP}${a.uraian}`]
    })
    // Column C only exists to feed the Data sheet's dropdown — A and B are
    // the actual human-readable reference.
    ref.getColumn(3).hidden = true
  }

  if (pjCol && pjOptions.length > 0) {
    const ref = wb.addWorksheet('Referensi PJ')
    ref.columns = [{ width: 30 }]
    ref.getRow(1).values = ['PJ UMK yang sudah pernah dipakai']
    ref.getRow(1).font = { bold: true }
    pjOptions.forEach((name, i) => {
      ref.getRow(i + 2).values = [name]
    })
  }

  return wb
}

/** Kept out of the 'use server' actions file on purpose — importing exceljs
 *  there directly breaks Turbopack's RSC boundary (see AGENTS.md's note on
 *  heavy imports crossing into 'use server' files; same class of bug). */
export async function loadFinanceWorkbook(buffer: ArrayBuffer): Promise<ExcelJS.Workbook | null> {
  try {
    const workbook = new ExcelJS.Workbook()
    await workbook.xlsx.load(buffer)
    return workbook
  } catch {
    return null
  }
}

export type ParsedFinanceRow = {
  tanggal: string
  tanggalPerjab: string | null
  jumlah: number
  kodeAkun: string
  jenisDetail: 'Upah' | 'Tunjangan' | null
  pjNama: string | null
  perjab: 'Belum' | 'Sudah' | null
  deskripsi: string | null
  noBukti: string | null
  personilNama: string | null
}

/**
 * A manually-typed cell isn't always the plain string/number/Date it looks
 * like — a formula cell's value is `{formula, result}`, and some producers
 * write rich text as `{richText: [...]}` even for a single unstyled run.
 * Every other cellTo*() function reads through this first so a value typed
 * directly (not picked from a dropdown) is exactly as valid as one that was.
 */
function unwrapCellValue(value: ExcelJS.CellValue): ExcelJS.CellValue {
  if (value === null || typeof value !== 'object') return value
  if (value instanceof Date) return value
  if ('result' in value) return unwrapCellValue(value.result as ExcelJS.CellValue)
  if ('text' in value) return value.text as ExcelJS.CellValue
  if ('richText' in value && Array.isArray(value.richText)) {
    return value.richText.map((run) => run.text).join('')
  }
  return value
}

function cellToDateString(rawValue: ExcelJS.CellValue): string | null {
  const value = unwrapCellValue(rawValue)
  if (value instanceof Date) {
    // exceljs builds date cells from the Excel serial using UTC math, so the
    // UTC components are what the cell visually shows — not the local ones.
    const y = value.getUTCFullYear()
    const m = String(value.getUTCMonth() + 1).padStart(2, '0')
    const d = String(value.getUTCDate()).padStart(2, '0')
    return `${y}-${m}-${d}`
  }
  if (typeof value === 'string') {
    const trimmed = value.trim()
    if (/^\d{4}-\d{2}-\d{2}$/.test(trimmed)) return trimmed
    // dd/mm/yyyy — the other format someone might type by hand.
    const m = trimmed.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/)
    if (m) return `${m[3]}-${m[2].padStart(2, '0')}-${m[1].padStart(2, '0')}`
  }
  return null
}

function cellToText(rawValue: ExcelJS.CellValue): string | null {
  const value = unwrapCellValue(rawValue)
  if (value === null || value === undefined) return null
  const text = String(value).trim()
  return text || null
}

function cellToNumber(rawValue: ExcelJS.CellValue): number | null {
  const value = unwrapCellValue(rawValue)
  if (typeof value === 'number') return value
  if (typeof value === 'string') {
    const parsed = Number(value.trim().replace(/\./g, '').replace(',', '.'))
    return Number.isFinite(parsed) ? parsed : null
  }
  return null
}

/** The akun dropdown's picked value is "kode — uraian"; a bare code typed by
 *  hand still works since there's nothing to split off. */
function extractAkunCode(raw: string): string {
  const idx = raw.indexOf(AKUN_LABEL_SEP)
  return idx === -1 ? raw.trim() : raw.slice(0, idx).trim()
}

/**
 * Reads the "Data" sheet, row 2 onward, into validated rows — all-or-nothing:
 * any row error means nothing gets imported, so the admin fixes the file
 * once instead of hunting for which half silently didn't make it in.
 */
export function parseFinanceWorkbook(
  workbook: ExcelJS.Workbook,
  kategori: FinanceCategory,
  validAkunCodes: Set<string>,
): { rows: ParsedFinanceRow[]; errors: string[] } {
  const currentColumns = importColumnsFor(kategori)
  const sheet = workbook.getWorksheet('Data')
  if (!sheet) return { rows: [], errors: ['Sheet "Data" tidak ditemukan di file ini.'] }

  // Existing downloaded templates lack Tanggal Perjab. Keep their positional
  // mapping so importing a saved workbook never shifts amount/description.
  const hasTanggalPerjab = Array.from({ length: sheet.getRow(1).cellCount }, (_, i) =>
    String(sheet.getRow(1).getCell(i + 1).value ?? '').trim().replace(/ \*$/, ''),
  ).includes('Tanggal Perjab')
  const columns = hasTanggalPerjab
    ? currentColumns
    : currentColumns.filter((column) => column.key !== 'tanggal_perjab')
  const colIndex = Object.fromEntries(columns.map((c, i) => [c.key, i + 1])) as Record<
    ImportColumnKey,
    number
  >
  const fixedAkun = FIXED_AKUN[kategori] ?? null

  const rows: ParsedFinanceRow[] = []
  const errors: string[] = []
  // actualRowCount is a COUNT of non-empty rows, not the last row index — a
  // blank row followed by a filled one (e.g. a spacer the admin added) would
  // silently truncate the scan. rowCount is the real last-touched-row index.
  const maxRow = sheet.rowCount

  for (let r = 2; r <= maxRow; r++) {
    const row = sheet.getRow(r)
    const isBlank = columns.every((c) => {
      const v = row.getCell(colIndex[c.key]).value
      return v === null || v === undefined || v === ''
    })
    if (isBlank) continue

    const tanggal = cellToDateString(row.getCell(colIndex.tanggal).value)
    if (!tanggal || !isValidFinanceDate(tanggal)) {
      errors.push(`Baris ${r}: Tanggal Pengeluaran tidak valid. Gunakan tahun 2000 sampai tahun depan.`)
      continue
    }
    const perjabDateCell = colIndex.tanggal_perjab
      ? row.getCell(colIndex.tanggal_perjab).value
      : null
    const tanggalPerjab = perjabDateCell ? cellToDateString(perjabDateCell) : null
    if (perjabDateCell && (!tanggalPerjab || !isValidFinanceDate(tanggalPerjab))) {
      errors.push(`Baris ${r}: Tanggal Perjab tidak valid. Gunakan tahun 2000 sampai tahun depan.`)
      continue
    }
    if (tanggalPerjab && tanggalPerjab < tanggal) {
      errors.push(`Baris ${r}: Tanggal Perjab sebelum Tanggal Pengeluaran.`)
      continue
    }

    const jumlah = cellToNumber(row.getCell(colIndex.jumlah).value)
    if (jumlah === null || jumlah <= 0) {
      errors.push(`Baris ${r}: Jumlah harus angka lebih dari nol.`)
      continue
    }

    let kodeAkun = fixedAkun
    let jenisDetail: 'Upah' | 'Tunjangan' | null = null

    if (colIndex.jenis_detail) {
      const raw = cellToText(row.getCell(colIndex.jenis_detail).value)
      if (raw !== 'Upah' && raw !== 'Tunjangan') {
        errors.push(`Baris ${r}: Jenis harus "Upah" atau "Tunjangan".`)
        continue
      }
      jenisDetail = raw
      kodeAkun = raw === 'Upah' ? '1.7.1' : '1.7.3'
    } else if (colIndex.kode_akun) {
      const rawText = cellToText(row.getCell(colIndex.kode_akun).value)
      const raw = rawText ? extractAkunCode(rawText) : null
      if (!raw || !validAkunCodes.has(raw)) {
        errors.push(`Baris ${r}: Kode Akun "${rawText ?? ''}" tidak dikenali.`)
        continue
      }
      kodeAkun = raw
    }

    if (!kodeAkun) {
      errors.push(`Baris ${r}: Kode akun tidak dapat ditentukan.`)
      continue
    }

    let perjab: 'Belum' | 'Sudah' | null = null
    if (colIndex.perjab) {
      const raw = cellToText(row.getCell(colIndex.perjab).value)
      if (raw !== null && raw !== 'Belum' && raw !== 'Sudah') {
        errors.push(`Baris ${r}: Perjab harus "Belum" atau "Sudah" (atau dikosongkan).`)
        continue
      }
      perjab = raw ?? 'Belum'
    }

    rows.push({
      tanggal,
      tanggalPerjab,
      jumlah,
      kodeAkun,
      jenisDetail,
      pjNama: colIndex.pj_nama ? cellToText(row.getCell(colIndex.pj_nama).value) : null,
      perjab,
      deskripsi: colIndex.deskripsi ? cellToText(row.getCell(colIndex.deskripsi).value) : null,
      noBukti: colIndex.no_bukti ? cellToText(row.getCell(colIndex.no_bukti).value) : null,
      personilNama: colIndex.personil_nama
        ? cellToText(row.getCell(colIndex.personil_nama).value)
        : null,
    })
  }

  return { rows, errors }
}
