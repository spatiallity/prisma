import * as React from 'react'
import { cn } from '@/lib/utils'

type Variant = 'primary' | 'secondary' | 'ghost' | 'danger' | 'success'
type Size = 'sm' | 'md' | 'lg' | 'icon'

// Variants mirror tenderhub-lsi's UI/Button.jsx: every button carries a border,
// solid variants gain a tinted shadow on hover.
const variants: Record<Variant, string> = {
  primary:
    'bg-primary text-white border-primary hover:bg-primary-hover hover:shadow-lg hover:shadow-primary/30 focus:ring-primary active:bg-blue-800',
  secondary:
    'bg-surface text-slate-700 border-slate-300 hover:bg-surface-muted hover:border-slate-400 focus:ring-slate-500 active:bg-slate-100',
  ghost:
    'bg-transparent text-slate-700 border-transparent hover:bg-slate-100 focus:ring-slate-500 active:bg-slate-200',
  danger:
    'bg-danger text-white border-danger hover:bg-red-700 hover:shadow-lg hover:shadow-danger/30 focus:ring-red-500 active:bg-red-800',
  success:
    'bg-success text-white border-success hover:bg-green-700 hover:shadow-lg hover:shadow-success/30 focus:ring-green-500 active:bg-green-800',
}

const sizes: Record<Size, string> = {
  sm: 'h-8 px-3 text-xs rounded-lg',
  md: 'h-10 px-4 text-sm rounded-lg',
  lg: 'h-12 px-6 text-base rounded-xl',
  icon: 'h-9 w-9 rounded-lg',
}

export type ButtonProps = React.ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: Variant
  size?: Size
}

export function Button({
  className,
  variant = 'primary',
  size = 'md',
  type = 'button',
  ...props
}: ButtonProps) {
  return (
    <button
      type={type}
      className={cn(
        'inline-flex items-center justify-center gap-2 border font-semibold whitespace-nowrap transition-all duration-200',
        'focus:ring-2 focus:ring-offset-2 focus:outline-none',
        'disabled:cursor-not-allowed disabled:opacity-50',
        variants[variant],
        sizes[size],
        className,
      )}
      {...props}
    />
  )
}

/** Same look as a primary Button, for `next/link` navigation. */
export const linkButtonClass = cn(
  'inline-flex h-10 items-center justify-center gap-2 rounded-lg border border-primary bg-primary px-4',
  'text-sm font-semibold text-white transition-all duration-200',
  'hover:bg-primary-hover hover:shadow-lg hover:shadow-primary/30',
)
