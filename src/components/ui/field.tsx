import * as React from 'react'
import { cn } from '@/lib/utils'

export function Label({
  className,
  ...props
}: React.LabelHTMLAttributes<HTMLLabelElement>) {
  return (
    <label
      className={cn('text-sm font-semibold text-slate-700', className)}
      {...props}
    />
  )
}

const control =
  'h-10 w-full rounded-lg border border-slate-300 bg-surface px-3 text-sm text-foreground ' +
  'placeholder:text-slate-400 transition-colors ' +
  'focus:border-primary focus:ring-2 focus:ring-primary/30 focus:outline-none ' +
  'disabled:cursor-not-allowed disabled:bg-slate-50 disabled:opacity-70'

export function Input({
  className,
  ...props
}: React.InputHTMLAttributes<HTMLInputElement>) {
  return <input className={cn(control, className)} {...props} />
}

export function Select({
  className,
  children,
  ...props
}: React.SelectHTMLAttributes<HTMLSelectElement>) {
  return (
    <select className={cn(control, 'pr-8', className)} {...props}>
      {children}
    </select>
  )
}

export function Textarea({
  className,
  ...props
}: React.TextareaHTMLAttributes<HTMLTextAreaElement>) {
  return (
    <textarea
      className={cn(control, 'h-auto min-h-20 py-2 leading-relaxed', className)}
      {...props}
    />
  )
}

export function Field({
  label,
  htmlFor,
  hint,
  error,
  required,
  children,
  className,
}: {
  label: string
  htmlFor?: string
  hint?: string
  error?: string
  required?: boolean
  children: React.ReactNode
  className?: string
}) {
  return (
    <div className={cn('grid gap-1.5', className)}>
      <Label htmlFor={htmlFor}>
        {label}
        {required && <span className="ml-0.5 text-danger">*</span>}
      </Label>
      {children}
      {hint && !error && (
        <p className="text-xs text-muted-foreground">{hint}</p>
      )}
      {error && <p className="text-xs font-semibold text-danger">{error}</p>}
    </div>
  )
}
