import Link from 'next/link'
import { cn } from '@/lib/utils'
import { PHASE_STAGES, PHASE_TERMINAL_STAGE } from '@/lib/design'
import type { DesignPhase } from '@/lib/supabase/types'

/** Filter chips for the Desain Siteplan / Finalisasi Desain lists: default
 *  "Berjalan" (everything short of the terminal stage), "Semua", or one
 *  specific stage (including the terminal one, e.g. "sudah Finish"). */
export function StageFilterChips({
  phase,
  basePath,
  active,
}: {
  phase: DesignPhase
  basePath: string
  active?: string
}) {
  const current = active ?? 'ongoing'
  const options = [
    { value: 'ongoing', label: 'Berjalan' },
    ...PHASE_STAGES[phase].map((stage) => ({
      value: stage,
      label: stage === PHASE_TERMINAL_STAGE[phase] ? `Sudah ${stage}` : stage,
    })),
    { value: 'all', label: 'Semua' },
  ]

  return (
    <div className="mb-4 flex flex-wrap gap-2">
      {options.map((opt) => {
        const isActive = current === opt.value
        return (
          <Link
            key={opt.value}
            href={opt.value === 'ongoing' ? basePath : `${basePath}?stage=${encodeURIComponent(opt.value)}`}
            className={cn(
              'rounded-full border px-3 py-1.5 text-xs font-bold transition-colors',
              isActive
                ? 'border-primary bg-primary-soft text-primary'
                : 'border-slate-200 bg-surface text-slate-600 hover:border-primary/40',
            )}
          >
            {opt.label}
          </Link>
        )
      })}
    </div>
  )
}
