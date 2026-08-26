import type { Metadata } from 'next'
import { BrandLogo } from '@/components/brand-logo'
import { Card, CardContent } from '@/components/ui/card'
import { Alert } from '@/components/ui/alert'
import { SignOutButton } from '@/components/sign-out-button'

export const metadata: Metadata = { title: 'Akun nonaktif' }

export default function InactivePage() {
  return (
    <div className="flex min-h-dvh flex-col items-center justify-center gap-5 p-4">
      <BrandLogo height={40} priority />
      <Card className="w-full max-w-md">
      <CardContent className="grid gap-4 p-7">
        <h1 className="text-lg font-semibold">Akun nonaktif</h1>
        <Alert tone="warning">
          Status akun Anda bukan <strong>Active</strong>, sehingga seluruh akses
          data ditutup di level database.
        </Alert>
        <p className="text-sm text-muted-foreground">
          Hubungi Administration untuk mengaktifkan kembali akun.
        </p>
        <SignOutButton className="w-full" />
      </CardContent>
      </Card>
    </div>
  )
}
