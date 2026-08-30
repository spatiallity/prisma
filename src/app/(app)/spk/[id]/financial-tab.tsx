import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { createClient } from '@/lib/supabase/server'
import { formatRupiah } from '@/lib/utils'

/**
 * Section 12 — the Financial tab of Detail SPK: the Section 26.1 revenue chain
 * (Contract → Opname → PAD → Invoice → Payment) for this SPK.
 */
export async function FinancialTab({ spkId }: { spkId: string }) {
  const supabase = await createClient()

  const { data: financial } = await supabase
    .from('v_spk_financial')
    .select('*')
    .eq('spk_id', spkId)
    .maybeSingle()

  /** Section 26.1 — the revenue chain, each step against the one before it. */
  const chain = [
    { label: 'Contract', value: Number(financial?.contract_total ?? 0) },
    { label: 'Opname', value: Number(financial?.opname_total ?? 0) },
    { label: 'PAD', value: Number(financial?.pad_total ?? 0) },
    { label: 'Invoice', value: Number(financial?.invoice_total ?? 0) },
    { label: 'Payment', value: Number(financial?.payment_total ?? 0) },
  ]
  const peak = Math.max(1, ...chain.map((step) => step.value))

  return (
    <div className="grid gap-5">
      <Card>
        <CardHeader>
          <div>
            <CardTitle>Contract → Payment</CardTitle>
            <CardDescription>
              Selisih antar tahap inilah yang jadi bahan bottleneck financial.
            </CardDescription>
          </div>
          {Number(financial?.outstanding_payment ?? 0) > 0 && (
            <Badge tone="danger">
              Outstanding {formatRupiah(financial?.outstanding_payment)}
            </Badge>
          )}
        </CardHeader>
        <CardContent className="grid gap-3">
          {chain.map((step) => (
            <div key={step.label} className="grid gap-1">
              <div className="flex items-baseline justify-between gap-3">
                <span className="text-xs font-extrabold tracking-wider text-slate-500 uppercase">
                  {step.label}
                </span>
                <span className="tnum text-sm font-bold text-slate-900">
                  {step.value > 0 ? formatRupiah(step.value) : '—'}
                </span>
              </div>
              <div className="h-1.5 overflow-hidden rounded-full bg-slate-100">
                <div
                  className="h-full rounded-full bg-primary"
                  style={{ width: `${(step.value / peak) * 100}%` }}
                />
              </div>
            </div>
          ))}
        </CardContent>
      </Card>
    </div>
  )
}
