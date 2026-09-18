'use client'

import { useActionState, useEffect, useRef, useState } from 'react'
import { useFormStatus } from 'react-dom'
import { FileText, LoaderCircle, Upload, X } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Field, Input, Select, Textarea, useRestoreFormValues } from '@/components/ui/field'
import { Alert } from '@/components/ui/alert'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { useActionToast } from '@/components/ui/toast'
import { SPK_STATUSES, type SpkRow } from '@/lib/supabase/types'
import { LOCATION_TYPE_OPTIONS, WORK_TYPE_OPTIONS, spkStatusLabel } from '@/lib/spk'
import type { SpkFormState } from './actions'

const initialState: SpkFormState = { error: null }

function Submit({ label, disabled }: { label: string; disabled?: boolean }) {
  const { pending } = useFormStatus()
  return (
    <Button type="submit" disabled={pending || disabled}>
      {pending ? 'Menyimpan…' : label}
    </Button>
  )
}

/**
 * Section 11 — data dasar SPK. The same form serves create and edit; only the
 * server action differs.
 */
export function SpkForm({
  action,
  submitLabel,
  spk,
  stakeOutTarget,
  allowInitialFileUpload = false,
}: {
  action: (state: SpkFormState, formData: FormData) => Promise<SpkFormState>
  submitLabel: string
  spk?: SpkRow
  /** Current "Stake Out" activity target (jumlah titik), when editing one. */
  stakeOutTarget?: number | null
  /** New SPKs may receive their single primary PDF during creation. */
  allowInitialFileUpload?: boolean
}) {
  const [state, formAction] = useActionState(action, initialState)
  useActionToast(state)
  const formRef = useRef<HTMLFormElement>(null)
  useRestoreFormValues(formRef, state.values)
  const [workType, setWorkType] = useState(spk?.work_type ?? '')
  const [initialFile, setInitialFile] = useState<File | null>(null)
  const [uploadingFile, setUploadingFile] = useState(false)
  const [fileUploadError, setFileUploadError] = useState<string | null>(null)
  const uploadStarted = useRef(false)
  const isStakeOut = workType === 'Stake Out'

  useEffect(() => {
    if (!state.spkId || !initialFile || uploadStarted.current) return

    const fileToUpload = initialFile
    uploadStarted.current = true
    setUploadingFile(true)
    setFileUploadError(null)

    async function uploadInitialFile() {
      try {
        const prepared = await fetch(`/api/spk/${state.spkId}/documents/upload-url`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            filename: fileToUpload.name,
            contentType: fileToUpload.type,
            sizeBytes: fileToUpload.size,
            module: 'other',
          }),
        })
        const preparation = await prepared.json()
        if (!prepared.ok) throw new Error(preparation.error ?? 'URL unggah tidak dapat dibuat.')

        const sent = await fetch(preparation.uploadUrl, {
          method: 'PUT',
          headers: { 'Content-Type': fileToUpload.type },
          body: fileToUpload,
        })
        if (!sent.ok) throw new Error('File gagal diunggah ke penyimpanan.')

        const saved = await fetch(`/api/spk/${state.spkId}/documents`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            storagePath: preparation.storagePath,
            filename: preparation.filename,
            module: 'other',
          }),
        })
        const result = await saved.json()
        if (!saved.ok) throw new Error(result.error ?? 'File SPK gagal disimpan.')

        window.location.assign(`/spk/${state.spkId}?created=1`)
      } catch (reason) {
        setFileUploadError(reason instanceof Error ? reason.message : 'File SPK gagal diunggah.')
      } finally {
        setUploadingFile(false)
      }
    }

    void uploadInitialFile()
  }, [initialFile, state.spkId])

  function chooseInitialFile(file: File | null) {
    if (!file) {
      setInitialFile(null)
      return
    }
    if (file.type !== 'application/pdf') {
      setFileUploadError('Hanya file PDF yang dapat diunggah.')
      return
    }
    if (file.size > 50 * 1024 * 1024) {
      setFileUploadError('Ukuran PDF maksimal 50 MB.')
      return
    }
    setFileUploadError(null)
    setInitialFile(file)
  }

  return (
    <form ref={formRef} action={formAction} className="grid gap-5">
      {spk && <input type="hidden" name="id" value={spk.id} />}
      {allowInitialFileUpload && <input type="hidden" name="create_with_file" value={initialFile ? '1' : '0'} />}

      {state.error && <Alert tone="danger">{state.error}</Alert>}
      {state.success && <Alert tone="success">{state.success}</Alert>}
      {fileUploadError && (
        <Alert tone="danger">
          {fileUploadError}{' '}
          {state.spkId && <a className="font-bold underline" href={`/spk/${state.spkId}`}>Buka SPK untuk mencoba unggah lagi.</a>}
        </Alert>
      )}
      {uploadingFile && <Alert tone="info">SPK sudah dibuat. PDF sedang diunggah, jangan tutup halaman ini.</Alert>}

      <Card>
        <CardHeader>
          <CardTitle>Identitas</CardTitle>
          <p className="text-sm text-muted-foreground">Nomor, kode lokasi, dan jenis pekerjaan SPK.</p>
        </CardHeader>
        <CardContent className="grid gap-4 sm:grid-cols-2">
          <Field label="Nomor SPK" htmlFor="spk_number" required>
            <Input
              id="spk_number"
              name="spk_number"
              defaultValue={spk?.spk_number}
              placeholder="SPK-2026-001"
              required
            />
          </Field>

          <Field label="Kode Lokasi" htmlFor="site_code" required>
            <Input
              id="site_code"
              name="site_code"
              defaultValue={spk?.site_code ?? ''}
              placeholder="BNG-A03"
              required
            />
          </Field>

          <Field label="Nama pekerjaan" htmlFor="work_name" required className="sm:col-span-2">
            <Input
              id="work_name"
              name="work_name"
              defaultValue={spk?.work_name}
              placeholder="Survei Topografi Lokasi Bor …"
              required
            />
          </Field>

          <Field label="Jenis pekerjaan" htmlFor="work_type">
            {spk ? (
              <Input
                id="work_type"
                name="work_type"
                defaultValue={spk.work_type ?? ''}
                readOnly
                className="bg-slate-50 text-muted-foreground"
              />
            ) : (
              <Select
                id="work_type"
                name="work_type"
                value={workType}
                onChange={(event) => setWorkType(event.target.value)}
              >
                <option value="">— pilih jenis pekerjaan —</option>
                {WORK_TYPE_OPTIONS.map((option) => (
                  <option key={option} value={option}>
                    {option}
                  </option>
                ))}
              </Select>
            )}
          </Field>

          {isStakeOut && (
            <Field label="Jumlah Patok" htmlFor="stake_out_target">
              <Input
                id="stake_out_target"
                name="stake_out_target"
                inputMode="numeric"
                defaultValue={stakeOutTarget ?? ''}
                placeholder="50"
              />
            </Field>
          )}

          <Field label="Jenis Lokasi" htmlFor="location_type">
            <Select id="location_type" name="location_type" defaultValue={spk?.location_type ?? ''}>
              <option value="">— pilih jenis lokasi —</option>
              {LOCATION_TYPE_OPTIONS.map((option) => (
                <option key={option} value={option}>
                  {option}
                </option>
              ))}
            </Select>
          </Field>

          <Field label="Status" htmlFor="status">
            <Select id="status" name="status" defaultValue={spk?.status ?? 'Draft'}>
              {SPK_STATUSES.map((status) => (
                <option key={status} value={status}>
                  {spkStatusLabel(status)}
                </option>
              ))}
            </Select>
          </Field>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Lokasi &amp; volume</CardTitle>
          <p className="text-sm text-muted-foreground">Informasi lokasi, cakupan pekerjaan, dan jadwal pelaksanaan.</p>
        </CardHeader>
        <CardContent className="grid gap-4 sm:grid-cols-2">
          <Field label="Desa" htmlFor="location" required className="sm:col-span-2">
            <Input id="location" name="location" defaultValue={spk?.location ?? ''} required />
          </Field>

          <Field label="Kabupaten/Kota" htmlFor="kabupaten">
            <Input id="kabupaten" name="kabupaten" defaultValue={spk?.kabupaten ?? ''} />
          </Field>

          <Field label="Provinsi" htmlFor="provinsi">
            <Input id="provinsi" name="provinsi" defaultValue={spk?.provinsi ?? ''} />
          </Field>

          <Field label="Luas area (Ha)" htmlFor="area_ha">
            <Input
              id="area_ha"
              name="area_ha"
              inputMode="decimal"
              defaultValue={spk?.area_ha ?? ''}
              placeholder="12.06"
            />
          </Field>

          <Field label="Nilai kontrak (Rp)" htmlFor="contract_value">
            <Input
              id="contract_value"
              name="contract_value"
              inputMode="numeric"
              defaultValue={spk?.contract_value ?? ''}
              placeholder="500000000"
            />
          </Field>

          <Field label="Tanggal mulai" htmlFor="start_date">
            <Input
              id="start_date"
              name="start_date"
              type="date"
              defaultValue={spk?.start_date ?? ''}
            />
          </Field>

          <Field label="Tanggal selesai" htmlFor="end_date">
            <Input
              id="end_date"
              name="end_date"
              type="date"
              defaultValue={spk?.end_date ?? ''}
            />
          </Field>
        </CardContent>
      </Card>

      {allowInitialFileUpload && (
        <Card>
          <CardHeader>
            <CardTitle>File SPK</CardTitle>
            <p className="text-sm text-muted-foreground">Opsional. Unggah satu PDF utama hingga 50 MB; nama file akan dibuat otomatis berdasarkan kode lokasi.</p>
          </CardHeader>
          <CardContent>
            {initialFile ? (
              <div className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-primary/25 bg-primary-soft px-4 py-3">
                <div className="flex min-w-0 items-center gap-3">
                  <span className="grid h-9 w-9 shrink-0 place-items-center rounded-md bg-white text-primary shadow-sm"><FileText size={18} aria-hidden /></span>
                  <div className="min-w-0">
                    <p className="truncate text-sm font-bold text-slate-900">{initialFile.name}</p>
                    <p className="text-xs text-muted-foreground">{new Intl.NumberFormat('id-ID', { maximumFractionDigits: 1 }).format(initialFile.size / 1024 / 1024)} MB · akan disimpan sebagai SPK_&lt;kode lokasi&gt;.pdf</p>
                  </div>
                </div>
                <Button type="button" variant="ghost" size="sm" onClick={() => setInitialFile(null)} title="Hapus file pilihan">
                  <X size={16} aria-hidden /> Hapus
                </Button>
              </div>
            ) : (
              <Field label="Pilih PDF SPK" htmlFor="initial-spk-file">
                <Input
                  id="initial-spk-file"
                  type="file"
                  accept="application/pdf"
                  onChange={(event) => chooseInitialFile(event.target.files?.[0] ?? null)}
                />
              </Field>
            )}
          </CardContent>
        </Card>
      )}

      <Card>
        <CardHeader>
          <CardTitle>Catatan</CardTitle>
          <p className="text-sm text-muted-foreground">Tambahkan keterangan yang perlu diketahui tim.</p>
        </CardHeader>
        <CardContent>
          <Field label="Keterangan" htmlFor="notes">
            <Textarea id="notes" name="notes" defaultValue={spk?.notes ?? ''} />
          </Field>
        </CardContent>
      </Card>

      <div className="flex flex-wrap items-center gap-3 border-t border-slate-200 pt-5">
        <Submit label={uploadingFile ? 'Mengunggah file…' : submitLabel} disabled={uploadingFile || Boolean(state.spkId)} />
        {allowInitialFileUpload && !uploadingFile && !state.spkId && initialFile && (
          <span className="inline-flex items-center gap-1.5 text-sm text-muted-foreground"><Upload size={15} aria-hidden /> PDF akan diunggah setelah SPK disimpan.</span>
        )}
        {uploadingFile && <LoaderCircle className="animate-spin text-primary" size={18} aria-label="Mengunggah file" />}
      </div>
    </form>
  )
}
