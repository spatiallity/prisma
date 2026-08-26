import type { Metadata } from 'next'
import { FolderKanban, Map, Percent, Wallet } from 'lucide-react'
import { BRAND, BRAND_LETTERS } from '@/lib/brand'
import { BrandLogo } from '@/components/brand-logo'
import { LoginForm } from './login-form'

export const metadata: Metadata = { title: 'Masuk' }

/** Section 1 — the four things the system replaces the spreadsheets with. */
const FEATURES = [
  {
    icon: FolderKanban,
    label: 'SPK sebagai Pusat Data',
    desc: 'Setiap progress, desain, routing, dan angka financial menempel pada satu SPK.',
  },
  {
    icon: Percent,
    label: 'Progress Otomatis',
    desc: 'Bobot aktivitas dihitung sistem — tidak ada lagi persen yang diketik manual.',
  },
  {
    icon: Map,
    label: 'Monitoring Lapangan',
    desc: 'Daily Plan dan Daily Progress per tim vendor, lengkap dengan produktivitas.',
  },
  {
    icon: Wallet,
    label: 'Cost & Margin per SPK',
    desc: 'Kas kecil, personnel cost, dan vendor payment bertemu di satu perhitungan margin.',
  },
]

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

        <div className="relative z-10 flex h-full flex-col p-12">
          <div className="mb-8">
            <div className="mb-3 text-[10px] font-bold tracking-widest text-slate-400 uppercase">
              {BRAND.owner}
            </div>
            <h1 className="sr-only">{BRAND.name}</h1>
            {/* The mark sits on a dark gradient, so it gets a light plate. */}
            <div className="inline-flex rounded-2xl bg-white/95 px-5 py-3 shadow-lg shadow-black/20">
              <BrandLogo height={56} priority />
            </div>

            {/* The acronym, spelled out. */}
            <div className="mt-4 flex flex-wrap gap-x-5 gap-y-2">
              {BRAND_LETTERS.map(({ letter, word }) => (
                <div key={letter} className="flex items-baseline gap-1.5">
                  <span
                    className="text-lg font-black"
                    style={{ color: '#13B2AA' }}
                    aria-hidden
                  >
                    {letter}
                  </span>
                  <span className="text-xs font-semibold text-slate-300">
                    {word}
                  </span>
                </div>
              ))}
            </div>

            <p className="mt-5 max-w-sm text-sm leading-relaxed text-slate-300">
              Sistem kontrol project {BRAND.project} — {BRAND.client}. Satu tempat
              untuk pekerjaan lapangan, desain, routing dokumen, dan kondisi
              financial setiap SPK.
            </p>
          </div>

          <div className="flex flex-1 flex-col gap-3">
            {FEATURES.map(({ icon: Icon, label, desc }) => (
              <div key={label} className="flex items-start gap-3">
                <div
                  className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl"
                  style={{
                    background: 'rgba(19, 178, 170, 0.15)',
                    border: '1px solid rgba(19, 178, 170, 0.3)',
                  }}
                >
                  <Icon size={16} style={{ color: '#13B2AA' }} aria-hidden />
                </div>
                <div>
                  <div className="text-sm font-bold text-white">{label}</div>
                  <div className="mt-0.5 text-xs leading-relaxed text-slate-400">
                    {desc}
                  </div>
                </div>
              </div>
            ))}
          </div>

          <div className="mt-6 border-t border-white/10 pt-4">
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
              <BrandLogo height={44} className="mb-4" priority />
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
