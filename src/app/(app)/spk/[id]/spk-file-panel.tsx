'use client'

import { useState } from 'react'
import dynamic from 'next/dynamic'
import { Download, Eye, FileText, LoaderCircle, Pencil, Trash2, Upload } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Field, Input } from '@/components/ui/field'
import { Modal } from '@/components/ui/modal'
import { useToast } from '@/components/ui/toast'
import { formatDateTime } from '@/lib/utils'

const PdfViewer = dynamic(() => import('./pdf-viewer').then((module) => module.PdfViewer), {
  ssr: false,
  loading: () => <div className="grid min-h-96 place-items-center rounded-lg bg-slate-100 text-sm font-semibold text-slate-600">Menyiapkan pembaca PDF…</div>,
})

type SpkFile = { id: string; filename: string; size_bytes: number | null; uploaded_at: string }

function sizeLabel(bytes: number | null) {
  if (!bytes) return '—'
  return `${new Intl.NumberFormat('id-ID', { maximumFractionDigits: 1 }).format(bytes / 1024 / 1024)} MB`
}

/** One canonical PDF per SPK. Preview lives in a popup so Ringkasan remains a
 * concise operational overview, while the document is one click away. */
export function SpkFilePanel({ spkId, mayEdit, file: currentFile }: { spkId: string; mayEdit: boolean; file: SpkFile | null }) {
  const { success, error } = useToast()
  const [uploadOpen, setUploadOpen] = useState(false)
  const [viewerOpen, setViewerOpen] = useState(false)
  const [file, setFile] = useState<File | null>(null)
  const [uploading, setUploading] = useState(false)
  const [deleting, setDeleting] = useState(false)

  async function upload() {
    if (!file) return error('Pilih file PDF terlebih dahulu.')
    if (file.type !== 'application/pdf') return error('Hanya file PDF yang dapat diunggah.')
    if (file.size > 50 * 1024 * 1024) return error('Ukuran PDF maksimal 50 MB.')

    setUploading(true)
    try {
      const prepared = await fetch(`/api/spk/${spkId}/documents/upload-url`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ filename: file.name, contentType: file.type, sizeBytes: file.size, module: 'other' }),
      })
      const preparation = await prepared.json()
      if (!prepared.ok) throw new Error(preparation.error ?? 'URL unggah tidak dapat dibuat.')

      const sent = await fetch(preparation.uploadUrl, { method: 'PUT', headers: { 'Content-Type': file.type }, body: file })
      if (!sent.ok) throw new Error('File gagal diunggah ke penyimpanan.')

      const saved = await fetch(`/api/spk/${spkId}/documents`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ storagePath: preparation.storagePath, filename: preparation.filename, module: 'other', replaceFileId: currentFile?.id }),
      })
      const result = await saved.json()
      if (!saved.ok) throw new Error(result.error ?? 'File SPK gagal disimpan.')

      setUploadOpen(false)
      setFile(null)
      success(currentFile ? 'File SPK berhasil diganti.' : 'File SPK berhasil diunggah.')
      window.location.reload()
    } catch (reason) {
      error(reason instanceof Error ? reason.message : 'File SPK gagal diunggah.')
    } finally {
      setUploading(false)
    }
  }

  async function remove() {
    if (!currentFile || !window.confirm(`Hapus ${currentFile.filename}?`)) return
    setDeleting(true)
    try {
      const response = await fetch(`/api/spk/${spkId}/documents/${currentFile.id}`, { method: 'DELETE' })
      const result = await response.json()
      if (!response.ok) throw new Error(result.error ?? 'File SPK gagal dihapus.')
      setUploadOpen(false)
      success('File SPK berhasil dihapus.')
      window.location.reload()
    } catch (reason) {
      error(reason instanceof Error ? reason.message : 'File SPK gagal dihapus.')
    } finally {
      setDeleting(false)
    }
  }

  const uploadDialog = mayEdit ? (
    <Modal
      open={uploadOpen}
      onOpenChange={setUploadOpen}
      title={currentFile ? 'Ganti file SPK' : 'Unggah file SPK'}
      description="Satu PDF utama per SPK, maksimal 50 MB. Nama file mengikuti kode SPK."
      trigger={currentFile ? undefined : <Button size="sm"><Upload size={15} aria-hidden /> Tambah file</Button>}
    >
      <div className="grid gap-4">
        <Field label="File PDF" htmlFor="spk-file" required>
          <Input id="spk-file" type="file" accept="application/pdf" required onChange={(event) => setFile(event.target.files?.[0] ?? null)} />
        </Field>
        <Button onClick={upload} disabled={uploading}>
          {uploading ? <LoaderCircle className="animate-spin" size={16} aria-hidden /> : <Upload size={16} aria-hidden />}
          {uploading ? 'Mengunggah…' : currentFile ? 'Simpan file pengganti' : 'Unggah file SPK'}
        </Button>
        {currentFile && (
          <div className="border-t border-slate-200 pt-4">
            <Button variant="danger" className="w-full" onClick={remove} disabled={deleting}>
              <Trash2 size={16} aria-hidden />
              {deleting ? 'Menghapus…' : 'Hapus file SPK'}
            </Button>
          </div>
        )}
      </div>
    </Modal>
  ) : null

  if (!currentFile) {
    return (
      <section className="overflow-hidden rounded-lg border border-slate-200 bg-surface shadow-sm">
        <div className="flex flex-wrap items-center justify-between gap-3 px-5 py-4">
          <div className="flex items-center gap-3"><span className="grid h-9 w-9 place-items-center rounded-lg bg-primary-soft text-primary"><FileText size={18} aria-hidden /></span><div><h2 className="text-sm font-extrabold text-slate-900">File SPK</h2><p className="text-xs text-muted-foreground">Belum ada PDF utama.</p></div></div>
          {uploadDialog}
        </div>
      </section>
    )
  }

  const fileUrl = `/api/spk/${spkId}/documents/${currentFile.id}`
  return (
    <>
      <section className="overflow-hidden rounded-lg border border-slate-200 bg-surface shadow-sm">
        <div className="flex flex-wrap items-center justify-between gap-3 px-5 py-4">
          <div className="flex min-w-0 items-center gap-3"><span className="grid h-9 w-9 shrink-0 place-items-center rounded-lg bg-danger/10 text-danger"><FileText size={18} aria-hidden /></span><div className="min-w-0"><h2 className="truncate text-sm font-extrabold text-slate-900">{currentFile.filename}</h2><p className="text-xs text-muted-foreground">{sizeLabel(currentFile.size_bytes)} · diperbarui {formatDateTime(currentFile.uploaded_at)}</p></div></div>
          <div className="flex items-center gap-2">
            <Button size="sm" onClick={() => setViewerOpen(true)}><Eye size={15} aria-hidden /> Lihat file SPK</Button>
            {mayEdit && <Button variant="secondary" size="sm" onClick={() => setUploadOpen(true)} title="Edit file SPK"><Pencil size={15} aria-hidden /> Edit</Button>}
          </div>
        </div>
      </section>
      {uploadDialog}
      <Modal open={viewerOpen} onOpenChange={setViewerOpen} title={currentFile.filename} size="lg">
        <div className="-mx-1 -my-1 grid gap-3">
          <div className="flex justify-end"><a href={`${fileUrl}?download=1`} className="inline-flex h-8 items-center gap-1.5 rounded-lg border border-slate-300 bg-white px-3 text-xs font-bold text-slate-700 hover:bg-slate-50"><Download size={14} aria-hidden /> Unduh</a></div>
          <PdfViewer fileUrl={fileUrl} filename={currentFile.filename} />
        </div>
      </Modal>
    </>
  )
}
