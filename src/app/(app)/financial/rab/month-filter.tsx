'use client'

import { useRouter, useSearchParams, usePathname } from 'next/navigation'
import { Select } from '@/components/ui/field'
import { formatMonthLabel } from '@/lib/financial'

/** Switches the page between "seluruh bulan" (cumulative) and one month. */
export function MonthFilter({ months }: { months: string[] }) {
  const router = useRouter()
  const pathname = usePathname()
  const searchParams = useSearchParams()
  const current = searchParams.get('bulan') ?? ''

  return (
    <Select
      className="w-auto"
      value={current}
      onChange={(event) => {
        const value = event.target.value
        const params = new URLSearchParams(searchParams.toString())
        if (value) params.set('bulan', value)
        else params.delete('bulan')
        const qs = params.toString()
        router.push(qs ? `${pathname}?${qs}` : pathname)
      }}
    >
      <option value="">Seluruh bulan (akumulasi)</option>
      {months.map((m) => (
        <option key={m} value={m}>
          {formatMonthLabel(m)}
        </option>
      ))}
    </Select>
  )
}
