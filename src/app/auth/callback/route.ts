import { NextResponse, type NextRequest } from 'next/server'
import { createServerClient } from '@supabase/ssr'
import { SUPABASE_ANON_KEY, SUPABASE_URL } from '@/lib/supabase/env'
import type { Database } from '@/lib/supabase/types'
export async function GET(request: NextRequest) {
  const response = NextResponse.redirect(new URL('/reset-password', request.url))
  const code = request.nextUrl.searchParams.get('code')
  if (!code) return NextResponse.redirect(new URL('/login?error=recovery', request.url))
  const supabase = createServerClient<Database>(SUPABASE_URL, SUPABASE_ANON_KEY, { cookies: { getAll: () => request.cookies.getAll(), setAll: (items) => items.forEach(({ name, value, options }) => response.cookies.set(name, value, options)) } })
  const { error } = await supabase.auth.exchangeCodeForSession(code)
  return error ? NextResponse.redirect(new URL('/login?error=recovery', request.url)) : response
}
