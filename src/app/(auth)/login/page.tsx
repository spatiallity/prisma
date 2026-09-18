import type { Metadata } from 'next'
import Image from 'next/image'
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
      <div className="hidden flex-col bg-[#123254] lg:flex lg:w-[52%]">
        <div className="flex h-full flex-col justify-between p-12">
          <div className="flex items-center gap-4">
            <Image
              src="/idsurvey-white.png"
              alt="IDSurvey"
              width={180}
              height={36}
              className="h-9 w-auto object-contain"
              priority
            />
            <span className="h-12 w-px bg-white/25" aria-hidden />
            <Image
              src="/sucofindo-white.png"
              alt="PT Sucofindo"
              width={160}
              height={110}
              className="h-16 w-auto object-contain"
              priority
            />
          </div>

          <div className="flex flex-1 flex-col justify-center">
            <h1 className="text-6xl font-black text-white">{BRAND.name}</h1>
            <p className="mt-3 max-w-lg text-base font-medium leading-7 text-slate-200">
              {BRAND.expansion}
            </p>
            <div className="mt-8 border-l-2 border-primary pl-4 text-sm leading-6 text-slate-200">
              <p>Sistem Monitoring Survei Topografi Lokasi Bor dan Fasilitas Produksi</p>
              <p>PT Pertamina EP Zona 4 Prabumulih</p>
            </div>
          </div>

          <div className="border-t border-white/10 pt-4">
            <p className="text-[11px] text-slate-500">
              © {BRAND.year} {BRAND.owner}
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
