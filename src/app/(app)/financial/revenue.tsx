import Link from 'next/link'
import { PageHeader, EmptyState } from '@/components/ui/page-header'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Table, Td, Th, Tr } from '@/components/ui/table'
import { Badge } from '@/components/ui/badge'
import { requirePermission } from '@/lib/auth/session'
import { createClient } from '@/lib/supabase/server'
import { can } from '@/lib/auth/permissions'
import { formatDate, formatRupiah } from '@/lib/utils'
import { DOC_STATUS_TONE, REVENUE_META, type RevenueKind } from '@/lib/financial'
import type { FinancialDocStatus } from '@/lib/supabase/types'
import { RevenueForm, RevenueStatusToggle, type Choice } from './revenue-form'

/** What every revenue document reduces to once it reaches the table. */
type DocRow = {
  id: string
  spkId: string
  number: string | null
  value: number
  date: string | null
  status: FinancialDocStatus
  extra: string | null
  notes: string | null
}

/**
 * Section 25.1–25.5 — the five revenue documents share one screen. Only the
 * query and the column labels differ, so those are the only things that
 * branch; everything below reads from one shape.
 */
export async function RevenueDocuments({ kind }: { kind: RevenueKind }) {
  const meta = REVENUE_META[kind]
  const user = await requirePermission(meta.module, 'view')
  const mayEdit = can(user.permissions, meta.module, 'edit')

  const supabase = await createClient()

  let rows: DocRow[] = []
  let parents: Choice[] = []

  switch (kind) {
    case 'contract': {
      const { data } = await supabase
        .from('contracts')
        .select('*')
        .order('contract_date', { ascending: false, nullsFirst: false })
      rows = (data ?? []).map((r) => ({
        id: r.id,
        spkId: r.spk_id,
        number: r.contract_number,
        value: Number(r.contract_value),
        date: r.contract_date,
        status: r.status,
        extra: r.amendment_no > 0 ? `Amandemen ${r.amendment_no}` : 'Kontrak awal',
        notes: r.notes,
      }))
      break
    }
    case 'opname': {
      const { data } = await supabase
        .from('opnames')
        .select('*')
        .order('opname_date', { ascending: false, nullsFirst: false })
      rows = (data ?? []).map((r) => ({
        id: r.id,
        spkId: r.spk_id,
        number: r.opname_number,
        value: Number(r.opname_value),
        date: r.opname_date,
        status: r.status,
        extra:
          r.period_start || r.period_end
            ? `${formatDate(r.period_start)} – ${formatDate(r.period_end)}`
            : null,
        notes: r.notes,
      }))
      break
    }
    case 'pad': {
      const [{ data }, { data: opnames }] = await Promise.all([
        supabase.from('pad').select('*').order('pad_date', { ascending: false, nullsFirst: false }),
        supabase
          .from('opnames')
          .select('id, opname_number, opname_value')
          .neq('status', 'Cancelled'),
      ])
      rows = (data ?? []).map((r) => ({
        id: r.id,
        spkId: r.spk_id,
        number: r.pad_number,
        value: Number(r.pad_value),
        date: r.pad_date,
        status: r.status,
        extra: r.opname_id ? 'Dari opname' : null,
        notes: r.notes,
      }))
      parents = (opnames ?? []).map((o) => ({
        id: o.id,
        label: `${o.opname_number ?? 'Opname'} — ${formatRupiah(o.opname_value)}`,
      }))
      break
    }
    case 'invoice': {
      const [{ data }, { data: pads }] = await Promise.all([
        supabase
          .from('invoices')
          .select('*')
          .order('invoice_date', { ascending: false, nullsFirst: false }),
        supabase.from('pad').select('id, pad_number, pad_value').neq('status', 'Cancelled'),
      ])
      rows = (data ?? []).map((r) => ({
        id: r.id,
        spkId: r.spk_id,
        number: r.invoice_number,
        value: Number(r.invoice_value),
        date: r.invoice_date,
        status: r.status,
        extra: r.due_date ? `Jatuh tempo ${formatDate(r.due_date)}` : null,
        notes: r.notes,
      }))
      parents = (pads ?? []).map((p) => ({
        id: p.id,
        label: `${p.pad_number ?? 'PAD'} — ${formatRupiah(p.pad_value)}`,
      }))
      break
    }
    case 'payment': {
      const [{ data }, { data: invoices }] = await Promise.all([
        supabase
          .from('payments')
          .select('*')
          .order('payment_date', { ascending: false, nullsFirst: false }),
        supabase
          .from('invoices')
          .select('id, invoice_number, invoice_value')
          .neq('status', 'Cancelled'),
      ])
      rows = (data ?? []).map((r) => ({
        id: r.id,
        spkId: r.spk_id,
        number: r.reference,
        value: Number(r.payment_value),
        date: r.payment_date,
        status: r.status,
        extra: r.invoice_id ? 'Atas invoice' : 'Tanpa invoice',
        notes: r.notes,
      }))
      parents = (invoices ?? []).map((i) => ({
        id: i.id,
        label: `${i.invoice_number ?? 'Invoice'} — ${formatRupiah(i.invoice_value)}`,
      }))
      break
    }
  }

  const { data: spks } = await supabase
    .from('spks')
    .select('id, spk_number, site_code, work_name, status')
    .order('spk_number')

  const spkById = new Map((spks ?? []).map((s) => [s.id, s]))
  const live = rows.filter((r) => r.status !== 'Cancelled')
  const total = live.reduce((sum, r) => sum + r.value, 0)

  return (
    <>
      <PageHeader
        title={meta.label}
        description={`Section ${meta.section} — ${meta.description}`}
      />

      <div className="mb-5 grid gap-4 sm:grid-cols-3">
        <Card>
          <CardContent className="p-4">
            <div className="text-[11px] font-extrabold tracking-wider text-slate-500 uppercase">
              Jumlah dokumen
            </div>
            <div className="tnum mt-1 text-2xl font-black text-slate-900">
              {live.length}
            </div>
          </CardContent>
        </Card>
        <Card className="sm:col-span-2">
          <CardContent className="p-4">
            <div className="text-[11px] font-extrabold tracking-wider text-slate-500 uppercase">
              Total nilai (di luar yang dibatalkan)
            </div>
            <div className="tnum mt-1 text-2xl font-black text-slate-900">
              {formatRupiah(total)}
            </div>
          </CardContent>
        </Card>
      </div>

      <Card className="mb-5 overflow-hidden">
        {rows.length > 0 ? (
          <Table>
            <thead>
              <tr>
                <Th>SPK</Th>
                <Th>{meta.numberLabel}</Th>
                <Th>{meta.dateLabel}</Th>
                <Th className="text-right">{meta.valueLabel}</Th>
                <Th>Keterangan</Th>
                <Th>Status</Th>
                {mayEdit && <Th className="text-right">Aksi</Th>}
              </tr>
            </thead>
            <tbody>
              {rows.map((row) => {
                const spk = spkById.get(row.spkId)
                return (
                  <Tr key={row.id}>
                    <Td>
                      <Link
                        href={`/spk/${row.spkId}`}
                        className="font-bold text-primary hover:underline"
                      >
                        {spk?.site_code ?? spk?.spk_number ?? 'SPK'}
                      </Link>
                    </Td>
                    <Td className="font-bold text-slate-900">{row.number ?? '—'}</Td>
                    <Td className="tnum text-muted-foreground">{formatDate(row.date)}</Td>
                    <Td className="tnum text-right font-bold">{formatRupiah(row.value)}</Td>
                    <Td className="text-muted-foreground">
                      {row.extra ?? '—'}
                      {row.notes && <div className="text-xs">{row.notes}</div>}
                    </Td>
                    <Td>
                      <Badge tone={DOC_STATUS_TONE[row.status]}>{row.status}</Badge>
                    </Td>
                    {mayEdit && (
                      <Td className="text-right">
                        <RevenueStatusToggle kind={kind} id={row.id} status={row.status} />
                      </Td>
                    )}
                  </Tr>
                )
              })}
            </tbody>
          </Table>
        ) : (
          <EmptyState
            title={`Belum ada ${meta.label}`}
            description={meta.description}
          />
        )}
      </Card>

      {mayEdit && (
        <Card>
          <CardHeader>
            <div>
              <CardTitle>{meta.label} baru</CardTitle>
              <CardDescription>
                Koreksi dilakukan dengan membatalkan lalu mencatat ulang, bukan
                menimpa (Section 4.4).
              </CardDescription>
            </div>
          </CardHeader>
          <CardContent>
            <RevenueForm
              kind={kind}
              spks={(spks ?? [])
                .filter((s) => s.status !== 'Cancelled')
                .map((s) => ({ id: s.id, label: `${s.spk_number} — ${s.work_name}` }))}
              parents={parents}
            />
          </CardContent>
        </Card>
      )}
    </>
  )
}
