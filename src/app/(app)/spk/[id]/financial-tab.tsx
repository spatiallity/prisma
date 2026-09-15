import { Badge } from '@/components/ui/badge'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { StepChain, chainBadge, type ChainStep } from '@/components/ui/step-chain'
import { createClient } from '@/lib/supabase/server'
import { formatDate, formatRupiah } from '@/lib/utils'
import { DOC_STATUS_TONE, financialDisplayStatus, financialStatusLabel } from '@/lib/financial'
import { markOpname, markPad, unmarkOpname, unmarkPad } from '../actions'
import { OpnamePadRow } from './opname-pad-mark'
import { EditRevenueButton } from '../../financial/revenue-form'

/** The Financial tab of Detail SPK: Nilai SPK -> Opname -> PAD -> Invoice,
 *  shown as one chain — each editable in place, connected to the same data
 *  Client Payment shows. */
export async function FinancialTab({ spkId, mayEdit }: { spkId: string; mayEdit: boolean }) {
  const supabase = await createClient()

  const [{ data: spk }, { data: invoices }] = await Promise.all([
    supabase
      .from('spks')
      .select(
        'spk_number, work_name, contract_value, opname_marked_at, opname_marked_by, opname_value, pad_marked_at, pad_marked_by, pad_value',
      )
      .eq('id', spkId)
      .maybeSingle(),
    supabase
      .from('invoices')
      .select('*')
      .eq('spk_id', spkId)
      .neq('status', 'Cancelled')
      .order('invoice_date', { ascending: false, nullsFirst: false }),
  ])

  const markerIds = [spk?.opname_marked_by, spk?.pad_marked_by].filter(
    (id): id is string => !!id,
  )
  const { data: markers } = markerIds.length
    ? await supabase.from('users').select('id, full_name').in('id', markerIds)
    : { data: [] }
  const markerName = new Map((markers ?? []).map((u) => [u.id, u.full_name]))

  const spkChoice = spk ? [{ id: spkId, label: `${spk.spk_number} — ${spk.work_name}` }] : []
  const opnameDone = !!spk?.opname_marked_at
  const padDone = !!spk?.pad_marked_at
  const invoiceDone = (invoices ?? []).some((invoice) => invoice.status === 'Approved' && !!invoice.invoice_date)

  const steps: ChainStep[] = [
    {
      key: 'nilai',
      label: 'Nilai SPK',
      state: 'done',
      badge: <span className="tnum text-sm font-bold text-slate-900">{formatRupiah(spk?.contract_value ?? 0)}</span>,
    },
    {
      key: 'opname',
      label: 'Opname',
      state: opnameDone ? 'done' : 'current',
      badge: chainBadge(opnameDone ? 'done' : 'current'),
      sub: opnameDone ? (
        <>
          {formatDate(spk!.opname_marked_at)}
          {spk?.opname_marked_by && ` · ${markerName.get(spk.opname_marked_by) ?? ''}`}
          {spk?.opname_value != null && ` · ${formatRupiah(spk.opname_value)}`}
        </>
      ) : undefined,
      action: mayEdit ? (
        <OpnamePadRow
          label="Opname"
          spkId={spkId}
          markedAt={spk?.opname_marked_at ?? null}
          markAction={markOpname}
          unmarkAction={unmarkOpname}
          valueLabel="Nilai Opname"
          value={spk?.opname_value ?? null}
        />
      ) : undefined,
    },
    {
      key: 'pad',
      label: 'PAD',
      state: padDone ? 'done' : opnameDone ? 'current' : 'pending',
      badge: chainBadge(padDone ? 'done' : opnameDone ? 'current' : 'pending'),
      sub: padDone ? (
        <>
          {formatDate(spk!.pad_marked_at)}
          {spk?.pad_marked_by && ` · ${markerName.get(spk.pad_marked_by) ?? ''}`}
          {spk?.pad_value != null && ` · ${formatRupiah(spk.pad_value)}`}
        </>
      ) : !opnameDone ? (
        'Tandai opname selesai dulu.'
      ) : undefined,
      action: mayEdit ? (
        <OpnamePadRow
          label="PAD"
          spkId={spkId}
          markedAt={spk?.pad_marked_at ?? null}
          disabled={!opnameDone}
          markAction={markPad}
          unmarkAction={unmarkPad}
          valueLabel="Nilai PAD"
          value={spk?.pad_value ?? null}
        />
      ) : undefined,
    },
    {
      key: 'invoice',
      label: 'Invoice',
      state: invoiceDone ? 'done' : padDone ? 'current' : 'pending',
      badge: chainBadge(invoiceDone ? 'done' : padDone ? 'current' : 'pending'),
      sub: (
        <div className="mt-1 grid gap-2">
          {(invoices ?? []).map((inv) => {
            const status = financialDisplayStatus(inv.status, { invoiceDate: inv.invoice_date })
            return (
              <div key={inv.id} className="flex items-center justify-between gap-3 rounded-lg border border-slate-100 px-3 py-2">
                <div className="min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-bold text-slate-900">{inv.invoice_number ?? 'Invoice'}</span>
                    <Badge tone={DOC_STATUS_TONE[status]}>{financialStatusLabel(status)}</Badge>
                  </div>
                  <div className="text-xs text-muted-foreground">
                    {formatDate(inv.invoice_date)} · {formatRupiah(inv.invoice_value)}
                  </div>
                </div>
                {mayEdit && (
                  <EditRevenueButton
                    kind="invoice"
                    spks={spkChoice}
                    parents={[]}
                    initial={{
                      id: inv.id,
                      spkId,
                      number: inv.invoice_number,
                      value: Number(inv.invoice_value),
                      date: inv.invoice_date,
                      status: inv.status,
                      extra: null,
                      notes: inv.notes,
                      dueDate: inv.due_date,
                    }}
                  />
                )}
              </div>
            )
          })}
        </div>
      ),
    },
  ]

  return (
    <Card>
      <CardHeader>
        <CardTitle>Financial</CardTitle>
      </CardHeader>
      <CardContent>
        <StepChain steps={steps} />
      </CardContent>
    </Card>
  )
}
