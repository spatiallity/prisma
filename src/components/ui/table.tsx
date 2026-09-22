import * as React from 'react'
import { cn } from '@/lib/utils'

export function Table({
  className,
  ...props
}: React.TableHTMLAttributes<HTMLTableElement>) {
  return (
    <div className="max-h-[70vh] w-full overflow-auto">
      <table
        className={cn('w-full border-collapse text-sm', className)}
        {...props}
      />
    </div>
  )
}

export function Th({
  className,
  ...props
}: React.ThHTMLAttributes<HTMLTableCellElement>) {
  return (
    <th
      className={cn(
        'sticky top-0 z-10 border-b border-slate-200 bg-surface-muted px-4 py-2.5 text-left text-[11px] font-extrabold tracking-widest text-slate-500 uppercase',
        className,
      )}
      {...props}
    />
  )
}

export function Td({
  className,
  ...props
}: React.TdHTMLAttributes<HTMLTableCellElement>) {
  return (
    <td
      className={cn(
        'border-b border-slate-100 px-4 py-3 align-middle font-medium',
        className,
      )}
      {...props}
    />
  )
}

export function Tr({
  className,
  ...props
}: React.HTMLAttributes<HTMLTableRowElement>) {
  return (
    <tr
      className={cn('transition-colors hover:bg-surface-muted', className)}
      {...props}
    />
  )
}
