import { NextResponse } from 'next/server'
import { deleteR2Object, headR2Object, isR2Configured } from '@/lib/cloudflare/r2'
import { requirePermission } from '@/lib/auth/session'
import { createClient } from '@/lib/supabase/server'

export const runtime = 'nodejs'

const MODULES = ['survey', 'design', 'routing', 'report', 'map', 'financial', 'other'] as const

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  if (!isR2Configured()) return NextResponse.json({ error: 'Penyimpanan dokumen belum dikonfigurasi.' }, { status: 503 })

  const user = await requirePermission('spk', 'edit')
  const { id: spkId } = await params
  const body = await request.json().catch(() => null) as {
    storagePath?: string; filename?: string; module?: (typeof MODULES)[number]; description?: string; replaceFileId?: string
  } | null
  const category = body?.module

  if (!body?.storagePath || !body.filename || !category || !MODULES.includes(category)) {
    return NextResponse.json({ error: 'Data dokumen tidak lengkap.' }, { status: 400 })
  }
  if (!body.storagePath.startsWith(`spk/${spkId}/${category}/`)) {
    return NextResponse.json({ error: 'Lokasi dokumen tidak sesuai.' }, { status: 400 })
  }

  const supabase = await createClient()
  const { data: spk } = await supabase.from('spks').select('id').eq('id', spkId).maybeSingle()
  if (!spk) return NextResponse.json({ error: 'SPK tidak ditemukan atau tidak dapat diubah.' }, { status: 404 })

  const { data: currentFile } = await supabase
    .from('files')
    .select('id, storage_path')
    .eq('spk_id', spkId)
    .eq('module', 'other')
    .eq('status', 'Active')
    .order('uploaded_at', { ascending: false })
    .limit(1)
    .maybeSingle()
  if (currentFile && body.replaceFileId !== currentFile.id) {
    return NextResponse.json({ error: 'File SPK sudah ada. Gunakan tombol ganti file.' }, { status: 409 })
  }

  let object
  try {
    object = await headR2Object(body.storagePath)
  } catch {
    return NextResponse.json({ error: 'File belum selesai diunggah. Coba unggah kembali.' }, { status: 400 })
  }

  if (object.ContentType !== 'application/pdf') {
    return NextResponse.json({ error: 'Hanya dokumen PDF yang dapat disimpan.' }, { status: 400 })
  }

  const { data, error } = await supabase
    .from('files')
    .insert({
      spk_id: spkId,
      module: category,
      filename: body.filename.slice(0, 255),
      storage_path: body.storagePath,
      file_type: object.ContentType,
      size_bytes: Number(object.ContentLength ?? 0),
      description: body.description?.trim().slice(0, 1000) || null,
      uploaded_by: user.id,
    })
    .select('id, filename, module, file_type, size_bytes, description, uploaded_at')
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 400 })
  if (currentFile) {
    await deleteR2Object(currentFile.storage_path).catch(() => undefined)
    await supabase.from('files').update({ status: 'Archived' }).eq('id', currentFile.id)
  }
  return NextResponse.json({ document: data }, { status: 201 })
}
