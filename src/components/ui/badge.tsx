import * as React from 'react'
import { cn } from '@/lib/utils'

type Tone = 'neutral' | 'primary' | 'success' | 'warning' | 'danger' | 'info'

const tones: Record<Tone, string> = {
  neutral: 'bg-slate-100 text-slate-600 border-slate-200',
  primary: 'bg-primary-soft text-primary border-blue-200',
  success: 'bg-green-50 text-success border-green-200',
  warning: 'bg-amber-50 text-warning border-amber-200',
  danger: 'bg-red-50 text-danger border-red-200',
  info: 'bg-primary-soft text-info border-blue-200',
}

export function Badge({
  tone = 'neutral',
  className,
  ...props
}: React.HTMLAttributes<HTMLSpanElement> & { tone?: Tone }) {
  return (
    <span
      className={cn(
        'inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-xs font-bold whitespace-nowrap',
        tones[tone],
        className,
      )}
      {...props}
    />
  )
}

/** Section 4.4 — records are deactivated, never deleted. */
export function StatusBadge({ status }: { status: string }) {
  const tone: Tone =
    status === 'Active'
      ? 'success'
      : status === 'Inactive'
        ? 'warning'
        : 'neutral'
  return <Badge tone={tone}>{status}</Badge>
}

/** Red counter pill used on nav items, matching the reference app. */
export function CountBadge({ count }: { count: number }) {
  if (count <= 0) return null
  return (
    <span className="flex h-6 min-w-6 shrink-0 items-center justify-center rounded-full bg-red-600 px-1.5 text-[11px] leading-none font-extrabold text-white">
      {count > 99 ? '99+' : count}
    </span>
  )
}
