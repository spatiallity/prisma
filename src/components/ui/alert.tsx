import * as React from 'react'
import { AlertTriangle, CheckCircle2, Info, XCircle } from 'lucide-react'
import { cn } from '@/lib/utils'

type Tone = 'info' | 'success' | 'warning' | 'danger'

const tones: Record<Tone, { box: string; Icon: typeof Info }> = {
  info: { box: 'border-blue-200 bg-primary-soft text-primary', Icon: Info },
  success: {
    box: 'border-green-200 bg-green-50 text-success',
    Icon: CheckCircle2,
  },
  warning: {
    box: 'border-amber-200 bg-amber-50 text-warning',
    Icon: AlertTriangle,
  },
  danger: { box: 'border-red-200 bg-red-50 text-danger', Icon: XCircle },
}

export function Alert({
  tone = 'info',
  title,
  children,
  className,
}: {
  tone?: Tone
  title?: string
  children?: React.ReactNode
  className?: string
}) {
  const { box, Icon } = tones[tone]
  return (
    <div
      role="alert"
      className={cn('flex gap-3 rounded-lg border px-4 py-3 text-sm', box, className)}
    >
      <Icon className="mt-0.5 h-4 w-4 shrink-0" aria-hidden />
      <div className="min-w-0 space-y-1">
        {title && <p className="font-bold">{title}</p>}
        {children && <div className="font-medium text-slate-700">{children}</div>}
      </div>
    </div>
  )
}
