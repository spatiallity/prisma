import { createClient } from '@/lib/supabase/server'
import { requirePermission } from '@/lib/auth/session'
import {
  buildRoutingMonitorWorkbook,
  type RoutingHistoryExportRow,
  type RoutingMonitorExportRow,
} from '@/lib/monitor-export'

/** Complete routing monitor export, including completed and rejected documents
 * as well as every individual routing-history step. */
export async function GET() {
  await requirePermission('routing', 'view')
  const supabase = await createClient()
  const [{ data: documents, error: documentError }, { data: spks, error: spkError }, { data: history, error: historyError }] = await Promise.all([
    supabase.from('spk_routing').select('id, spk_id, status, created_at, updated_at').order('created_at', { ascending: false }),
    supabase.from('spks').select('id, spk_number, site_code, work_name, status, opname_marked_at, opname_value, pad_marked_at, pad_value').order('spk_number'),
    supabase.from('routing_history').select('spk_routing_id, sequence, step_name, status, pic_name, started_at, completed_at, note').order('sequence'),
  ])
  if (documentError || spkError || historyError) {
    return new Response(documentError?.message ?? spkError?.message ?? historyError?.message ?? 'Gagal menyiapkan Routing Monitor.', { status: 500 })
  }

  const spkById = new Map((spks ?? []).map((spk) => [spk.id, spk]))
  const historyByDocument = new Map<string, NonNullable<typeof history>>()
  for (const step of history ?? []) {
    const list = historyByDocument.get(step.spk_routing_id) ?? []
    list.push(step)
    historyByDocument.set(step.spk_routing_id, list)
  }
  const rows: RoutingMonitorExportRow[] = []
  const historyRows: RoutingHistoryExportRow[] = []
  for (const document of documents ?? []) {
    const spk = spkById.get(document.spk_id)
    if (!spk) continue
    const stages = [...(historyByDocument.get(document.id) ?? [])].sort((a, b) => a.sequence - b.sequence)
    const current = stages.find((stage) => stage.status !== 'Completed') ?? stages.at(-1)
    rows.push({
      spkNumber: spk.spk_number,
      siteCode: spk.site_code,
      workName: spk.work_name,
      spkStatus: spk.status,
      routingStatus: document.status,
      currentStage: current?.step_name ?? null,
      currentStageStatus: current?.status ?? null,
      pic: current?.pic_name ?? null,
      startedAt: current?.started_at ?? null,
      completedAt: current?.completed_at ?? null,
      opnameDate: spk.opname_marked_at,
      opnameValue: spk.opname_value === null ? null : Number(spk.opname_value),
      padDate: spk.pad_marked_at,
      padValue: spk.pad_value === null ? null : Number(spk.pad_value),
      updatedAt: document.updated_at,
    })
    stages.forEach((stage) => {
      historyRows.push({
        spkNumber: spk.spk_number,
        siteCode: spk.site_code,
        workName: spk.work_name,
        routingStatus: document.status,
        sequence: stage.sequence,
        stage: stage.step_name,
        stageStatus: stage.status,
        pic: stage.pic_name,
        startedAt: stage.started_at,
        completedAt: stage.completed_at,
        note: stage.note,
      })
    })
  }
  const workbook = buildRoutingMonitorWorkbook(rows, historyRows)
  const buffer = await workbook.xlsx.writeBuffer()
  const stamp = new Date().toISOString().replace(/[-:]/g, '').replace('T', '_').slice(0, 15)
  return new Response(buffer, {
    headers: {
      'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      'Content-Disposition': `attachment; filename="routing_monitor_${stamp}.xlsx"`,
    },
  })
}
