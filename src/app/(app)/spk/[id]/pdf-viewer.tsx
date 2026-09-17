'use client'

import { useEffect, useRef, useState } from 'react'
import { LoaderCircle } from 'lucide-react'
import { Document, Page, pdfjs } from 'react-pdf'
import 'react-pdf/dist/Page/TextLayer.css'

// Keep the worker alongside the app bundle. The PDF never leaves this app;
// only the PDF.js parser is loaded in the browser.
pdfjs.GlobalWorkerOptions.workerSrc = new URL('pdfjs-dist/build/pdf.worker.min.mjs', import.meta.url).toString()

function LazyPdfPage({ pageNumber, width, filename }: { pageNumber: number; width: number; filename: string }) {
  const placeholder = useRef<HTMLDivElement>(null)
  const [isNearViewport, setIsNearViewport] = useState(pageNumber === 1)

  useEffect(() => {
    const element = placeholder.current
    if (!element || pageNumber === 1) return

    const observer = new IntersectionObserver(
      ([entry]) => setIsNearViewport(entry.isIntersecting),
      { rootMargin: '900px 0px' },
    )
    observer.observe(element)
    return () => observer.disconnect()
  }, [pageNumber])

  return (
    <div
      ref={placeholder}
      className="relative overflow-hidden rounded border border-slate-300 bg-white shadow-sm"
      style={{ width, minHeight: Math.round(width * 1.414) }}
    >
      {isNearViewport ? (
        <Page
          pageNumber={pageNumber}
          width={width}
          renderAnnotationLayer={false}
          renderTextLayer
          loading={<div className="grid h-full min-h-96 place-items-center text-sm text-slate-500"><LoaderCircle className="animate-spin" size={18} aria-hidden /></div>}
          aria-label={`${filename}, halaman ${pageNumber}`}
        />
      ) : (
        <div className="grid h-full place-items-center text-sm text-slate-400">Memuat halaman {pageNumber}…</div>
      )}
    </div>
  )
}

export function PdfViewer({ fileUrl, filename }: { fileUrl: string; filename: string }) {
  const frame = useRef<HTMLDivElement>(null)
  const [pageCount, setPageCount] = useState(0)
  const [width, setWidth] = useState(720)
  const [loadError, setLoadError] = useState<string | null>(null)

  useEffect(() => {
    if (!frame.current) return
    const observer = new ResizeObserver((entries) => {
      const entry = entries[0]
      if (entry) {
        setWidth(Math.max(260, Math.floor(entry.contentRect.width - 32)))
      }
    })
    observer.observe(frame.current)
    return () => observer.disconnect()
  }, [])

  if (loadError) {
    return <div className="grid min-h-96 place-items-center px-5 text-center text-sm font-semibold text-danger">{loadError}</div>
  }

  return (
    <div ref={frame} className="rounded-lg bg-slate-100 p-4">
      <Document
        file={fileUrl}
        loading={<div className="grid min-h-96 place-items-center text-sm font-semibold text-slate-600"><LoaderCircle className="animate-spin" size={20} aria-hidden /> Memuat PDF…</div>}
        onLoadSuccess={({ numPages }) => setPageCount(numPages)}
        onLoadError={() => setLoadError('PDF tidak dapat ditampilkan. Gunakan tombol Unduh untuk membukanya.')}
      >
        <div className="mx-auto grid w-fit gap-4">
          {Array.from({ length: pageCount }, (_, index) => (
            <LazyPdfPage key={index + 1} pageNumber={index + 1} width={width} filename={filename} />
          ))}
        </div>
      </Document>
    </div>
  )
}
