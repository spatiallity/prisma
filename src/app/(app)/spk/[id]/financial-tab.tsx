import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { createClient } from '@/lib/supabase/server'
import { formatRupiah } from '@/lib/utils'
import { markOpname, markPad, unmarkOpname, unmarkPad } from '../actions'
import { OpnamePadRow } from './opname-pad-mark'

/**
 * Section 12 — the Financial tab of Detail SPK: the Section 26.1 revenue chain
 * (Contract → Invoice → Payment) plus the Opname/PAD marks. Opname and PAD
 * used to be routed documents with their own value/number (Section 25.2/25.3);
 * migration 0018 turned them into a plain mark — usually opname happens once
 * Desain Awal is done, and PAD once opname is marked.
 */
export async function FinancialTab({ spkId, mayEdit }: { spkId: string; mayEdit: boolean }) {
  const supabase = await createClient()

  const [{ data: financial }, { data: spk }] = await Promise.all([
    supabase.from('v_spk_financial').select('*').eq('spk_id', spkId).maybeSingle(),
    supabase
      .from('spks')
      .select('opname_marked_at, opname_marked_by, pad_marked_at, pad_marked_by')
      .eq('id', spkId)
      .maybeSingle(),
  ])

  const markerIds = [spk?.opname_marked_by, spk?.pad_marked_by].filter(
    (id): id is string => !!id,
  )
  const { data: markers } = markerIds.length
    ? await supabase.from('users').select('id, full_name').in('id', markerIds)
    : { data: [] }
  const markerName = new Map((markers ?? []).map((u) => [u.id, u.full_name]))

  /** Section 26.1 — the revenue chain, each step against the one before it. */
  const chain = [
    { label: 'Contract', value: Number(financial?.contract_total ?? 0) },
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

      <Card>
        <CardHeader>
          <div>
            <CardTitle>Opname &amp; PAD</CardTitle>
            <CardDescription>
              Biasanya opname ditandai setelah Desain Awal selesai; PAD menyusul
              setelah opname selesai.
            </CardDescription>
          </div>
        </CardHeader>
        <CardContent className="divide-y divide-slate-100 py-0">
          {mayEdit ? (
            <>
              <OpnamePadRow
                label="Opname"
                spkId={spkId}
                markedAt={spk?.opname_marked_at ?? null}
                markedByName={
                  spk?.opname_marked_by ? (markerName.get(spk.opname_marked_by) ?? null) : null
                }
                markAction={markOpname}
                unmarkAction={unmarkOpname}
              />
              <OpnamePadRow
                label="PAD"
                spkId={spkId}
                markedAt={spk?.pad_marked_at ?? null}
                markedByName={
                  spk?.pad_marked_by ? (markerName.get(spk.pad_marked_by) ?? null) : null
                }
                disabled={!spk?.opname_marked_at}
                disabledHint="Tandai opname selesai dulu."
                markAction={markPad}
                unmarkAction={unmarkPad}
              />
            </>
          ) : (
            <>
              <div className="flex items-center justify-between gap-3 py-2">
                <span className="text-sm font-bold text-slate-900">Opname</span>
                <Badge tone={spk?.opname_marked_at ? 'success' : 'neutral'}>
                  {spk?.opname_marked_at ? 'Sudah' : 'Belum'}
                </Badge>
              </div>
              <div className="flex items-center justify-between gap-3 py-2">
                <span className="text-sm font-bold text-slate-900">PAD</span>
                <Badge tone={spk?.pad_marked_at ? 'success' : 'neutral'}>
                  {spk?.pad_marked_at ? 'Sudah' : 'Belum'}
                </Badge>
              </div>
            </>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
