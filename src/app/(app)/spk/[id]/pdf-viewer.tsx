'use client'

import { useEffect, useId, useState } from 'react'
import { LoaderCircle, TriangleAlert } from 'lucide-react'

type AdobeViewer = {
  previewFile: (file: unknown, options: unknown) => Promise<unknown>
}

declare global {
  interface Window {
    AdobeDC?: {
      View: new (options: { clientId: string; divId: string; downloadWithCredentials?: boolean }) => AdobeViewer
    }
  }
}

const ADOBE_SDK_URL = 'https://acrobatservices.adobe.com/view-sdk/viewer.js'

function loadAdobeViewer() {
  return new Promise<void>((resolve, reject) => {
    if (window.AdobeDC) {
      resolve()
      return
    }

    const ready = () => resolve()
    document.addEventListener('adobe_dc_view_sdk.ready', ready, { once: true })
    const existing = document.getElementById('adobe-pdf-embed-sdk') as HTMLScriptElement | null
    if (existing) {
      existing.addEventListener('error', () => reject(new Error('Adobe PDF Embed API tidak dapat dimuat.')), { once: true })
      return
    }

    const script = document.createElement('script')
    script.id = 'adobe-pdf-embed-sdk'
    script.src = ADOBE_SDK_URL
    script.async = true
    script.onerror = () => reject(new Error('Adobe PDF Embed API tidak dapat dimuat.'))
    document.head.appendChild(script)
  })
}

export function PdfViewer({ fileUrl, filename }: { fileUrl: string; filename: string }) {
  const viewerId = `adobe-pdf-${useId().replace(/[^a-zA-Z0-9_-]/g, '')}`
  const clientId = process.env.NEXT_PUBLIC_ADOBE_PDF_EMBED_CLIENT_ID
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const adobeClientId: string = clientId ?? ''
    if (!adobeClientId) {
      setError('Adobe PDF Embed API belum dikonfigurasi.')
      setLoading(false)
      return
    }

    let cancelled = false
    async function renderViewer() {
      try {
        setError(null)
        setLoading(true)
        await loadAdobeViewer()
        if (cancelled || !window.AdobeDC) return

        const viewer = new window.AdobeDC.View({
          clientId: adobeClientId,
          divId: viewerId,
          // The PDF route is protected by the user's Supabase session.
          downloadWithCredentials: true,
        })
        await viewer.previewFile(
          {
            content: { location: { url: fileUrl } },
            metaData: { fileName: filename },
          },
          {
            embedMode: 'FULL_WINDOW',
            defaultViewMode: 'FIT_WIDTH',
            enableLinearization: true,
            focusOnRendering: false,
            showDownloadPDF: true,
            showFullScreen: true,
            showFullScreenViewButton: true,
            showPrintPDF: true,
            showZoomControl: true,
          },
        )
        if (!cancelled) setLoading(false)
      } catch (reason) {
        if (!cancelled) {
          setError(reason instanceof Error ? reason.message : 'PDF tidak dapat ditampilkan.')
          setLoading(false)
        }
      }
    }

    void renderViewer()
    return () => {
      cancelled = true
      document.getElementById(viewerId)?.replaceChildren()
    }
  }, [clientId, fileUrl, filename, viewerId])

  if (error) {
    return (
      <div className="grid min-h-96 place-items-center gap-3 rounded-lg bg-slate-100 px-5 text-center text-sm font-semibold text-danger">
        <TriangleAlert size={22} aria-hidden />
        {error}
      </div>
    )
  }

  return (
    <div className="relative h-[72vh] min-h-[540px] overflow-hidden rounded-lg border border-slate-200 bg-slate-100">
      <div id={viewerId} className="h-full" />
      {loading && <div className="pointer-events-none absolute inset-0 grid place-items-center bg-slate-100 text-slate-600"><LoaderCircle className="animate-spin" size={20} aria-label="Memuat PDF" /></div>}
    </div>
  )
}
