import type { Metadata } from 'next'
import { BRAND } from '@/lib/brand'
import { BrandLogo } from '@/components/brand-logo'
import { LoginForm } from './login-form'

export const metadata: Metadata = { title: 'Masuk' }

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ next?: string }>
}) {
  const { next } = await searchParams

  return (
    <div className="flex min-h-dvh">
      {/* Left — branding */}
      <div
        className="relative hidden flex-col overflow-hidden lg:flex lg:w-[52%]"
        style={{
          background:
            'linear-gradient(135deg, #1e3a5f 0%, #0f2744 40%, #0c3a4a 70%, #0d4a42 100%)',
        }}
      >
        <div
          className="absolute -top-32 -left-32 h-96 w-96 rounded-full opacity-10"
          style={{ background: 'radial-gradient(circle, #13B2AA, transparent)' }}
        />
        <div
          className="absolute -right-24 -bottom-24 h-80 w-80 rounded-full opacity-10"
          style={{ background: 'radial-gradient(circle, #3b82f6, transparent)' }}
        />
        <div
          className="absolute top-1/2 left-1/2 h-[500px] w-[500px] -translate-x-1/2 -translate-y-1/2 rounded-full opacity-5"
          style={{ background: 'radial-gradient(circle, white, transparent)' }}
        />

        <div className="relative z-10 flex h-full flex-col justify-between p-12">
          <div className="text-[10px] font-bold tracking-widest text-slate-400 uppercase">
            {BRAND.owner}
          </div>

          <div className="flex flex-1 flex-col items-center justify-center gap-4 text-center">
            <h1
              className="text-5xl font-black tracking-tight text-white"
              style={{ letterSpacing: '0.02em' }}
            >
              {BRAND.name}
            </h1>
            <p className="max-w-xs text-sm leading-relaxed text-slate-300">
              Sistem kontrol project {BRAND.project} — {BRAND.client}.
            </p>
          </div>

          <div className="border-t border-white/10 pt-4">
            <p className="text-[11px] text-slate-500">
              © {BRAND.year} {BRAND.owner} · {BRAND.project}
            </p>
          </div>
        </div>
      </div>

      {/* Right — form */}
      <div className="flex flex-1 items-center justify-center overflow-y-auto bg-surface-muted p-4 lg:p-6">
        <div className="w-full max-w-md">
          <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
            <div className="mb-6 flex flex-col items-center text-center">
              <BrandLogo height={120} className="mb-4" priority />
              <h2 className="mb-0.5 text-xl font-black text-slate-900">
                Selamat Datang
              </h2>
              <p className="text-xs text-slate-500">
                Masuk ke {BRAND.name} untuk melanjutkan.
              </p>
            </div>

            <LoginForm next={next} />
          </div>

          <p className="mt-3 text-center text-[11px] leading-relaxed text-slate-400">
            Akun dibuat oleh Administration. Hubungi mereka jika belum punya akses.
          </p>
        </div>
      </div>
    </div>
  )
}
