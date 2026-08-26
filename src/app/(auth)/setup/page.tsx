import type { Metadata } from 'next'
import { Card, CardContent } from '@/components/ui/card'
import { Alert } from '@/components/ui/alert'
import { isSupabaseConfigured } from '@/lib/supabase/env'

export const metadata: Metadata = { title: 'Setup' }

const STEPS = [
  {
    title: '1. Buat project Supabase',
    body: 'supabase.com/dashboard → New project. Catat Project Ref, URL, anon key, dan service role key.',
  },
  {
    title: '2. Isi .env.local',
    body: 'NEXT_PUBLIC_SUPABASE_URL, NEXT_PUBLIC_SUPABASE_ANON_KEY, SUPABASE_SERVICE_ROLE_KEY.',
  },
  {
    title: '3. Jalankan migration',
    body: 'supabase link --project-ref <ref> && supabase db push, lalu jalankan supabase/seed/seed.sql.',
  },
  {
    title: '4. Buat user pertama',
    body: 'Authentication → Users → Add user, kemudian hubungkan ke tabel users dengan role administration (lihat bagian akhir seed.sql).',
  },
  {
    title: '5. Regenerate types',
    body: 'pnpm dlx supabase gen types typescript --project-id <ref> > src/lib/supabase/types.ts',
  },
]

export default function SetupPage() {
  return (
    <div className="flex min-h-dvh items-center justify-center p-4">
      <Card className="w-full max-w-md">
      <CardContent className="grid gap-5 p-7">
        <div>
          <h1 className="text-lg font-semibold">Setup belum selesai</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Aplikasi belum terhubung ke Supabase.
          </p>
        </div>

        {isSupabaseConfigured ? (
          <Alert tone="success" title="Environment sudah terisi">
            Muat ulang halaman untuk melanjutkan ke login.
          </Alert>
        ) : (
          <Alert tone="warning" title="Environment kosong">
            <code className="code">NEXT_PUBLIC_SUPABASE_URL</code> atau{' '}
            <code className="code">NEXT_PUBLIC_SUPABASE_ANON_KEY</code>{' '}
            belum diisi di <code className="code">.env.local</code>.
          </Alert>
        )}

        <ol className="grid gap-3">
          {STEPS.map((step) => (
            <li
              key={step.title}
              className="rounded-md border border-border bg-surface-muted px-4 py-3"
            >
              <p className="text-sm font-medium text-slate-900">{step.title}</p>
              <p className="mt-1 text-xs leading-relaxed text-muted-foreground">
                {step.body}
              </p>
            </li>
          ))}
        </ol>

        <p className="text-xs text-muted-foreground">
          Detail lengkap ada di <code className="code">supabase/README.md</code>.
        </p>
      </CardContent>
      </Card>
    </div>
  )
}
