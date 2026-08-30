import type { Metadata } from 'next'
import { cn } from '@/lib/utils'
import { linkButtonClass } from '@/components/ui/button'
import Link from 'next/link'
import { ShieldX } from 'lucide-react'
import { Card, CardContent } from '@/components/ui/card'
import { requireUser } from '@/lib/auth/session'

export const metadata: Metadata = { title: 'Akses ditolak' }

export default async function ForbiddenPage() {
  const user = await requireUser()

  return (
    <Card className="mx-auto max-w-lg">
      <CardContent className="grid gap-3 p-7 text-center">
        <ShieldX className="mx-auto h-8 w-8 text-danger" aria-hidden />
        <h1 className="text-lg font-semibold">Akses ditolak</h1>
        <p className="text-sm text-muted-foreground">
          Role <strong>{user.role.name}</strong> tidak memiliki permission untuk
          halaman ini.
        </p>
        <Link
          href="/dashboard"
          className={cn(linkButtonClass, 'mx-auto mt-2')}
        >
          Kembali ke Dashboard
        </Link>
      </CardContent>
    </Card>
  )
}
