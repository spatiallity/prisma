import 'server-only'

import { createClient as createSupabaseClient } from '@supabase/supabase-js'
import type { Database } from './types'
import { SUPABASE_URL } from './env'

/**
 * Service-role client. Bypasses RLS, so it is only used where Supabase Auth
 * itself must be touched — creating the auth account behind a public.users
 * row, or resetting a password. Never import this from a Client Component.
 */
export function createAdminClient() {
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!serviceKey) {
    throw new Error(
      'SUPABASE_SERVICE_ROLE_KEY is not set — user creation needs it (see .env.example).',
    )
  }

  return createSupabaseClient<Database>(SUPABASE_URL, serviceKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  })
}
