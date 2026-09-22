'use client'

import { useMemo, useState, type ReactNode } from 'react'
import { ArrowDown, ArrowLeft, ArrowRight, ArrowUp, ArrowUpDown, Funnel, Search, X } from 'lucide-react'
import { cn } from '@/lib/utils'
import { Table, Td, Th, Tr } from './table'
import { Input } from './field'
import { EmptyState } from './page-header'

export type DataTableColumn<T> = {
  key: string
  label: string
  align?: 'left' | 'right' | 'center'
  className?: string
  /** Omit to make the column unsortable (e.g. an actions column). */
  sortAccessor?: (row: T) => string | number | null
  /** Value used by the spreadsheet-style multi-select filter. Defaults to the sort value. */
  filterAccessor?: (row: T) => string | number | null
  render: (row: T) => ReactNode
  /** Cell has its own clickable controls (e.g. Edit/Hapus) — don't let clicks in it trigger onRowClick. */
  stopRowClick?: boolean
  /** When set, this column gets a footer cell showing the result — typically
   *  a sum over `rows` (the filtered, sorted, un-paginated set, so the total
   *  matches what a search/filter narrows to, not just the current page).
   *  Omit for columns with no meaningful total (e.g. a name or status). */
  renderTotal?: (rows: T[]) => ReactNode
}

/**
 * Client-side sort + free-text filter over an already-fetched row set —
 * every list table in the app renders through this so both behaviors only
 * need to exist once. `searchAccessor` builds the haystack the search box
 * matches against; sorting is per-column via `sortAccessor`.
 *
 * Rows are paged rather than all rendered at once. Search and sort still run
 * across the whole set, but a category with 600-odd transactions used to
 * serialise and hydrate every one of them on each navigation — that page
 * alone shipped 1.8MB, which is what made some menus feel heavier than
 * others.
 */
