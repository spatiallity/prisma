import 'server-only'

import type { SupabaseClient } from '@supabase/supabase-js'
import type { Database } from '@/lib/supabase/types'

export type SpkOpt = { id: string; label: string }
export type ActivityOpt = {
  id: string
  spkId: string
  label: string
  unit: string | null
}
export type VendorOpt = { id: string; label: string }
export type TeamOpt = { id: string; vendorId: string; label: string }

export type ScheduleOptions = {
  spks: SpkOpt[]
  activities: ActivityOpt[]
  vendors: VendorOpt[]
  teams: TeamOpt[]
}

/**
 * Everything the plan and progress forms need to populate their dependent
 * selects. Loaded whole and filtered in the browser: the volumes here are one
 * project's worth of rows, so a round trip per keystroke would cost more than
 * it saves.
 */
export async function loadScheduleOptions(
  supabase: SupabaseClient<Database>,
): Promise<ScheduleOptions> {
  const { data: spks } = await supabase
    .from('spks')
    .select('id, spk_number, work_name')
    .in('status', ['Draft', 'On Going'])
    .order('spk_number')

  const spkIds = (spks ?? []).map((s) => s.id)

  const [{ data: activities }, { data: vendors }, { data: teams }] = await Promise.all([
    spkIds.length
      ? supabase
          .from('spk_activities')
          .select('id, spk_id, name, unit')
          .in('spk_id', spkIds)
          .order('sequence')
      : Promise.resolve({ data: [] }),
    supabase.from('vendors').select('id, name, code').eq('status', 'Active').order('name'),
    supabase
      .from('vendor_teams')
      .select('id, vendor_id, name')
      .eq('status', 'Active')
      .order('name'),
  ])

  return {
    spks: (spks ?? []).map((s) => ({
      id: s.id,
      label: `${s.spk_number} — ${s.work_name}`,
    })),
    activities: (activities ?? []).map((a) => ({
      id: a.id,
      spkId: a.spk_id,
      label: a.name,
      unit: a.unit,
    })),
    vendors: (vendors ?? []).map((v) => ({ id: v.id, label: `${v.name} (${v.code})` })),
    teams: (teams ?? []).map((t) => ({
      id: t.id,
      vendorId: t.vendor_id,
      label: t.name,
    })),
  }
}
