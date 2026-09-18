import { NextResponse, type NextRequest } from 'next/server'
import { createServerClient } from '@supabase/ssr'
import { SUPABASE_ANON_KEY, SUPABASE_URL } from '@/lib/supabase/env'
import type { Database } from '@/lib/supabase/types'
export async function GET(request: NextRequest) {
  const response = NextResponse.redirect(new URL('/reset-password', request.url))
  const code = request.nextUrl.searchParams.get('code')
  // Supabase can return either a PKCE code in the query string or an
  // implicit-flow session/error in the URL fragment. Fragments never reach
  // this server route, so forward the browser to the reset screen and let its
  // browser client handle that second case.
  if (!code) return response
  const supabase = createServerClient<Database>(SUPABASE_URL, SUPABASE_ANON_KEY, { cookies: { getAll: () => request.cookies.getAll(), setAll: (items) => items.forEach(({ name, value, options }) => response.cookies.set(name, value, options)) } })
  const { error } = await supabase.auth.exchangeCodeForSession(code)
  return error
    ? NextResponse.redirect(new URL('/reset-password?error=recovery', request.url))
    : response
}
