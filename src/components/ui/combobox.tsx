'use client'

import { useEffect, useRef, useState } from 'react'
import { Search } from 'lucide-react'

export type ComboboxOption = { id: string; label: string }

/** A searchable dropdown — types like a text input, picks like a select.
 *  Submits `name`=option id via a hidden input, same as a plain <select>. */
export function Combobox({
  id,
  name,
  options,
  placeholder = 'Cari…',
}: {
  id?: string
  name: string
  options: ComboboxOption[]
  placeholder?: string
}) {
  const [query, setQuery] = useState('')
  const [selected, setSelected] = useState<ComboboxOption | null>(null)
  const [open, setOpen] = useState(false)
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!open) return
    function onClick(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false)
    }
    document.addEventListener('click', onClick)
    return () => document.removeEventListener('click', onClick)
  }, [open])

  const filtered = query
    ? options.filter((o) => o.label.toLowerCase().includes(query.toLowerCase()))
    : options

  return (
    <div ref={ref} className="relative">
      <input type="hidden" name={name} value={selected?.id ?? ''} />
      <div className="relative">
        <Search
          size={14}
          className="pointer-events-none absolute top-1/2 left-2.5 -translate-y-1/2 text-slate-400"
          aria-hidden
        />
        <input
          id={id}
          type="text"
          value={selected ? selected.label : query}
          onChange={(e) => {
            setQuery(e.target.value)
            setSelected(null)
            setOpen(true)
          }}
          onFocus={() => setOpen(true)}
          placeholder={placeholder}
          autoComplete="off"
          className="h-10 w-full rounded-lg border border-slate-300 bg-white pl-8 pr-3 text-sm"
        />
      </div>
      {open && filtered.length > 0 && (
        <ul className="absolute z-20 mt-1 max-h-60 w-full overflow-auto rounded-lg border border-slate-200 bg-white p-1 shadow-lg">
          {filtered.map((o) => (
            <li key={o.id}>
              <button
                type="button"
                className="block w-full rounded-md px-2.5 py-1.5 text-left text-sm hover:bg-slate-50"
                onClick={() => {
                  setSelected(o)
                  setQuery('')
                  setOpen(false)
                }}
              >
                {o.label}
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}
