import { LogOut } from 'lucide-react'
import { Button } from '@/components/ui/button'

/** Sign-out is a POST so a link prefetch can never end the session. */
export function SignOutButton({ className }: { className?: string }) {
  return (
    <form action="/auth/signout" method="post" className={className}>
      <Button type="submit" variant="secondary" className="w-full">
        <LogOut className="h-4 w-4" aria-hidden />
        Keluar
      </Button>
    </form>
  )
}
