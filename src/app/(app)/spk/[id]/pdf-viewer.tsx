'use client'

import { useEffect, useRef, useState } from 'react'
import { LoaderCircle, Maximize2, Minimize2, Search, ZoomIn, ZoomOut } from 'lucide-react'
import { Document, Page, pdfjs } from 'react-pdf'
import 'react-pdf/dist/Page/TextLayer.css'

// Keep the worker alongside the app bundle. The PDF never leaves this app;
// only the PDF.js parser is loaded in the browser.
pdfjs.GlobalWorkerOptions.workerSrc = new URL('pdfjs-dist/build/pdf.worker.min.mjs', import.meta.url).toString()

type SearchablePdf = {
  numPages: number
  getPage: (pageNumber: number) => Promise<{ getTextContent: () => Promise<{ items: unknown[] }> }>
}

function LazyPdfPage({ pageNumber, width, filename, forceRender, searchTerm }: {
  pageNumber: number
  width: number
  filename: string
  forceRender: boolean
  searchTerm: string
}) {
  const placeholder = useRef<HTMLDivElement>(null)
  const [isNearViewport, setIsNearViewport] = useState(pageNumber === 1)

  useEffect(() => {
    const element = placeholder.current
    if (!element || pageNumber === 1) return
    const observer = new IntersectionObserver(([entry]) => setIsNearViewport(entry.isIntersecting), { rootMargin: '900px 0px' })
    observer.observe(element)
    return () => observer.disconnect()
  }, [pageNumber])

  function highlightSearchTerm() {
    const query = searchTerm.trim().toLocaleLowerCase()
    placeholder.current?.querySelectorAll('.textLayer span').forEach((span) => {
      span.classList.toggle('pdf-search-match', Boolean(query) && (span.textContent ?? '').toLocaleLowerCase().includes(query))
    })
  }

  const shouldRender = isNearViewport || forceRender

  return (
    <div ref={placeholder} data-pdf-page={pageNumber} className="relative overflow-hidden rounded border border-slate-300 bg-white shadow-sm" style={{ width, minHeight: Math.round(width * 1.414) }}>
      {shouldRender ? (
        <Page
          pageNumber={pageNumber}
          width={width}
          renderAnnotationLayer={false}
          renderTextLayer
          onRenderTextLayerSuccess={highlightSearchTerm}
          loading={<div className="grid h-full min-h-96 place-items-center text-sm text-slate-500"><LoaderCircle className="animate-spin" size={18} aria-hidden /></div>}
          aria-label={`${filename}, halaman ${pageNumber}`}
        />
      ) : <div className="grid h-full place-items-center text-sm text-slate-400">Memuat halaman {pageNumber}…</div>}
    </div>
  )
}

