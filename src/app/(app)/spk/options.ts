import 'server-only'

import type { SupabaseClient } from '@supabase/supabase-js'
import type { Database } from '@/lib/supabase/types'
import type { Option } from './spk-form'

/** Dropdown sources shared by the create and edit pages. */
export async function loadSpkFormOptions(
  supabase: SupabaseClient<Database>,
): Promise<{ vendors: Option[] }> {
  const { data: vendors } = await supabase
    .from('vendors')
    .select('id, name, code')
    .eq('status', 'Active')
    .order('name')

  return {
    vendors: (vendors ?? []).map((v) => ({ id: v.id, label: `${v.name} (${v.code})` })),
  }
}
