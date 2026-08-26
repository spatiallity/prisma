import type { ReactNode } from 'react'

/** The split-panel frame lives in the login page itself; other auth screens
 *  (setup, inactive, no-profile) just get centred on the same slate ground. */
export default function AuthLayout({ children }: { children: ReactNode }) {
  return <div className="min-h-dvh bg-surface-muted">{children}</div>
}