export function DataTable<T>({
  columns,
  rows,
  rowKey,
  searchAccessor,
  searchPlaceholder = 'Cari…',
  emptyTitle = 'Belum ada data',
  emptyDescription,
  defaultSort,
  onRowClick,
  selectedKeys,
  onSelectionChange,
  selectionSummary,
  pageSize = 25,
  showRowNumber = true,
}: {
  columns: DataTableColumn<T>[]
  rows: T[]
  rowKey: (row: T) => string
  /** Omit to hide the search box entirely. */
  searchAccessor?: (row: T) => string
  searchPlaceholder?: string
  emptyTitle?: string
  emptyDescription?: string
  defaultSort?: { key: string; dir: 'asc' | 'desc' }
  /** Row opens a detail view on click — e.g. a truncated cell's full content. */
  onRowClick?: (row: T) => void
  /** Present → a checkbox column is rendered and rows can be multi-selected
   *  for a bulk action (e.g. delete). Selection is keyed by rowKey(row). */
  selectedKeys?: Set<string>
  onSelectionChange?: (keys: Set<string>) => void
  /** Optional selection feedback displayed immediately above the table headers. */
  selectionSummary?: ReactNode
  /** Rows per page. Pass Infinity for a short list that never needs paging. */
  pageSize?: number
  /** A leading, unsortable "No" column numbering the visible rows in view
   *  order (accounting for the current page) — on by default everywhere. */
  showRowNumber?: boolean
}) {
  const [query, setQuery] = useState('')
  const [page, setPage] = useState(0)
  const [sort, setSort] = useState<{ key: string; dir: 'asc' | 'desc' } | null>(
    defaultSort ?? null,
  )
  const [filters, setFilters] = useState<Record<string, string[]>>({})
  const [openFilter, setOpenFilter] = useState<string | null>(null)
  const [filterQuery, setFilterQuery] = useState('')

  const filterableColumns = useMemo(
    () => columns.filter((column) => column.filterAccessor ?? column.sortAccessor),
    [columns],
  )
  const filterOptions = useMemo(
    () =>
      Object.fromEntries(
        filterableColumns.map((column) => {
          const accessor = column.filterAccessor ?? column.sortAccessor!
          const values = [...new Set(rows.map((row) => String(accessor(row) ?? '')))].sort((a, b) =>
            a.localeCompare(b, 'id', { numeric: true }),
          )
          return [column.key, values]
        }),
      ) as Record<string, string[]>,
    [filterableColumns, rows],
  )

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase()
    return rows.filter((row) => {
      if (searchAccessor && q && !searchAccessor(row).toLowerCase().includes(q)) return false
      return filterableColumns.every((column) => {
        const selected = filters[column.key]
        if (!selected?.length) return true
        const accessor = column.filterAccessor ?? column.sortAccessor!
        return selected.includes(String(accessor(row) ?? ''))
      })
    })
  }, [rows, query, searchAccessor, filterableColumns, filters])

  const sorted = useMemo(() => {
    if (!sort) return filtered
    const col = columns.find((c) => c.key === sort.key)
    if (!col?.sortAccessor) return filtered
    const dir = sort.dir === 'asc' ? 1 : -1
    return [...filtered].sort((a, b) => {
      const av = col.sortAccessor!(a)
      const bv = col.sortAccessor!(b)
      if (av === null && bv === null) return 0
      if (av === null) return 1
      if (bv === null) return -1
      if (typeof av === 'number' && typeof bv === 'number') return (av - bv) * dir
      return String(av).localeCompare(String(bv), 'id') * dir
    })
  }, [filtered, sort, columns])

  const pageCount = Math.max(1, Math.ceil(sorted.length / pageSize))
  const safePage = Math.min(page, pageCount - 1)
  const visible = useMemo(
    () =>
      pageSize === Infinity
        ? sorted
        : sorted.slice(safePage * pageSize, safePage * pageSize + pageSize),
    [sorted, safePage, pageSize],
  )

  function toggleSort(key: string) {
    setPage(0)
    setSort((current) => {
      if (current?.key !== key) return { key, dir: 'asc' }
      if (current.dir === 'asc') return { key, dir: 'desc' }
      return null
    })
  }

  function toggleFilter(columnKey: string, value: string) {
    setPage(0)
    setFilters((current) => {
      const selected = new Set(current[columnKey] ?? [])
      if (selected.has(value)) selected.delete(value)
      else selected.add(value)
      const next = { ...current }
      if (selected.size) next[columnKey] = [...selected]
      else delete next[columnKey]
      return next
    })
  }

  const activeFilterCount = Object.values(filters).reduce((count, values) => count + values.length, 0)
  const activeFilters = filterableColumns.flatMap((column) =>
    (filters[column.key] ?? []).map((value) => ({ column, value })),
  )

  function toggleFilterMenu(columnKey: string) {
    setFilterQuery('')
    setOpenFilter((current) => current === columnKey ? null : columnKey)
  }

  function selectAllFilterOptions(columnKey: string) {
    setPage(0)
    setFilters((current) => ({ ...current, [columnKey]: filterOptions[columnKey] ?? [] }))
  }

  function clearColumnFilter(columnKey: string) {
    setPage(0)
    setFilters((current) => {
      const next = { ...current }
      delete next[columnKey]
      return next
    })
  }

  const hasTotals = columns.some((col) => col.renderTotal)
  const selectable = !!onSelectionChange
  const allVisibleChecked =
    selectable && visible.length > 0 && visible.every((row) => selectedKeys?.has(rowKey(row)))
  const someVisibleChecked =
    selectable && !allVisibleChecked && visible.some((row) => selectedKeys?.has(rowKey(row)))

  function toggleAllVisible() {
    if (!onSelectionChange) return
    const next = new Set(selectedKeys)
    if (allVisibleChecked) {
      visible.forEach((row) => next.delete(rowKey(row)))
    } else {
      visible.forEach((row) => next.add(rowKey(row)))
    }
    onSelectionChange(next)
  }

  function toggleOne(key: string) {
    if (!onSelectionChange) return
    const next = new Set(selectedKeys)
    if (next.has(key)) next.delete(key)
    else next.add(key)
    onSelectionChange(next)
  }

  return (
    <div>
      {searchAccessor && (
        <div className="border-b border-slate-100 p-3">
          <div className="relative w-full max-w-xs">
            <Search
              size={15}
              className="pointer-events-none absolute top-1/2 left-3 -translate-y-1/2 text-slate-400"
              aria-hidden
            />
            <Input
              value={query}
              onChange={(event) => {
                setPage(0)
                setQuery(event.target.value)
              }}
              placeholder={searchPlaceholder}
              className="pl-9"
              aria-label={searchPlaceholder}
            />
          </div>
        </div>
      )}

      {activeFilterCount > 0 && (
        <div className="flex flex-wrap items-center gap-2 border-b border-slate-100 bg-slate-50 px-3 py-2">
          <span className="text-xs font-bold text-muted-foreground">Filter aktif:</span>
          {activeFilters.map(({ column, value }) => (
            <button key={`${column.key}-${value}`} type="button" onClick={() => toggleFilter(column.key, value)} className="inline-flex items-center gap-1 rounded-full border border-primary/20 bg-primary-soft px-2 py-1 text-xs font-bold text-primary hover:bg-primary/15">
              {column.label}: {value || '(Kosong)'} <X size={12} aria-hidden />
            </button>
          ))}
          <button type="button" onClick={() => { setFilters({}); setPage(0) }} className="ml-auto text-xs font-extrabold text-slate-600 hover:text-danger hover:underline">
            Hapus semua
          </button>
        </div>
      )}

      {selectionSummary}

      {sorted.length > 0 ? (
        <Table>
          <thead>
            <tr>
              {showRowNumber && <Th className="w-10 tnum">No</Th>}
              {selectable && (
                <Th className="w-8">
                  <input
                    type="checkbox"
                    className="size-4 rounded border-slate-300 accent-primary"
                    checked={allVisibleChecked}
                    ref={(el) => {
                      if (el) el.indeterminate = someVisibleChecked
                    }}
                    onChange={toggleAllVisible}
                    aria-label="Pilih semua baris"
                  />
                </Th>
              )}
              {columns.map((col) => (
                <Th
                  key={col.key}
                  className={cn(
                    'relative',
                    col.align === 'right' && 'text-right',
                    col.align === 'center' && 'text-center',
                    col.sortAccessor && 'cursor-pointer select-none hover:text-slate-700',
                    col.className,
                  )}
                  onClick={col.sortAccessor ? () => toggleSort(col.key) : undefined}
                >
                  <span
                    className={cn(
                      'inline-flex items-center gap-1',
                      col.align === 'right' && 'flex-row-reverse',
                      col.align === 'center' && 'justify-center',
                    )}
                  >
                    {col.label}
                    {col.sortAccessor &&
                      (sort?.key === col.key ? (
                        sort.dir === 'asc' ? (
                          <ArrowUp size={12} aria-hidden />
                        ) : (
                          <ArrowDown size={12} aria-hidden />
                        )
                      ) : (
                        <ArrowUpDown size={12} className="opacity-40" aria-hidden />
                      ))}
                    {(col.filterAccessor ?? col.sortAccessor) && (
                      <button
                        type="button"
                        title={`Filter ${col.label}`}
                        aria-label={`Filter ${col.label}`}
                        onClick={(event) => {
                          event.stopPropagation()
                          toggleFilterMenu(col.key)
                        }}
                        className={cn(
                          'inline-flex size-5 shrink-0 items-center justify-center rounded hover:bg-slate-200 focus:ring-2 focus:ring-primary/30 focus:outline-none',
                          filters[col.key]?.length ? 'text-primary' : 'text-slate-400 hover:text-slate-700',
                        )}
                      >
                        <Funnel size={13} aria-hidden />
                      </button>
                    )}
                  </span>
                  {openFilter === col.key && (
                    <div className="absolute top-full left-0 z-30 mt-1 w-64 rounded-lg border border-slate-200 bg-white p-2 shadow-xl" onClick={(event) => event.stopPropagation()}>
                      <div className="mb-2 flex items-center justify-between gap-2">
                        <span className="truncate text-xs font-black normal-case tracking-normal text-slate-900">Filter {col.label}</span>
                        <button type="button" onClick={() => setOpenFilter(null)} className="rounded p-1 text-slate-400 hover:bg-slate-100 hover:text-slate-700" aria-label="Tutup filter">
                          <X size={14} aria-hidden />
                        </button>
                      </div>
                      <Input value={filterQuery} onChange={(event) => setFilterQuery(event.target.value)} placeholder="Cari pilihan…" className="h-8 px-2 text-xs" aria-label={`Cari pilihan ${col.label}`} />
                      <div className="mt-2 flex gap-3 border-b border-slate-100 pb-2 text-xs font-bold">
                        <button type="button" onClick={() => selectAllFilterOptions(col.key)} className="text-primary hover:underline">Pilih semua</button>
                        <button type="button" onClick={() => clearColumnFilter(col.key)} className="text-slate-600 hover:text-danger hover:underline">Kosongkan</button>
                      </div>
                      <div className="mt-2 max-h-52 space-y-1 overflow-y-auto">
                        {(filterOptions[col.key] ?? [])
                          .filter((value) => (value || '(Kosong)').toLowerCase().includes(filterQuery.trim().toLowerCase()))
                          .map((value) => (
                            <label key={value || '__empty'} className="flex cursor-pointer items-center gap-2 rounded px-1 py-1 text-xs font-medium normal-case tracking-normal text-slate-700 hover:bg-slate-50">
                              <input type="checkbox" className="size-3.5 rounded border-slate-300 accent-primary" checked={filters[col.key]?.includes(value) ?? false} onChange={() => toggleFilter(col.key, value)} />
                              <span className="truncate">{value || '(Kosong)'}</span>
                            </label>
                          ))}
                      </div>
                    </div>
                  )}
                </Th>
              ))}
            </tr>
          </thead>
          <tbody>
            {visible.map((row, index) => (
              <Tr
                key={rowKey(row)}
                onClick={onRowClick ? () => onRowClick(row) : undefined}
                className={onRowClick ? 'cursor-pointer' : undefined}
              >
                {showRowNumber && (
                  <Td className="tnum text-muted-foreground">
                    {(pageSize === Infinity ? 0 : safePage * pageSize) + index + 1}
                  </Td>
                )}
                {selectable && (
                  <Td onClick={(e) => e.stopPropagation()}>
                    <input
                      type="checkbox"
                      className="size-4 rounded border-slate-300 accent-primary"
                      checked={selectedKeys?.has(rowKey(row)) ?? false}
                      onChange={() => toggleOne(rowKey(row))}
                      aria-label="Pilih baris ini"
                    />
                  </Td>
                )}
                {columns.map((col) => (
                  <Td
                    key={col.key}
                    className={cn(
                      col.align === 'right' && 'text-right',
                      col.align === 'center' && 'text-center',
                      col.className,
                    )}
                    onClick={col.stopRowClick ? (e) => e.stopPropagation() : undefined}
                  >
                    {col.render(row)}
                  </Td>
                ))}
              </Tr>
            ))}
          </tbody>
          {hasTotals && (
            <tfoot>
              <tr className="border-t-2 border-slate-200 bg-surface-muted">
                {showRowNumber && <Td />}
                {selectable && <Td />}
                {columns.map((col) => (
                  <Td
                    key={col.key}
                    className={cn(
                      'font-black text-slate-900',
                      col.align === 'right' && 'text-right',
                      col.align === 'center' && 'text-center',
                      col.className,
                    )}
                  >
                    {col.renderTotal ? col.renderTotal(sorted) : null}
                  </Td>
                ))}
              </tr>
            </tfoot>
          )}
        </Table>
      ) : (
        <EmptyState
          title={query || activeFilterCount ? 'Tidak ada yang cocok' : emptyTitle}
          description={query ? `Tidak ada baris yang cocok dengan "${query}".` : activeFilterCount ? 'Ubah atau hapus filter kolom untuk melihat data lain.' : emptyDescription}
        />
      )}

      {pageCount > 1 && (
        <div className="flex items-center justify-between gap-3 border-t border-slate-100 px-4 py-3">
          <span className="tnum text-xs font-semibold text-muted-foreground">
            {safePage * pageSize + 1}–{Math.min((safePage + 1) * pageSize, sorted.length)} dari{' '}
            {sorted.length}
          </span>
          <div className="flex items-center gap-1">
            <button
              type="button"
              onClick={() => setPage(safePage - 1)}
              disabled={safePage === 0}
              className="inline-flex h-8 items-center gap-1 rounded-lg border border-slate-300 bg-white px-2.5 text-xs font-bold text-slate-700 hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-40"
            >
              <ArrowLeft size={14} aria-hidden />
              Sebelumnya
            </button>
            <span className="tnum px-2 text-xs font-bold text-slate-600">
              {safePage + 1}/{pageCount}
            </span>
            <button
              type="button"
              onClick={() => setPage(safePage + 1)}
              disabled={safePage >= pageCount - 1}
              className="inline-flex h-8 items-center gap-1 rounded-lg border border-slate-300 bg-white px-2.5 text-xs font-bold text-slate-700 hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-40"
            >
              Berikutnya
              <ArrowRight size={14} aria-hidden />
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
