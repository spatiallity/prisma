'use client'

import { useEffect, useState, useTransition } from 'react'
import { usePathname, useRouter, useSearchParams } from 'next/navigation'
import { Search, X } from 'lucide-react'
import { cn } from '@/lib/utils'
import { STATUS_FILTERS } from '@/lib/spk'

/** Search box plus status pills, both driving the URL so the list stays server-rendered. */
export function SpkFilters({ total }: { total: number }) {
  const router = useRouter()
  const pathname = usePathname()
  const params = useSearchParams()
  const [isPending, startTransition] = useTransition()

  const activeStatus = params.get('status') ?? 'all'
  const [query, setQuery] = useState(params.get('q') ?? '')

  // Push the search term after the user pauses, so every keystroke is not a fetch.
  useEffect(() => {
    const current = params.get('q') ?? ''
    if (query === current) return

    const timer = setTimeout(() => {
      const next = new URLSearchParams(params.toString())
      if (query) next.set('q', query)
      else next.delete('q')
      startTransition(() => router.replace(`${pathname}?${next}`))
    }, 300)

    return () => clearTimeout(timer)
  }, [query, params, pathname, router])

  function hrefForStatus(key: string) {
    const next = new URLSearchParams(params.toString())
    if (key === 'all') next.delete('status')
    else next.set('status', key)
    const search = next.toString()
    return search ? `${pathname}?${search}` : pathname
  }

  return (
    <div className="flex flex-wrap items-center gap-3">
      <div className="relative min-w-[240px] flex-1">
        <Search
          size={15}
          className="absolute top-2.5 left-3 text-slate-400"
          aria-hidden
        />
        <input
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          placeholder="Cari nomor SPK, nama pekerjaan, atau lokasi…"
          aria-label="Cari SPK"
          className="w-full rounded-xl border border-slate-300 py-2 pr-9 pl-9 text-sm outline-none focus:ring-2 focus:ring-blue-100"
        />
        {query && (
          <button
            type="button"
            onClick={() => setQuery('')}
            className="absolute top-2.5 right-3 text-slate-400 hover:text-slate-600"
            aria-label="Hapus pencarian"
          >
            <X size={15} />
          </button>
        )}
      </div>

      <div className="flex flex-wrap gap-1 rounded-xl bg-slate-100 p-1">
        {STATUS_FILTERS.map((filter) => (
          <a
            key={filter.key}
            href={hrefForStatus(filter.key)}
            className={cn(
              'rounded-lg px-3.5 py-1.5 text-xs font-extrabold transition-shadow',
              activeStatus === filter.key
                ? 'bg-primary text-white shadow-md shadow-primary/20'
                : 'bg-transparent text-slate-500 hover:text-slate-800',
            )}
          >
            {filter.label}
          </a>
        ))}
      </div>

      <span className="text-xs font-bold text-slate-500 tabular-nums">
        {isPending ? 'Memuat…' : `${total} SPK`}
      </span>
    </div>
  )
}
