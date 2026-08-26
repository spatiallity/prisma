import type { Metadata } from 'next'
import { Card, CardContent } from '@/components/ui/card'
import { Alert } from '@/components/ui/alert'
import { SignOutButton } from '@/components/sign-out-button'

export const metadata: Metadata = { title: 'Profil belum terdaftar' }

export default function NoProfilePage() {
  return (
    <div className="flex min-h-dvh items-center justify-center p-4">
      <Card className="w-full max-w-md">
      <CardContent className="grid gap-4 p-7">
        <h1 className="text-lg font-semibold">Profil belum terdaftar</h1>
        <Alert tone="warning">
          Akun login Anda valid, tetapi belum memiliki profil di tabel{' '}
          <code className="font-mono">users</code>, sehingga role dan permission
          belum dapat ditentukan.
        </Alert>
        <p className="text-sm text-muted-foreground">
          Hubungi Administration untuk melengkapi profil (nama lengkap dan role).
        </p>
        <SignOutButton className="w-full" />
      </CardContent>
      </Card>
    </div>
  )
}
