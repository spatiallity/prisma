import type { Metadata } from 'next'
import type { ReactNode } from 'react'
import { Plus_Jakarta_Sans, Geist_Mono } from 'next/font/google'
import './globals.css'

// Same typeface as spatiallity/tenderhub-lsi, self-hosted by next/font.
const jakarta = Plus_Jakarta_Sans({
  variable: '--font-jakarta',
  subsets: ['latin'],
  weight: ['400', '500', '600', '700', '800'],
})

const geistMono = Geist_Mono({
  variable: '--font-geist-mono',
  subsets: ['latin'],
})

export const metadata: Metadata = {
  title: {
    default: 'Web Monitoring SPK',
    template: '%s · Web Monitoring SPK',
  },
  description:
    'Sistem monitoring SPK PT SUCOFINDO (Persero) — progress, schedule, design, routing, financial.',
}

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html
      lang="id"
      className={`${jakarta.variable} ${geistMono.variable} h-full antialiased`}
    >
      <body className="min-h-full font-sans">{children}</body>
    </html>
  )
}
