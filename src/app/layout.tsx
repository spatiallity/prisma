import type { Metadata } from 'next'
import type { ReactNode } from 'react'
import { Plus_Jakarta_Sans } from 'next/font/google'
import { BRAND } from '@/lib/brand'
import './globals.css'

// Same typeface as spatiallity/tenderhub-lsi, self-hosted by next/font.
const jakarta = Plus_Jakarta_Sans({
  variable: '--font-jakarta',
  subsets: ['latin'],
  weight: ['400', '500', '600', '700', '800'],
})


export const metadata: Metadata = {
  title: {
    default: `${BRAND.name} — ${BRAND.expansion}`,
    template: `%s · ${BRAND.name}`,
  },
  description: `${BRAND.expansion}. Sistem kontrol project ${BRAND.project} — ${BRAND.owner}.`,
}

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html
      lang="id"
      className={`${jakarta.variable} h-full antialiased`}
    >
      <body className="min-h-full font-sans">{children}</body>
    </html>
  )
}
