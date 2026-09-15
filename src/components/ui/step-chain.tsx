import { Check, ChevronDown, X } from 'lucide-react'
import { Badge } from './badge'
import { cn } from '@/lib/utils'

export type ChainStep = {
  key: string
  label: string
  /** Small text under the label — PIC, dates, notes, etc. */
  sub?: React.ReactNode
  state: 'done' | 'current' | 'rejected' | 'pending'
  badge?: React.ReactNode
  /** Right-aligned, under the badge — e.g. elapsed days. */
  meta?: React.ReactNode
  /** Right-aligned, next to the badge — an edit icon/button, kept out of the
   *  label column so a long form under `sub` never pushes it sideways. */
  action?: React.ReactNode
}

/** The chain-of-circles look used everywhere a document or SPK moves through
 *  a fixed sequence of stages: routing steps, Survei Lapangan, Design, the
 *  Contract → Invoice money chain. */
export function StepChain({ steps }: { steps: ChainStep[] }) {
  return (
    <ol className="grid">
      {steps.map((step, index) => {
        const last = index === steps.length - 1
        return (
          <li key={step.key} className="grid grid-cols-[26px_1fr_auto] gap-3">
            <div className="flex flex-col items-center">
              <span
                className={cn(
                  'grid h-6 w-6 shrink-0 place-items-center rounded-full border-2 text-[10px] font-extrabold',
                  step.state === 'done'
                    ? 'border-success bg-success text-white'
                    : step.state === 'rejected'
                      ? 'border-danger bg-danger text-white'
                      : step.state === 'current'
                        ? 'border-primary bg-primary text-white'
                        : 'border-slate-200 bg-white text-slate-400',
                )}
              >
                {step.state === 'done' ? (
                  <Check size={12} aria-hidden />
                ) : step.state === 'rejected' ? (
                  <X size={12} aria-hidden />
                ) : (
                  index + 1
                )}
              </span>
              {!last && (
                <span
                  className={cn('w-0.5 flex-1', step.state === 'done' ? 'bg-success' : 'bg-slate-200')}
                  style={{ minHeight: 28 }}
                  aria-hidden
                />
              )}
            </div>

            <div className={cn('pb-5', last && 'pb-0')}>
              <div className="text-sm font-bold text-slate-900">{step.label}</div>
              {step.sub && <div className="text-xs text-muted-foreground">{step.sub}</div>}
            </div>

            <div className="flex items-start gap-2 pb-5">
              <div className="flex flex-col items-end gap-1">
                {step.badge}
                {step.meta}
              </div>
              {step.action}
            </div>
          </li>
        )
      })}
    </ol>
  )
}

/** The one set of status words used everywhere a chain step's state is shown
 *  as text: Not Yet (not reached/not started), In Progress (the active
 *  step), Done, Rejected. Never "Draft", "Selesai", "Sudah", "Berjalan", or
 *  "On Going" — those were the same four states spelled differently per
 *  module. */
export function chainStatusLabel(state: ChainStep['state']) {
  switch (state) {
    case 'done':
      return 'Done'
    case 'current':
      return 'In Progress'
    case 'rejected':
      return 'Rejected'
    default:
      return 'Not Yet'
  }
}

/** Renders a Catatan textarea's text as bullet points — one per line, blank
 *  lines dropped, a leading "-"/"•" stripped since the bullet itself already
 *  supplies it. Used everywhere a stage/step's notes are shown, so a
 *  paragraph typed with line breaks reads as a list, not one run-on line. */
export function NotesList({ text }: { text: string | null | undefined }) {
  if (!text) return null
  const lines = text
    .split('\n')
    .map((line) => line.replace(/^[\s]*[-•]\s*/, '').trim())
    .filter(Boolean)
  if (lines.length === 0) return null
  return (
    <ul className="mt-1 grid list-disc gap-0.5 pl-4">
      {lines.map((line, i) => (
        <li key={i}>{line}</li>
      ))}
    </ul>
  )
}

export type AccordionStep = {
  key: string
  label: string
  state: ChainStep['state']
  badge?: React.ReactNode
  /** Shown under the label whether the row is open or closed — dates, PIC,
   *  notes, past rounds. */
  summary?: React.ReactNode
  /** The edit form — only rendered while this row is the open one. */
  content?: React.ReactNode
  /** Not clickable yet — the step before it isn't done. */
  locked?: boolean
}

/** The vertical rantai for a stage flow where each step is edited in place:
 *  click a row to expand its form, fill it in, the next row unlocks once
 *  this one is done. One row open at a time, like StepChain's circles but
 *  each row is its own little accordion instead of a separate popup. */
export function AccordionChain({
  steps,
  openKey,
  onToggle,
}: {
  steps: AccordionStep[]
  openKey: string | null
  onToggle: (key: string) => void
}) {
  return (
    <ol className="grid">
      {steps.map((step, index) => {
        const last = index === steps.length - 1
        const open = step.key === openKey
        return (
          <li key={step.key} className="grid grid-cols-[26px_1fr] gap-3">
            <div className="flex flex-col items-center">
              <span
                className={cn(
                  'grid h-6 w-6 shrink-0 place-items-center rounded-full border-2 text-[10px] font-extrabold',
                  step.state === 'done'
                    ? 'border-success bg-success text-white'
                    : step.state === 'rejected'
                      ? 'border-danger bg-danger text-white'
                      : step.state === 'current'
                        ? 'border-primary bg-primary text-white'
                        : 'border-slate-200 bg-white text-slate-400',
                )}
              >
                {step.state === 'done' ? (
                  <Check size={12} aria-hidden />
                ) : step.state === 'rejected' ? (
                  <X size={12} aria-hidden />
                ) : (
                  index + 1
                )}
              </span>
              {!last && (
                <span
                  className={cn('w-0.5 flex-1', step.state === 'done' ? 'bg-success' : 'bg-slate-200')}
                  style={{ minHeight: 20 }}
                  aria-hidden
                />
              )}
            </div>

            <div className={cn('pb-4', last && 'pb-0')}>
              <button
                type="button"
                disabled={step.locked}
                onClick={() => onToggle(step.key)}
                className={cn(
                  'flex w-full items-center justify-between gap-3 rounded-lg py-1 text-left',
                  step.locked ? 'cursor-not-allowed opacity-50' : 'hover:bg-slate-50',
                )}
              >
                <div className="min-w-0">
                  <div className="text-sm font-bold text-slate-900">{step.label}</div>
                  {step.summary && <div className="text-xs text-muted-foreground">{step.summary}</div>}
                </div>
                <div className="flex shrink-0 items-center gap-2">
                  {step.badge ?? chainBadge(step.state)}
                  {!step.locked && (
                    <ChevronDown
                      size={16}
                      className={cn('text-slate-400 transition-transform', open && 'rotate-180')}
                      aria-hidden
                    />
                  )}
                </div>
              </button>
              {open && step.content && (
                <div className="mt-2 rounded-lg border border-slate-200 bg-slate-50/60 p-3">
                  {step.content}
                </div>
              )}
            </div>
          </li>
        )
      })}
    </ol>
  )
}

/** A plain status badge for chain steps that don't need SLA coloring. Omit
 *  `label` to use the standard word for `state` — only pass one to show
 *  something more specific (e.g. the underlying document status). */
export function chainBadge(state: ChainStep['state'], label?: string) {
  return (
    <Badge tone={state === 'done' ? 'success' : state === 'rejected' ? 'danger' : state === 'current' ? 'primary' : 'neutral'}>
      {label ?? chainStatusLabel(state)}
    </Badge>
  )
}
