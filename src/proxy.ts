import type { NextRequest } from 'next/server'
import { updateSession } from '@/lib/supabase/middleware'

/**
 * Refreshes the Supabase session cookie on every request and keeps
 * unauthenticated traffic on the public routes. Authorization itself is
 * enforced by RLS (Section 31) — this only avoids rendering pages that would
 * fail anyway.
 */
export default async function proxy(request: NextRequest) {
  return await updateSession(request)
}

export const config = {
  matcher: [
    /*
     * Everything except:
     * - _next/static, _next/image (build output)
     * - favicon.ico and image files
     */
    '/((?!_next/static|_next/image|favicon.ico|.*\.(?:svg|png|jpg|jpeg|gif|webp)$).*)',
  ],
}
