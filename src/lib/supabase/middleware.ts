import { createServerClient } from '@supabase/ssr'
import { NextResponse, type NextRequest } from 'next/server'
import type { Database } from './types'
import { SUPABASE_ANON_KEY, SUPABASE_URL, isSupabaseConfigured } from './env'

/** Routes reachable without a session. */
const PUBLIC_PREFIXES = ['/login', '/forgot-password', '/reset-password', '/auth', '/setup', '/no-profile', '/inactive']

function isPublic(pathname: string) {
  return PUBLIC_PREFIXES.some(
    (prefix) => pathname === prefix || pathname.startsWith(`${prefix}/`),
  )
}

function clearInvalidSession(request: NextRequest, redirectToLogin: boolean) {
  const loginUrl = new URL('/login', request.url)
  if (redirectToLogin && request.nextUrl.pathname !== '/') {
    loginUrl.search = `?next=${encodeURIComponent(request.nextUrl.pathname)}`
  }
  const response = redirectToLogin ? NextResponse.redirect(loginUrl) : NextResponse.next({ request })

  request.cookies
    .getAll()
    .filter(({ name }) => name.startsWith('sb-'))
    .forEach(({ name }) => response.cookies.delete(name))

  return response
}

export async function updateSession(request: NextRequest) {
  const { pathname } = request.nextUrl

  // No project wired up yet — send everything to the setup instructions rather
  // than letting the Supabase client throw on an empty URL.
  if (!isSupabaseConfigured) {
    if (pathname === '/setup') return NextResponse.next({ request })
    const url = request.nextUrl.clone()
    url.pathname = '/setup'
    url.search = ''
    return NextResponse.redirect(url)
  }

  let supabaseResponse = NextResponse.next({ request })

  const supabase = createServerClient<Database>(SUPABASE_URL, SUPABASE_ANON_KEY, {
    cookies: {
      getAll() {
        return request.cookies.getAll()
      },
      setAll(cookiesToSet) {
        cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value))
        supabaseResponse = NextResponse.next({ request })
        cookiesToSet.forEach(({ name, value, options }) =>
          supabaseResponse.cookies.set(name, value, options),
        )
      },
    },
  })

  // IMPORTANT: getUser() refreshes the session cookie.
  // Do NOT run logic between createServerClient and getUser.
  let user = null
  try {
    const { data, error } = await supabase.auth.getUser()
    if (error) {
      return clearInvalidSession(request, !isPublic(pathname))
    }
    user = data.user
  } catch {
    return clearInvalidSession(request, !isPublic(pathname))
  }

  if (!user && !isPublic(pathname)) {
    const url = request.nextUrl.clone()
    url.pathname = '/login'
    // Come back to the requested page after signing in.
    url.search = pathname === '/' ? '' : `?next=${encodeURIComponent(pathname)}`
    return NextResponse.redirect(url)
  }

  if (user && pathname === '/login') {
    const url = request.nextUrl.clone()
    url.pathname = '/dashboard'
    url.search = ''
    return NextResponse.redirect(url)
  }

  return supabaseResponse
}
