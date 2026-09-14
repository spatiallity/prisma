import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { createClient } from '@/lib/supabase/server'
import { formatDate, formatRupiah } from '@/lib/utils'
import { DOC_STATUS_TONE } from '@/lib/financial'
import { markOpname, markPad, unmarkOpname, unmarkPad } from '../actions'
import { OpnamePadRow } from './opname-pad-mark'
import { EditRevenueButton } from '../../financial/revenue-form'

/**
 * Section 12 — the Financial tab of Detail SPK: the Section 26.1 revenue chain
 * (Contract → Invoice — Payment is hidden project-wide) plus the Opname/PAD
 * marks. Opname and PAD used to be routed documents with their own
 * value/number (Section 25.2/25.3); migration 0018 turned them into a plain
 * mark — usually opname happens once Desain Awal is done, and PAD once
 * opname is marked.
 */
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

  return (
    <div className="grid gap-5">
      <Card>
        <CardHeader>
          <CardTitle>Nilai SPK</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="tnum text-2xl font-black text-slate-900">
            {formatRupiah(spk?.contract_value ?? 0)}
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Opname &amp; PAD</CardTitle>
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
                valueLabel="Nilai Opname"
                value={spk?.opname_value ?? null}
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
                valueLabel="Nilai PAD"
                value={spk?.pad_value ?? null}
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

      <Card>
        <CardHeader>
          <CardTitle>Invoice</CardTitle>
        </CardHeader>
        <CardContent className="divide-y divide-slate-100 py-0">
          {invoices && invoices.length > 0 ? (
            invoices.map((inv) => (
              <div key={inv.id} className="flex items-center justify-between gap-3 py-2">
                <div className="min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-bold text-slate-900">
                      {inv.invoice_number ?? 'Invoice'}
                    </span>
                    <Badge tone={DOC_STATUS_TONE[inv.status]}>{inv.status}</Badge>
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
            ))
          ) : (
            <div className="py-3 text-sm text-muted-foreground">Belum ada invoice.</div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
