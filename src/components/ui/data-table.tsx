'use client'

import { useMemo, useState, type ReactNode } from 'react'
import { ArrowDown, ArrowUp, ArrowUpDown, Search } from 'lucide-react'
import { cn } from '@/lib/utils'
import { Table, Td, Th, Tr } from './table'
import { Input } from './field'
import { EmptyState } from './page-header'

export type DataTableColumn<T> = {
  key: string
  label: string
  align?: 'left' | 'right'
  className?: string
  /** Omit to make the column unsortable (e.g. an actions column). */
  sortAccessor?: (row: T) => string | number | null
  render: (row: T) => ReactNode
}

/**
 * Client-side sort + free-text filter over an already-fetched row set —
 * every list table in the app renders through this so both behaviors only
 * need to exist once. `searchAccessor` builds the haystack the search box
 * matches against; sorting is per-column via `sortAccessor`.
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
}) {
  const [query, setQuery] = useState('')
  const [sort, setSort] = useState<{ key: string; dir: 'asc' | 'desc' } | null>(
    defaultSort ?? null,
  )

  const filtered = useMemo(() => {
    if (!searchAccessor || !query.trim()) return rows
    const q = query.trim().toLowerCase()
    return rows.filter((row) => searchAccessor(row).toLowerCase().includes(q))
  }, [rows, query, searchAccessor])

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

  function toggleSort(key: string) {
    setSort((current) => {
      if (current?.key !== key) return { key, dir: 'asc' }
      if (current.dir === 'asc') return { key, dir: 'desc' }
      return null
    })
  }

  return (
    <div>
      {searchAccessor && (
        <div className="border-b border-slate-100 p-3">
          <div className="relative max-w-xs">
            <Search
              size={15}
              className="pointer-events-none absolute top-1/2 left-3 -translate-y-1/2 text-slate-400"
              aria-hidden
            />
            <Input
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder={searchPlaceholder}
              className="pl-9"
              aria-label={searchPlaceholder}
            />
          </div>
        </div>
      )}

      {sorted.length > 0 ? (
        <Table>
          <thead>
            <tr>
              {columns.map((col) => (
                <Th
                  key={col.key}
                  className={cn(
                    col.align === 'right' && 'text-right',
                    col.sortAccessor && 'cursor-pointer select-none hover:text-slate-700',
                    col.className,
                  )}
                  onClick={col.sortAccessor ? () => toggleSort(col.key) : undefined}
                >
                  <span
                    className={cn(
                      'inline-flex items-center gap-1',
                      col.align === 'right' && 'flex-row-reverse',
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
                  </span>
                </Th>
              ))}
            </tr>
          </thead>
          <tbody>
            {sorted.map((row) => (
              <Tr key={rowKey(row)}>
                {columns.map((col) => (
                  <Td key={col.key} className={cn(col.align === 'right' && 'text-right', col.className)}>
                    {col.render(row)}
                  </Td>
                ))}
              </Tr>
            ))}
          </tbody>
        </Table>
      ) : (
        <EmptyState
          title={query ? 'Tidak ada yang cocok' : emptyTitle}
          description={query ? `Tidak ada baris yang cocok dengan "${query}".` : emptyDescription}
        />
      )}
    </div>
  )
}
