import { randomUUID } from 'crypto'
import { NextResponse } from 'next/server'
import { createUploadUrl, isR2Configured, R2_MAX_FILE_SIZE } from '@/lib/cloudflare/r2'
import { requirePermission } from '@/lib/auth/session'
import { createClient } from '@/lib/supabase/server'

export const runtime = 'nodejs'

const MODULES = ['survey', 'design', 'routing', 'report', 'map', 'financial', 'other'] as const
type FileModule = (typeof MODULES)[number]

function spkFileName(siteCode: string) {
  const cleaned = siteCode.normalize('NFKD').replace(/[^a-zA-Z0-9 ._-]+/g, '').replace(/\s+/g, ' ').trim().slice(0, 120)
  return `${cleaned || 'SPK'}.pdf`
}

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  if (!isR2Configured()) {
    return NextResponse.json({ error: 'Penyimpanan dokumen belum dikonfigurasi.' }, { status: 503 })
  }

  const user = await requirePermission('spk', 'edit')
  const { id: spkId } = await params
  const body = await request.json().catch(() => null) as {
    filename?: string; contentType?: string; sizeBytes?: number; module?: FileModule
  } | null

  if (!body || !body.filename || body.contentType !== 'application/pdf' || !Number.isFinite(body.sizeBytes)) {
    return NextResponse.json({ error: 'Pilih dokumen PDF yang valid.' }, { status: 400 })
  }
  const sizeBytes = body.sizeBytes
  if (sizeBytes === undefined || sizeBytes <= 0 || sizeBytes > R2_MAX_FILE_SIZE) {
    return NextResponse.json({ error: 'Ukuran PDF maksimal 50 MB.' }, { status: 400 })
  }
  if (!MODULES.includes(body.module ?? 'other')) {
    return NextResponse.json({ error: 'Kategori dokumen tidak valid.' }, { status: 400 })
  }

  const supabase = await createClient()
  const { data: spk } = await supabase.from('spks').select('id, site_code, spk_number').eq('id', spkId).maybeSingle()
  if (!spk) return NextResponse.json({ error: 'SPK tidak ditemukan atau tidak dapat diubah.' }, { status: 404 })

  const category = body.module ?? 'other'
  const filename = spkFileName(spk.site_code || spk.spk_number)
  const storagePath = `spk/${spkId}/${category}/${randomUUID()}-${filename}`
  const uploadUrl = await createUploadUrl(storagePath, body.contentType)

  return NextResponse.json({ uploadUrl, storagePath, filename, module: category, uploadedBy: user.id })
}