export function PdfViewer({ fileUrl, filename }: { fileUrl: string; filename: string }) {
  const frame = useRef<HTMLDivElement>(null)
  const documentRef = useRef<SearchablePdf | null>(null)
  const [pageCount, setPageCount] = useState(0)
  const [baseWidth, setBaseWidth] = useState(720)
  const [zoom, setZoom] = useState(1)
  const [searchTerm, setSearchTerm] = useState('')
  const [searchStatus, setSearchStatus] = useState('')
  const [matchPage, setMatchPage] = useState<number | null>(null)
  const [isFullscreen, setIsFullscreen] = useState(false)
  const [loadError, setLoadError] = useState<string | null>(null)
  const width = Math.round(baseWidth * zoom)

  useEffect(() => {
    if (!frame.current) return
    const observer = new ResizeObserver((entries) => {
      const entry = entries[0]
      if (entry) setBaseWidth(Math.max(260, Math.floor(entry.contentRect.width - 32)))
    })
    observer.observe(frame.current)
    return () => observer.disconnect()
  }, [])

  useEffect(() => {
    const syncFullscreenState = () => setIsFullscreen(document.fullscreenElement === frame.current)
    document.addEventListener('fullscreenchange', syncFullscreenState)
    return () => document.removeEventListener('fullscreenchange', syncFullscreenState)
  }, [])

  useEffect(() => {
    if (!matchPage) return
    const timeout = window.setTimeout(() => {
      frame.current?.querySelector<HTMLElement>(`[data-pdf-page="${matchPage}"]`)?.scrollIntoView({ behavior: 'smooth', block: 'center' })
    }, 0)
    return () => window.clearTimeout(timeout)
  }, [matchPage])

  async function searchDocument() {
    const query = searchTerm.trim().toLocaleLowerCase()
    const pdf = documentRef.current
    if (!query || !pdf) return
    setSearchStatus('Mencari…')

    for (let pageNumber = 1; pageNumber <= pdf.numPages; pageNumber += 1) {
      const page = await pdf.getPage(pageNumber)
      const textContent = await page.getTextContent()
      const pageText = textContent.items
        .map((item) => typeof item === 'object' && item !== null && 'str' in item && typeof item.str === 'string' ? item.str : '')
        .join(' ')
      if (pageText.toLocaleLowerCase().includes(query)) {
        setMatchPage(pageNumber)
        setSearchStatus(`Ditemukan di halaman ${pageNumber}`)
        return
      }
    }

    setMatchPage(null)
    setSearchStatus('Teks tidak ditemukan')
  }

  async function toggleFullscreen() {
    if (document.fullscreenElement) await document.exitFullscreen()
    else await frame.current?.requestFullscreen()
  }

  if (loadError) return <div className="grid min-h-96 place-items-center px-5 text-center text-sm font-semibold text-danger">{loadError}</div>

  return (
    <div ref={frame} className={`rounded-lg bg-slate-100 p-4 ${isFullscreen ? 'h-screen overflow-auto rounded-none' : ''}`}>
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3 rounded border border-slate-200 bg-white p-2 shadow-sm">
        <form className="flex min-w-0 flex-1 items-center gap-2" onSubmit={(event) => { event.preventDefault(); void searchDocument() }}>
          <Search size={17} className="shrink-0 text-slate-500" aria-hidden />
          <input value={searchTerm} onChange={(event) => { setSearchTerm(event.target.value); setSearchStatus('') }} placeholder="Cari di dokumen" className="min-w-0 flex-1 border-0 bg-transparent px-1 py-1 text-sm outline-none placeholder:text-slate-400" aria-label="Cari teks di dokumen" />
          <button type="submit" className="rounded px-2 py-1 text-sm font-semibold text-primary hover:bg-primary-soft" disabled={!searchTerm.trim()}>Cari</button>
          {searchStatus && <span className="hidden text-xs text-slate-500 sm:inline">{searchStatus}</span>}
        </form>
        <div className="flex shrink-0 items-center gap-1">
          <button type="button" title="Perkecil" aria-label="Perkecil" className="grid size-8 place-items-center rounded text-slate-600 hover:bg-slate-100 disabled:opacity-40" onClick={() => setZoom((value) => Math.max(0.6, Number((value - 0.2).toFixed(1))))} disabled={zoom <= 0.6}><ZoomOut size={18} /></button>
          <span className="w-11 text-center text-xs font-semibold text-slate-600">{Math.round(zoom * 100)}%</span>
          <button type="button" title="Perbesar" aria-label="Perbesar" className="grid size-8 place-items-center rounded text-slate-600 hover:bg-slate-100 disabled:opacity-40" onClick={() => setZoom((value) => Math.min(2, Number((value + 0.2).toFixed(1))))} disabled={zoom >= 2}><ZoomIn size={18} /></button>
          <span className="mx-1 h-5 border-l border-slate-200" aria-hidden />
          <button type="button" title={isFullscreen ? 'Keluar dari layar penuh' : 'Layar penuh'} aria-label={isFullscreen ? 'Keluar dari layar penuh' : 'Layar penuh'} className="grid size-8 place-items-center rounded text-slate-600 hover:bg-slate-100" onClick={() => void toggleFullscreen()}>{isFullscreen ? <Minimize2 size={18} /> : <Maximize2 size={18} />}</button>
        </div>
        {searchStatus && <span className="w-full text-xs text-slate-500 sm:hidden">{searchStatus}</span>}
      </div>

      <Document
        file={fileUrl}
        loading={<div className="grid min-h-96 place-items-center text-sm font-semibold text-slate-600"><LoaderCircle className="animate-spin" size={20} aria-hidden /> Memuat PDF…</div>}
        onLoadSuccess={(pdf) => { documentRef.current = pdf as SearchablePdf; setPageCount(pdf.numPages) }}
        onLoadError={() => setLoadError('PDF tidak dapat ditampilkan. Gunakan tombol Unduh untuk membukanya.')}
      >
        <div className="mx-auto grid w-fit gap-4">
          {Array.from({ length: pageCount }, (_, index) => <LazyPdfPage key={index + 1} pageNumber={index + 1} width={width} filename={filename} forceRender={matchPage === index + 1} searchTerm={searchTerm} />)}
        </div>
      </Document>
    </div>
  )
}
