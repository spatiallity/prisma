import { Check, X } from 'lucide-react'
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

/** A plain status badge for chain steps that don't need SLA coloring. */
export function chainBadge(state: ChainStep['state'], label: string) {
  return (
    <Badge tone={state === 'done' ? 'success' : state === 'rejected' ? 'danger' : state === 'current' ? 'primary' : 'neutral'}>
      {label}
    </Badge>
  )
}
