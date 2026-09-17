'use client'

import { useEffect, useRef, useState } from 'react'
import { LoaderCircle } from 'lucide-react'
import { Document, Page, pdfjs } from 'react-pdf'

// Keep the worker alongside the app bundle. The PDF never leaves this app;
// only the PDF.js parser is loaded in the browser.
pdfjs.GlobalWorkerOptions.workerSrc = new URL('pdfjs-dist/build/pdf.worker.min.mjs', import.meta.url).toString()

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
            <div key={index + 1} className="overflow-hidden rounded border border-slate-300 bg-white shadow-sm">
              <Page pageNumber={index + 1} width={width} renderAnnotationLayer={false} renderTextLayer={false} aria-label={`${filename}, halaman ${index + 1}`} />
            </div>
          ))}
        </div>
      </Document>
    </div>
  )
}
