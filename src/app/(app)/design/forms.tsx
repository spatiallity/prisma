'use client'

import { useActionState, useId, useMemo, useRef, useState } from 'react'
import { ArrowRight, Pencil, Plus, Undo2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Field, Input, Select, Textarea } from '@/components/ui/field'
import { Alert } from '@/components/ui/alert'
import { Modal } from '@/components/ui/modal'
import { DeleteButton } from '@/components/ui/delete-button'
import { useActionToast } from '@/components/ui/toast'
import type { DesignPhase, DesignStage } from '@/lib/supabase/types'
import { DESIGN_NEXT_STAGES, PHASE_STAGES } from '@/lib/design'
import { PIC_PERTAMINA_SUGGESTIONS } from '@/lib/pic-pertamina'
import {
  addDesignRevision,
  advanceStage,
  completeStage,
  createDesign,
  deleteRevisionEntry,
  startDesign,
  restoreRevisionEntry,
  updateRevisionEntry,
  type DesignState,
} from './actions'

const initialState: DesignState = { error: null }

export type PicOption = { id: string; label: string }
export type SpkOption = { id: string; label: string }

function Feedback({ state }: { state: DesignState }) {
  if (state.error) return <Alert tone="danger">{state.error}</Alert>
  if (state.success) return <Alert tone="success">{state.success}</Alert>
  return null
}

function Submit({
  label,
  icon,
  variant = 'primary',
  formAction,
  pending = false,
  disabled = false,
  onClick,
}: {
  label: string
  icon?: React.ReactNode
  variant?: 'primary' | 'secondary'
  pending?: boolean
  disabled?: boolean
  /** Routes this button's submit to a different action than the form's own
   *  — used when one form offers two outcomes (Simpan vs Lanjutkan). */
  formAction?: (formData: FormData) => void
  /** Runs before the native submit fires — used to sync a shared hidden
   *  field to whichever target this specific button means (see
   *  StageEntryForm's stageInputRef). A button's own name/value attrs
   *  aren't reliably included in FormData when formAction is a function
   *  reference rather than a URL, so that's not used here. */
  onClick?: () => void
}) {
  return (
    <Button
      type="submit"
      variant={variant}
      disabled={disabled || pending}
      formAction={formAction}
      onClick={onClick}
    >
      {icon}
      {pending ? 'Menyimpan…' : label}
    </Button>
  )
}

/** Free-typed PIC name with autocomplete — a name that doesn't match anyone
 *  in `pics` yet is created automatically when the form is submitted (see
 *  resolvePicId in actions.ts), so there's nothing to "add a PIC" for. */
function PicField({
  label,
  pics,
  defaultValue,
  placeholder,
  className,
}: {
  label: string
  pics: PicOption[]
  defaultValue?: string
  placeholder?: string
  className?: string
}) {
  const id = useId()
  const listId = `${id}-pics`
  return (
    <Field label={label} htmlFor={id} className={className}>
      <Input
        id={id}
        name="pic_name"
        list={listId}
        defaultValue={defaultValue}
        placeholder={placeholder}
        autoComplete="off"
      />
      <datalist id={listId}>
        {pics.map((pic) => (
          <option key={pic.id} value={pic.label} />
        ))}
      </datalist>
    </Field>
  )
}

/** Free-typed PIC Pertamina name, suggested from PIC_PERTAMINA_SUGGESTIONS —
 *  anyone not on that list can still just type their own name. */
function PicPertaminaField({
  label,
  defaultValue,
  placeholder,
}: {
  label: string
  defaultValue?: string
  placeholder?: string
}) {
  const id = useId()
  const listId = `${id}-pic-pertamina`
  return (
    <Field label={label} htmlFor={id}>
      <Input
        id={id}
        name="pic_pertamina"
        list={listId}
        defaultValue={defaultValue}
        placeholder={placeholder}
        autoComplete="off"
      />
      <datalist id={listId}>
        {PIC_PERTAMINA_SUGGESTIONS.map((name) => (
          <option key={name} value={name} />
        ))}
      </datalist>
    </Field>
  )
}

