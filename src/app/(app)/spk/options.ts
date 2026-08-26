import 'server-only'

import type { SupabaseClient } from '@supabase/supabase-js'
import type { Database } from '@/lib/supabase/types'
import type { Option } from './spk-form'

/** Dropdown sources shared by the create and edit pages. */
export async function loadSpkFormOptions(
  supabase: SupabaseClient<Database>,
): Promise<{
  vendors: Option[]
  managers: Option[]
  activityTemplates: Option[]
  routingTemplates: Option[]
}> {
  const [vendors, managers, activityTemplates, routingTemplates] = await Promise.all([
    supabase.from('vendors').select('id, name, code').eq('status', 'Active').order('name'),
    supabase.from('users').select('id, full_name').eq('status', 'Active').order('full_name'),
    supabase
      .from('activity_templates')
      .select('id, name, code')
      .eq('status', 'Active')
      .order('code'),
    supabase
      .from('routing_templates')
      .select('id, name, code')
      .eq('status', 'Active')
      .order('code'),
  ])

  return {
    vendors: (vendors.data ?? []).map((v) => ({ id: v.id, label: `${v.name} (${v.code})` })),
    managers: (managers.data ?? []).map((u) => ({ id: u.id, label: u.full_name })),
    activityTemplates: (activityTemplates.data ?? []).map((t) => ({
      id: t.id,
      label: t.name,
    })),
    routingTemplates: (routingTemplates.data ?? []).map((t) => ({
      id: t.id,
      label: t.name,
    })),
  }
}
