import type { Metadata } from 'next'
import { Card, CardContent } from '@/components/ui/card'
import { LoginForm } from './login-form'

export const metadata: Metadata = { title: 'Masuk' }

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ next?: string }>
}) {
  const { next } = await searchParams

  return (
    <Card>
      <CardContent className="p-7">
        <div className="mb-6">
          <p className="text-xs font-semibold tracking-widest text-primary uppercase">
            Web Monitoring SPK
          </p>
          <h1 className="mt-1 text-lg font-semibold text-slate-900">
            Masuk ke sistem
          </h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Gunakan akun yang dibuatkan Administration.
          </p>
        </div>

        <LoginForm next={next} />
      </CardContent>
    </Card>
  )
}
