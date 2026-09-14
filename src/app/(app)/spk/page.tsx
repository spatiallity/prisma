import type { Metadata } from 'next'
import Link from 'next/link'
import { Plus } from 'lucide-react'
import { PageHeader, EmptyState } from '@/components/ui/page-header'
import { Card, CardContent } from '@/components/ui/card'
import { Alert } from '@/components/ui/alert'
import { linkButtonClass } from '@/components/ui/button'
import { requirePermission } from '@/lib/auth/session'
import { createClient } from '@/lib/supabase/server'
import { can } from '@/lib/auth/permissions'
import { statusFromFilterKey } from '@/lib/spk'
import { PHASE_LABEL } from '@/lib/design'
import { SpkFilters } from './spk-filters'
import { SpkTable, type SpkStage } from './spk-table'

export const metadata: Metadata = { title: 'SPK' }

/** PostgREST `or()` takes a comma-separated list, so those characters must go. */
function sanitize(term: string) {
  return term.replace(/[,()*%]/g, ' ').trim()
}

/**
 * Where an SPK actually sits right now — the furthest stage it has reached,
 * in the same order the tabs of Detail SPK cover it: Progress (field work),
 * Design, Routing, Invoice. Each stage's date is whatever real timestamp
 * marks entering it; per-step routing/design dates were cleared as fictional
 * (imported data, not observed), so those read as "—" until a real review
 * happens through the app from here on.
 */
async function loadStageBySpk(
  supabase: Awaited<ReturnType<typeof createClient>>,
  spks: { id: string; opname_marked_at: string | null; pad_marked_at: string | null; start_date: string | null }[],
): Promise<Record<string, SpkStage>> {
  const spkIds = spks.map((s) => s.id)
  if (spkIds.length === 0) return {}

  const [{ data: invoices }, { data: designs }, { data: routingDocs }, { data: lead }] =
    await Promise.all([
      supabase
        .from('invoices')
        .select('spk_id, invoice_date')
        .in('spk_id', spkIds)
        .neq('status', 'Cancelled')
        .order('invoice_date', { ascending: false, nullsFirst: false }),
      supabase
        .from('designs')
        .select('id, spk_id, phase, current_stage')
        .in('spk_id', spkIds)
        .eq('status', 'Active'),
      supabase.from('spk_routing').select('*').in('spk_id', spkIds),
      supabase.from('v_routing_lead_time').select('*'),
    ])

  const latestInvoiceBySpk = new Map<string, string | null>()
  for (const inv of invoices ?? []) {
    if (!latestInvoiceBySpk.has(inv.spk_id)) latestInvoiceBySpk.set(inv.spk_id, inv.invoice_date)
  }

  const designIds = (designs ?? []).map((d) => d.id)
  const { data: startedDesignRevisions } = designIds.length
    ? await supabase.from('design_revisions').select('design_id').eq('status', 'Active').in('design_id', designIds)
    : { data: [] }
  const startedDesignIds = new Set((startedDesignRevisions ?? []).map((r) => r.design_id))

  const designBySpk = new Map<string, { id: string; phase: 'siteplan' | 'finalisasi'; current_stage: string }>()
  for (const d of designs ?? []) {
    const existing = designBySpk.get(d.spk_id)
    // Prefer finalisasi over siteplan — it only exists once siteplan is done.
    if (!existing || d.phase === 'finalisasi') designBySpk.set(d.spk_id, d)
  }

  const currentByRouting = new Map<string, { step_name: string; started_at: string | null; sequence: number }>()
  for (const row of lead ?? []) {
    if (row.status === 'Completed') continue
    const held = currentByRouting.get(row.spk_routing_id)
    if (!held || row.sequence < held.sequence) currentByRouting.set(row.spk_routing_id, row)
  }
  const routingBySpk = new Map((routingDocs ?? []).map((doc) => [doc.spk_id, doc]))

  const stageBySpk: Record<string, SpkStage> = {}
  for (const spk of spks) {
    const invoiceDate = latestInvoiceBySpk.get(spk.id)
    if (latestInvoiceBySpk.has(spk.id)) {
      stageBySpk[spk.id] = { label: 'Invoice terbit', date: invoiceDate ?? null }
      continue
    }

    const routingDoc = routingBySpk.get(spk.id)
    if (routingDoc) {
      if (routingDoc.status === 'Completed') {
        stageBySpk[spk.id] = { label: 'Routing selesai', date: routingDoc.completed_at }
      } else {
        const current = currentByRouting.get(routingDoc.id)
        stageBySpk[spk.id] = {
          label: current ? `Routing: ${current.step_name}` : 'Routing',
          date: current?.started_at ?? routingDoc.started_at,
        }
      }
      continue
    }

    if (spk.pad_marked_at) {
      stageBySpk[spk.id] = { label: 'PAD ditandai', date: spk.pad_marked_at }
      continue
    }
    if (spk.opname_marked_at) {
      stageBySpk[spk.id] = { label: 'Opname ditandai', date: spk.opname_marked_at }
      continue
    }

    const design = designBySpk.get(spk.id)
    if (design) {
      const started = startedDesignIds.has(design.id)
      stageBySpk[spk.id] = started
        ? { label: `Desain: ${design.current_stage}`, date: null }
        : { label: `${PHASE_LABEL[design.phase]}: menunggu mulai`, date: null }
      continue
    }

    stageBySpk[spk.id] = { label: 'Survei Topografi', date: spk.start_date }
  }

  return stageBySpk
}

