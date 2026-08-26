import type { Metadata } from 'next'
import { FolderKanban, Map, Percent, Wallet } from 'lucide-react'
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
          <div className="mb-10">
            <div className="mb-3 text-[10px] font-bold tracking-widest text-slate-400 uppercase">
              PT Sucofindo (Persero)
            </div>
            <h1 className="mb-4 text-4xl leading-tight font-black text-white">
              Sistem Kontrol
              <br />
              <span style={{ color: '#13B2AA' }}>Monitoring SPK</span>
              <br />
              Survei Topografi Pertamina EP Zona 4
            </h1>
            <p className="max-w-sm text-base leading-relaxed text-slate-300">
              Satu tempat untuk memantau pekerjaan lapangan, desain, routing dokumen,
              dan kondisi financial setiap SPK.
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
              © 2026 PT SUCOFINDO (Persero) · Project Survei Topografi Lokasi Bor
              dan Fasilitas Produksi
            </p>
          </div>
        </div>
      </div>

      {/* Right — form */}
      <div className="flex flex-1 items-center justify-center overflow-y-auto bg-surface-muted p-4 lg:p-6">
        <div className="w-full max-w-md">
          <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
            <div className="mb-6 flex flex-col items-center text-center">
              <div className="mb-3 flex h-14 w-14 items-center justify-center rounded-2xl bg-primary text-lg font-black text-white">
                SPK
              </div>
              <h2 className="mb-0.5 text-xl font-black text-slate-900">
                Selamat Datang
              </h2>
              <p className="text-xs text-slate-500">
                Masuk dengan akun Anda untuk melanjutkan.
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