/** Type-to-filter SPK picker — 113+ SPKs is too many to scan in a plain select. */
function SpkCombobox({
  id,
  spks,
  defaultValue,
}: {
  id?: string
  spks: SpkOption[]
  defaultValue?: string
}) {
  const [query, setQuery] = useState('')
  const [selected, setSelected] = useState<SpkOption | null>(
    () => spks.find((s) => s.id === defaultValue) ?? null,
  )
  const [open, setOpen] = useState(false)

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase()
    if (!q) return spks
    return spks.filter((s) => s.label.toLowerCase().includes(q))
  }, [spks, query])

  return (
    <div className="relative">
      <input type="hidden" name="spk_id" value={selected?.id ?? ''} required />
      <Input
        id={id}
        value={selected ? selected.label : query}
        onChange={(event) => {
          setSelected(null)
          setQuery(event.target.value)
          setOpen(true)
        }}
        onFocus={() => setOpen(true)}
        onBlur={() => setTimeout(() => setOpen(false), 150)}
        placeholder="Cari nomor SPK atau nama pekerjaan…"
        autoComplete="off"
      />
      {open && filtered.length > 0 && (
        <ul className="absolute z-10 mt-1 max-h-64 w-full overflow-auto rounded-lg border border-slate-200 bg-surface shadow-lg">
          {filtered.map((spk) => (
            <li key={spk.id}>
              <button
                type="button"
                className="block w-full px-3 py-2 text-left text-sm font-semibold text-slate-900 hover:bg-slate-50"
                onMouseDown={(event) => event.preventDefault()}
                onClick={() => {
                  setSelected(spk)
                  setQuery('')
                  setOpen(false)
                }}
              >
                {spk.label}
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}

export function NewDesignForm({
  spks,
  pics,
  lockedSpkId,
  onSaved,
}: {
  spks: SpkOption[]
  pics: PicOption[]
  lockedSpkId?: string
  onSaved?: () => void
}) {
  const [state, formAction, pending] = useActionState(createDesign, initialState)
  useActionToast(state, onSaved)
  const today = new Date().toISOString().slice(0, 10)

  if (spks.length === 0) {
    return (
      <Alert tone="warning">
        Semua SPK aktif sudah punya record desain, atau belum ada SPK sama sekali.
      </Alert>
    )
  }

  return (
    <form action={formAction} className="grid gap-4">
      <Feedback state={state} />

      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="SPK" htmlFor="d_spk" required className="sm:col-span-2">
          {lockedSpkId ? (
            <>
              <input type="hidden" name="spk_id" value={lockedSpkId} />
              <div className="rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-sm font-bold text-slate-900">
                {spks.find((spk) => spk.id === lockedSpkId)?.label ?? 'SPK ini'}
              </div>
            </>
          ) : (
            <SpkCombobox id="d_spk" spks={spks} />
          )}
        </Field>

        <PicField label="Drafter" pics={pics} placeholder="Nama Drafter" />

        <PicPertaminaField label="PIC Pertamina" placeholder="Reviewer Pertamina" />

        <Field label="Tanggal mulai" htmlFor="d_start" required>
          <Input id="d_start" name="tanggal" type="date" defaultValue={today} required />
        </Field>

        <Field
          label="Data topografi masuk"
          htmlFor="d_topo"
          hint="Kosongkan kalau belum diketahui."
        >
          <Input id="d_topo" name="topo_data_received_at" type="date" />
        </Field>

        <Field label="Catatan" htmlFor="d_notes" className="sm:col-span-2">
          <Textarea id="d_notes" name="notes" rows={3} />
        </Field>
      </div>

      <div>
        <Submit label="Buka record desain" icon={<Plus size={16} aria-hidden />} pending={pending} />
      </div>
    </form>
  )
}

export function AddDesignButton({
  spks,
  pics,
  lockedSpkId,
  label = 'Add Data',
}: {
  spks: SpkOption[]
  pics: PicOption[]
  lockedSpkId?: string
  label?: string
}) {
  const [open, setOpen] = useState(false)
  return (
    <Modal
      open={open}
      onOpenChange={setOpen}
      title="Buka record desain"
      description="Satu SPK punya satu record desain aktif; putaran revisi dicatat di dalamnya."
      trigger={
        <Button type="button">
          <Plus size={16} aria-hidden />
          {label}
        </Button>
      }
    >
      <NewDesignForm spks={spks} pics={pics} lockedSpkId={lockedSpkId} onSaved={() => setOpen(false)} />
    </Modal>
  )
}

/**
 * Section 21 — a stage ends one of two ways, the same two the routing module
 * offers: it passes (Lanjut, which moves the design on and closes the stage),
 * or it needs fixing (Revisi, which logs a round — what to fix, when it comes
 * back — and leaves the design exactly where it is).
 */
export function StageReviewForm({
  designId,
  entryId,
  phase,
  currentStage,
  pics,
  defaultPicPertamina,
}: {
  designId: string
  /** The open design_revisions row — what a Revisi round attaches to. */
  entryId: string | null
  /** Which stages Lanjut may pick from — a design never crosses phases. */
  phase: DesignPhase
  currentStage: DesignStage
  pics: PicOption[]
  defaultPicPertamina: string | null
}) {
  const [mode, setMode] = useState<'lanjut' | 'revisi'>('lanjut')
  const [advanceState, advanceAction, advancePending] = useActionState(advanceStage, initialState)
  const [revisionState, revisionAction, revisionPending] = useActionState(addDesignRevision, initialState)
  useActionToast(advanceState)
  useActionToast(revisionState)
  const stageIndex = PHASE_STAGES[phase].indexOf(currentStage)
  const options = [
    ...DESIGN_NEXT_STAGES[currentStage],
    ...PHASE_STAGES[phase].slice(0, Math.max(0, stageIndex)),
  ]
  const today = new Date().toISOString().slice(0, 10)

  return (
    <div className="grid gap-3">
      <Feedback state={mode === 'lanjut' ? advanceState : revisionState} />

      <Field label="Hasil review" htmlFor="dv_mode">
        <Select
          id="dv_mode"
          value={mode}
          onChange={(e) => setMode(e.target.value as 'lanjut' | 'revisi')}
        >
          <option value="lanjut">Lanjut</option>
          <option value="revisi">Revisi</option>
        </Select>
      </Field>

      {mode === 'lanjut' ? (
        <form action={advanceAction} className="grid gap-3">
          <input type="hidden" name="design_id" value={designId} />

          <Field label="Pindah ke tahap" htmlFor="a_stage" required>
            <Select id="a_stage" name="stage" required>
              {options.map((stage) => (
                <option key={stage} value={stage}>
                  {DESIGN_NEXT_STAGES[currentStage].includes(stage)
                    ? `Lanjut — ${stage}`
                    : `Kembalikan — ${stage}`}
                </option>
              ))}
            </Select>
          </Field>

          <Field label="Tanggal" htmlFor="a_date" required>
            <Input id="a_date" name="tanggal" type="date" defaultValue={today} required />
          </Field>

          <PicField label="Drafter" pics={pics} placeholder="Sama seperti sebelumnya" />

          <PicPertaminaField
            label="PIC Pertamina"
            defaultValue={defaultPicPertamina ?? ''}
            placeholder="Sama seperti sebelumnya"
          />

          <Field label="Catatan" htmlFor="a_notes">
            <Textarea id="a_notes" name="notes" rows={3} placeholder="Hasil review…" />
          </Field>

          <div>
            <Submit label="Selesai &amp; pindahkan" icon={<ArrowRight size={16} aria-hidden />} pending={advancePending} />
          </div>
        </form>
      ) : (
        <form action={revisionAction} className="grid gap-3">
          <input type="hidden" name="design_id" value={designId} />
          <input type="hidden" name="entry_id" value={entryId ?? ''} />

          <Field label="Catatan revisi" htmlFor="dv_note" required>
            <Input id="dv_note" name="note" required placeholder="Yang perlu diperbaiki…" />
          </Field>

          <Field label="Disubmit ulang tanggal" htmlFor="dv_resubmit" required>
            <Input id="dv_resubmit" name="resubmit_at" type="date" defaultValue={today} required />
          </Field>

          <div>
            <Submit label="Catat revisi" variant="secondary" icon={<Undo2 size={16} aria-hidden />} pending={revisionPending} />
          </div>
        </form>
      )}
    </div>
  )
}

/**
 * Section 21 — one form per stage row in the accordion, for the stage's
 * latest entry whether it's the current one or already reached. Two buttons
 * instead of a mode picker: Simpan corrects this entry in place (date,
 * Drafter, PIC Pertamina, Catatan) without moving anything; Lanjutkan closes
 * it and opens the next stage, shown only on the current stage and only when
 * one exists. The target stage defaults to the one true next stage (see
 * DESIGN_NEXT_STAGES) so there's no picker for the common case. "Pilih tahap
 * lain" stays tucked away for a real correction: returning a finished review
 * to a prior stage within the same design phase.
 */
export function StageEntryForm({
  designId,
  phase,
  stage,
  isCurrent,
  entry,
  picName,
  pics,
  previousDrafterName,
  previousPicPertamina,
  canRollback = false,
  onSaved,
}: {
  designId: string
  phase: DesignPhase
  stage: DesignStage
  isCurrent: boolean
  entry: {
    id: string
    started_at: string | null
    pic_id: string | null
    pic_pertamina: string | null
    notes: string | null
  }
  picName: Record<string, string>
  pics: PicOption[]
  /** The stage right before this one's Drafter/PIC Pertamina — the default
   *  when this stage's own entry doesn't have one yet. */
  previousDrafterName?: string
  previousPicPertamina?: string | null
  /** Only the newest history entry can be undone without creating a gap. */
  canRollback?: boolean
  onSaved?: () => void
}) {
  const [saveState, saveAction, savePending] = useActionState(updateRevisionEntry, initialState)
  const [advanceState, advanceAction, advancePending] = useActionState(advanceStage, initialState)
  const [completeState, completeAction, completePending] = useActionState(completeStage, initialState)
  const restoreEntry = async () => {
    const data = new FormData()
    data.set('entry_id', entry.id)
    data.set('design_id', designId)
    data.set('started_at', entry.started_at ?? '')
    data.set('pic_id', entry.pic_id ?? '')
    data.set('pic_pertamina', entry.pic_pertamina ?? '')
    data.set('notes', entry.notes ?? '')
    return restoreRevisionEntry(initialState, data)
  }

  useActionToast(saveState, onSaved, { onUndo: restoreEntry })
  useActionToast(advanceState, onSaved)
  useActionToast(completeState, onSaved)
  const today = new Date().toISOString().slice(0, 10)
  const nextOptions = isCurrent ? DESIGN_NEXT_STAGES[stage] : []
  const stageIndex = PHASE_STAGES[phase].indexOf(stage)
  const previousOptions = isCurrent ? PHASE_STAGES[phase].slice(0, Math.max(0, stageIndex)) : []
  const isTerminal = isCurrent && nextOptions.length === 0
  const [target, setTarget] = useState<string>(nextOptions[0] ?? '')
  const [alternativeTarget, setAlternativeTarget] = useState('')
  const stageInputRef = useRef<HTMLInputElement>(null)
  const drafterName = entry.pic_id ? (picName[entry.pic_id] ?? '') : (previousDrafterName ?? '')
  const anyPending = savePending || advancePending || completePending

  return (
    <form className="grid gap-3">
      <Feedback state={saveState.error ? saveState : advanceState.error ? advanceState : completeState} />
      <input type="hidden" name="design_id" value={designId} />
      <input type="hidden" name="entry_id" value={entry.id} />
      <input type="hidden" name="stage" ref={stageInputRef} defaultValue={target} />

      <Field label="Tanggal mulai" htmlFor={`se_${entry.id}_start`} required>
        <Input
          id={`se_${entry.id}_start`}
          name="tanggal"
          type="date"
          defaultValue={entry.started_at?.slice(0, 10) ?? today}
          required
        />
      </Field>

      <PicField label="Drafter" pics={pics} defaultValue={drafterName} placeholder="Nama Drafter" />

      <PicPertaminaField
        label="PIC Pertamina"
        defaultValue={entry.pic_pertamina ?? previousPicPertamina ?? ''}
        placeholder="Reviewer Pertamina"
      />

      <Field label="Catatan" htmlFor={`se_${entry.id}_notes`}>
        <Textarea
          id={`se_${entry.id}_notes`}
          name="notes"
          rows={3}
          defaultValue={entry.notes ?? ''}
          placeholder={'Satu poin per baris, misalnya:\n- revisi kontur\n- ukuran kertas A1'}
        />
      </Field>

      {isTerminal && (
        <div className="grid gap-3 border-t border-slate-200 pt-3">
          <Field label="Tanggal selesai" htmlFor={`se_${entry.id}_done`} required>
            <Input id={`se_${entry.id}_done`} name="completed_at" type="date" defaultValue={today} required />
          </Field>
          {stage === 'Opname' && (
            <Field label="Nilai Opname" htmlFor={`se_${entry.id}_opname_value`}>
              <Input
                id={`se_${entry.id}_opname_value`}
                name="opname_value"
                inputMode="numeric"
                placeholder="0"
              />
            </Field>
          )}
        </div>
      )}

      {isCurrent && nextOptions.length > 0 && (
        <div className="grid gap-3 border-t border-slate-200 pt-3">
          <Field label="Tanggal selesai" htmlFor={`se_${entry.id}_done`} required>
            <Input id={`se_${entry.id}_done`} name="completed_at" type="date" defaultValue={today} required />
          </Field>

          {nextOptions.length > 1 ? (
            <Field label="Hasil review" htmlFor={`se_${entry.id}_target`}>
              <Select
                id={`se_${entry.id}_target`}
                value={target}
                onChange={(e) => setTarget(e.target.value)}
              >
                {nextOptions.map((s) => (
                  <option key={s} value={s}>
                    {s === 'Revisi Desain Awal' ? 'Perlu revisi' : `Lanjut — ${s}`}
                  </option>
                ))}
              </Select>
            </Field>
          ) : (
            <p className="text-xs text-muted-foreground">
              Lanjut ke <strong className="text-slate-900">{target}</strong>
            </p>
          )}

        </div>
      )}

      <div className="flex flex-wrap gap-2">
        <Submit label="Simpan" variant="secondary" formAction={saveAction} pending={savePending} disabled={anyPending} />
        {isCurrent && nextOptions.length > 0 && (
          <Submit
            label="Lanjutkan ke Tahap Selanjutnya"
            icon={<ArrowRight size={16} aria-hidden />}
            formAction={advanceAction}
            pending={advancePending}
            disabled={anyPending}
            onClick={() => {
              if (stageInputRef.current) stageInputRef.current.value = target
            }}
          />
        )}
        {isTerminal && (
          <Submit
            label="Selesaikan"
            icon={<ArrowRight size={16} aria-hidden />}
            formAction={completeAction}
            pending={completePending}
            disabled={anyPending}
          />
        )}
        {canRollback && (
          <DeleteRevisionEntryButton designId={designId} entryId={entry.id} />
        )}
      </div>

      {isCurrent && previousOptions.length > 0 && (
        <details className="border-t border-slate-200 pt-3">
          <summary className="cursor-pointer text-sm font-bold text-primary">Pilih tahap lain</summary>
          <div className="mt-3 grid gap-3">
            <Field label="Kembalikan ke tahap" htmlFor={`se_${entry.id}_alternative_target`}>
              <Select
                id={`se_${entry.id}_alternative_target`}
                value={alternativeTarget}
                onChange={(event) => setAlternativeTarget(event.target.value)}
              >
                <option value="">Pilih tahap sebelumnya</option>
                {previousOptions.map((option) => (
                  <option key={option} value={option}>
                    {option}
                  </option>
                ))}
              </Select>
            </Field>
            <div>
              <Submit
                label="Pindahkan ke tahap pilihan"
                variant="secondary"
                formAction={advanceAction}
                pending={advancePending}
                disabled={anyPending || !alternativeTarget}
                onClick={() => {
                  if (stageInputRef.current) stageInputRef.current.value = alternativeTarget
                }}
              />
            </div>
          </div>
        </details>
      )}
    </form>
  )
}

/**
 * Section 21 — an auto-opened Draft has no revision history yet, so it gets
 * a plain "Mulai" form instead of the Lanjut/Revisi review: there's nothing
 * to review until someone actually starts the stage it opened at.
 */
export function StartDesignForm({
  designId,
  phase,
  currentStage,
  pics,
}: {
  designId: string
  phase: DesignPhase
  currentStage: DesignStage
  pics: PicOption[]
}) {
  const [state, formAction, pending] = useActionState(startDesign, initialState)
  useActionToast(state)
  const today = new Date().toISOString().slice(0, 10)

  return (
    <form action={formAction} className="grid gap-3">
      <Feedback state={state} />
      <input type="hidden" name="design_id" value={designId} />

      <div>
        <div className="text-sm font-semibold text-slate-700">Tahap</div>
        <div className="mt-1 text-sm font-bold text-slate-900">{currentStage}</div>
      </div>

      <Field label="Tanggal" htmlFor="s_date" required>
        <Input id="s_date" name="tanggal" type="date" defaultValue={today} required />
      </Field>

      {phase === 'siteplan' && (
        <Field
          label="Data topografi masuk"
          htmlFor="s_topo"
          hint="Kosongkan kalau belum diketahui."
        >
          <Input id="s_topo" name="topo_data_received_at" type="date" />
        </Field>
      )}

      <PicField label="Drafter" pics={pics} placeholder="Nama Drafter" />

      <PicPertaminaField label="PIC Pertamina" placeholder="Reviewer Pertamina" />

      <div>
        <Submit label="Mulai pengerjaan" icon={<Plus size={16} aria-hidden />} pending={pending} />
      </div>
    </form>
  )
}

/** Fixes tanggal/Drafter/catatan on one history row — never the stage itself
 *  (see updateRevisionEntry in actions.ts for why). Still used standalone on
 *  the /design/[id] page; the popup now edits a stage's entry inline via
 *  StageEntryForm instead of this nested modal. */
export function EditRevisionEntryButton({
  designId,
  pics,
  entry,
}: {
  designId: string
  pics: PicOption[]
  entry: {
    id: string
    started_at: string | null
    notes: string | null
    pic_pertamina: string | null
  }
}) {
  const [open, setOpen] = useState(false)
  const [state, formAction, pending] = useActionState(updateRevisionEntry, initialState)
  useActionToast(state, () => setOpen(false))

  return (
    <Modal
      open={open}
      onOpenChange={setOpen}
      title="Edit entri tahap"
      trigger={
        <button
          type="button"
          className="inline-flex items-center gap-1 text-xs font-bold text-primary hover:underline"
          aria-label="Edit entri"
        >
          <Pencil size={12} aria-hidden />
          Edit
        </button>
      }
    >
      <form action={formAction} className="grid gap-3">
        {state.error && <Alert tone="danger">{state.error}</Alert>}
        <input type="hidden" name="entry_id" value={entry.id} />
        <input type="hidden" name="design_id" value={designId} />

        <Field label="Tanggal" htmlFor="e_tanggal" required>
          <Input
            id="e_tanggal"
            name="tanggal"
            type="date"
            defaultValue={entry.started_at?.slice(0, 10)}
            required
          />
        </Field>

        <PicField label="Drafter" pics={pics} placeholder="Nama Drafter" />

        <PicPertaminaField
          label="PIC Pertamina"
          defaultValue={entry.pic_pertamina ?? ''}
          placeholder="Reviewer Pertamina"
        />

        <Field label="Catatan" htmlFor="e_notes">
          <Textarea id="e_notes" name="notes" rows={3} defaultValue={entry.notes ?? ''} />
        </Field>

        <div className="flex justify-end gap-2">
          <Button type="button" variant="secondary" onClick={() => setOpen(false)}>
            Batal
          </Button>
          <Submit label="Simpan" pending={pending} />
        </div>
      </form>
    </Modal>
  )
}

/** Only ever shown for the latest history row — see deleteRevisionEntry. */
export function DeleteRevisionEntryButton({
  designId,
  entryId,
}: {
  designId: string
  entryId: string
}) {
  return (
    <DeleteButton
      action={deleteRevisionEntry}
      hiddenFields={{ entry_id: entryId, design_id: designId }}
      itemLabel="tahap terakhir ini"
      confirmText="Batalkan tahap terakhir ini? Desain kembali ke tahap sebelumnya, dan progress SPK yang sudah tersinkron dari tahap ini ikut dibatalkan."
    />
  )
}