export default async function SpkListPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; status?: string }>
}) {
  const user = await requirePermission('spk', 'view')
  const { q, status } = await searchParams
  const mayCreate = can(user.permissions, 'spk', 'create')
  const mayEdit = can(user.permissions, 'spk', 'edit')

  const supabase = await createClient()

  let query = supabase.from('spks').select('*').order('created_at', { ascending: false })

  const wanted = statusFromFilterKey(status)
  if (wanted) query = query.eq('status', wanted)

  const term = sanitize(q ?? '')
  if (term) {
    query = query.or(
      `spk_number.ilike.%${term}%,work_name.ilike.%${term}%,site_code.ilike.%${term}%,location.ilike.%${term}%`,
    )
  }

  const { data: spks, error } = await query
  const stageBySpk = await loadStageBySpk(supabase, spks ?? [])

  return (
    <>
      <PageHeader
        title="SPK"
        description="Setiap progress, desain, routing, dan angka financial menempel pada salah satu SPK di sini."
        actions={
          mayCreate && (
            <Link href="/spk/new" className={linkButtonClass}>
              <Plus size={16} aria-hidden />
              Buat SPK Baru
            </Link>
          )
        }
      />

      {error && (
        <Alert tone="danger" className="mb-4" title="Gagal memuat data">
          {error.message}
        </Alert>
      )}

      <Card className="mb-5">
        <CardContent className="py-3">
          <SpkFilters total={spks?.length ?? 0} />
        </CardContent>
      </Card>

      <Card className="overflow-hidden">
        {spks && spks.length > 0 ? (
          <SpkTable
            spks={spks}
            stageBySpk={stageBySpk}
            mayEdit={mayEdit}
          />
        ) : (
          <EmptyState
            title={term || wanted ? 'Tidak ada SPK yang cocok' : 'Belum ada SPK'}
            description={
              term || wanted
                ? 'Ubah kata kunci atau filter status.'
                : 'Buat SPK pertama untuk mulai memonitor pekerjaan.'
            }
            action={
              mayCreate && !term && !wanted ? (
                <Link href="/spk/new" className={linkButtonClass}>
                  <Plus size={16} aria-hidden />
                  Buat SPK Baru
                </Link>
              ) : undefined
            }
          />
        )}
      </Card>
    </>
  )
}
