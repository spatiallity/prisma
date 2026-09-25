import { readFile } from 'node:fs/promises'
import { join } from 'node:path'
import { getSession } from '@/lib/auth/session'
import { can } from '@/lib/auth/permissions'
import { SCREENSHOT_ACCESS } from '@/app/(app)/panduan/guide-data'


export async function GET(
  _request: Request,
  { params }: { params: Promise<{ name: string }> },
) {
  const session = await getSession()
  if (session.state !== 'active') return new Response('Unauthorized', { status: 401 })

  const { name } = await params
  const allowedModules = SCREENSHOT_ACCESS[name]
  if (!allowedModules) return new Response('Not found', { status: 404 })
  if (!allowedModules.some((module) => can(session.user.permissions, module, 'view'))) {
    return new Response('Forbidden', { status: 403 })
  }

  try {
    const image = await readFile(join(process.cwd(), 'private', 'guide', `${name}.png`))
    return new Response(new Uint8Array(image), {
      headers: {
        'Content-Type': 'image/png',
        'Cache-Control': 'private, no-store',
        'X-Content-Type-Options': 'nosniff',
      },
    })
  } catch {
    return new Response('Not found', { status: 404 })
  }
}
