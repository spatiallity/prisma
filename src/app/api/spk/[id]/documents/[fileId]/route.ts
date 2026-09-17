import { NextResponse } from 'next/server'
import { deleteR2Object, getR2Object, isR2Configured } from '@/lib/cloudflare/r2'
import { requirePermission } from '@/lib/auth/session'
import { createClient } from '@/lib/supabase/server'

export const runtime = 'nodejs'

function contentDisposition(filename: string, download: boolean) {
  const safe = filename.replace(/[\\"\r\n]/g, '_')
  return `${download ? 'attachment' : 'inline'}; filename="${safe}"`
}

export async function GET(request: Request, { params }: { params: Promise<{ id: string; fileId: string }> }) {
  if (!isR2Configured()) return new NextResponse('Penyimpanan dokumen belum dikonfigurasi.', { status: 503 })

  await requirePermission('spk', 'view')
  const { id: spkId, fileId } = await params
  const supabase = await createClient()
  const { data: file } = await supabase
    .from('files')
    .select('filename, storage_path, file_type, size_bytes')
    .eq('id', fileId)
    .eq('spk_id', spkId)
    .eq('status', 'Active')
    .maybeSingle()
  if (!file) return new NextResponse('Dokumen tidak ditemukan.', { status: 404 })

  try {
    const requestedRange = request.headers.get('range')
    const object = await getR2Object(file.storage_path, requestedRange ?? undefined)
    if (!object.Body) return new NextResponse('Dokumen kosong.', { status: 404 })
    const download = new URL(request.url).searchParams.get('download') === '1'
    const headers = new Headers({
      'Content-Type': object.ContentType ?? file.file_type ?? 'application/pdf',
      'Content-Disposition': contentDisposition(file.filename, download),
      'Cache-Control': 'private, no-store',
      'Accept-Ranges': 'bytes',
    })
    const contentLength = object.ContentLength ?? file.size_bytes
    if (contentLength !== null && contentLength !== undefined) headers.set('Content-Length', String(contentLength))
    if (object.ContentRange) headers.set('Content-Range', object.ContentRange)
    return new NextResponse(object.Body.transformToWebStream(), { headers, status: requestedRange ? 206 : 200 })
  } catch {
    return new NextResponse('Dokumen tidak tersedia di penyimpanan.', { status: 404 })
  }
}

export async function DELETE(_request: Request, { params }: { params: Promise<{ id: string; fileId: string }> }) {
  if (!isR2Configured()) return NextResponse.json({ error: 'Penyimpanan dokumen belum dikonfigurasi.' }, { status: 503 })

  await requirePermission('spk', 'edit')
  const { id: spkId, fileId } = await params
  const supabase = await createClient()
  const { data: file } = await supabase
    .from('files')
    .select('id, storage_path')
    .eq('id', fileId)
    .eq('spk_id', spkId)
    .eq('status', 'Active')
    .maybeSingle()
  if (!file) return NextResponse.json({ error: 'Dokumen tidak ditemukan.' }, { status: 404 })

  await deleteR2Object(file.storage_path)
  const { error } = await supabase.from('files').update({ status: 'Archived' }).eq('id', file.id)
  if (error) return NextResponse.json({ error: error.message }, { status: 400 })
  return NextResponse.json({ ok: true })
}
