/**
 * Env values are read through literals so Next can inline the NEXT_PUBLIC_
 * ones into the client bundle. Nothing here throws — an unconfigured project
 * is a normal state before the first `supabase db push`, and the app routes to
 * /setup instead of returning a 500.
 */
export const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL ?? ''
export const SUPABASE_ANON_KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? ''

export const isSupabaseConfigured =
  SUPABASE_URL.length > 0 && SUPABASE_ANON_KEY.length > 0
