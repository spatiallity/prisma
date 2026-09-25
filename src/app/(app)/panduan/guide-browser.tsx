'use client'

import { useMemo, useState } from 'react'
import Image from 'next/image'
import Link from 'next/link'
import { ArrowUpRight, ExternalLink, Search, X } from 'lucide-react'
import { CATEGORIES, type GuideCategory, type GuideTopic } from './guide-data'

export function GuideBrowser({ topics }: { topics: GuideTopic[] }) {
  const [category, setCategory] = useState<GuideCategory | 'Semua'>('Semua')
  const [query, setQuery] = useState('')
  const normalizedQuery = query.trim().toLocaleLowerCase('id-ID')
  const filtered = useMemo(() => topics.filter((topic) => {
    if (category !== 'Semua' && topic.category !== category) return false
    if (!normalizedQuery) return true
    return [topic.title, topic.category, ...topic.steps].join(' ').toLocaleLowerCase('id-ID').includes(normalizedQuery)
  }), [category, normalizedQuery, topics])

  return (
    <div className="mx-auto max-w-[1320px] pb-12">
      <div className="mb-6 flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-2xl font-extrabold text-slate-900">Panduan</h1>
          <p className="mt-1 text-sm text-muted-foreground">Langkah kerja untuk setiap alur utama PRISMA.</p>
        </div>
        <span className="text-sm font-semibold text-muted-foreground">{filtered.length} topik</span>
      </div>

      <div className="mb-6 border-y border-slate-200 bg-white px-4 py-4 sm:px-5">
        <div className="relative max-w-lg">
          <Search className="pointer-events-none absolute left-3 top-3 text-slate-400" size={18} aria-hidden />
          <input
            type="search"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Cari SPK, desain, routing, invoice..."
            aria-label="Cari topik panduan"
            className="h-11 w-full rounded-md border border-slate-300 bg-white pl-10 pr-10 text-sm text-slate-900 outline-none focus:border-primary focus:ring-2 focus:ring-primary/15"
          />
          {query && (
            <button
              type="button"
              onClick={() => setQuery('')}
              aria-label="Hapus pencarian"
              title="Hapus pencarian"
              className="absolute right-2 top-2 grid h-7 w-7 place-items-center text-slate-500 hover:text-slate-900"
            >
              <X size={16} aria-hidden />
            </button>
          )}
        </div>
        <div role="tablist" aria-label="Kategori panduan" className="mt-4 flex gap-5 overflow-x-auto border-b border-slate-200">
          {(['Semua', ...CATEGORIES] as const).map((item) => (
            <button
              key={item}
              type="button"
              role="tab"
              aria-selected={category === item}
              onClick={() => setCategory(item)}
              className={`shrink-0 border-b-2 px-0.5 pb-2 text-sm font-bold transition-colors ${category === item ? 'border-primary text-primary' : 'border-transparent text-slate-600 hover:text-slate-900'}`}
            >
              {item}
            </button>
          ))}
        </div>
      </div>

      {filtered.length === 0 ? (
        <div className="border-y border-slate-200 bg-white px-6 py-16 text-center">
          <p className="font-bold text-slate-900">Topik tidak ditemukan</p>
          <p className="mt-1 text-sm text-muted-foreground">Coba kata kunci lain atau pilih Semua.</p>
          <button type="button" onClick={() => { setQuery(''); setCategory('Semua') }} className="mt-4 text-sm font-bold text-primary hover:underline">
            Tampilkan semua
          </button>
        </div>
      ) : (
        <div className="border-y border-slate-200 bg-white">
          {filtered.map((topic, index) => (
            <section key={topic.id} id={topic.id} className="scroll-mt-20 border-b border-slate-200 px-4 py-7 last:border-b-0 sm:px-6 lg:py-9">
              <div className="mb-5 flex flex-wrap items-start justify-between gap-3">
                <div className="min-w-0">
                  <div className="text-xs font-extrabold uppercase text-primary">{topic.category} · {index + 1}</div>
                  <h2 className="mt-1 text-lg font-extrabold text-slate-900 sm:text-xl">{topic.title}</h2>
                </div>
                <Link href={topic.href} className="inline-flex shrink-0 items-center gap-1.5 text-sm font-bold text-primary hover:underline">
                  Buka halaman <ArrowUpRight size={16} aria-hidden />
                </Link>
              </div>
              <div className={`grid items-start gap-6 ${topic.image ? 'lg:grid-cols-[minmax(0,1fr)_minmax(0,1.08fr)] lg:gap-9' : ''}`}>
                <div>
                  <ol className="grid gap-4">
                    {topic.steps.map((step, stepIndex) => (
                      <li key={stepIndex} className="grid grid-cols-[28px_minmax(0,1fr)] items-start gap-3">
                        <span className="grid h-7 w-7 place-items-center rounded-full bg-primary-soft text-xs font-extrabold text-primary">{stepIndex + 1}</span>
                        <p className="pt-0.5 text-sm leading-6 text-slate-700">{step}</p>
                      </li>
                    ))}
                  </ol>
                  {topic.note && <p className="mt-5 border-l-2 border-amber-400 pl-3 text-sm leading-6 text-slate-600">{topic.note}</p>}
                </div>
                {topic.image && <figure className="min-w-0">
                  <a href={topic.image} target="_blank" rel="noopener noreferrer" className="group relative block aspect-[16/9] overflow-hidden border border-slate-200 bg-slate-50" title="Buka screenshot ukuran penuh">
                    <Image src={topic.image} alt={topic.imageAlt} fill unoptimized sizes="(max-width: 1024px) 100vw, 45vw" className="object-contain object-top" />
                    <span className="absolute bottom-2 right-2 grid h-8 w-8 place-items-center rounded-md bg-white/95 text-slate-700 shadow-sm group-hover:text-primary" aria-hidden>
                      <ExternalLink size={16} />
                    </span>
                  </a>
                  <figcaption className="mt-2 text-xs leading-5 text-muted-foreground">Contoh tampilan · klik gambar untuk memperbesar. Isi data mengikuti kondisi SPK saat ini.</figcaption>
                </figure>}
              </div>
            </section>
          ))}
        </div>
      )}
    </div>
  )
}
