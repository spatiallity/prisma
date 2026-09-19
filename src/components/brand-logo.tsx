import Image from 'next/image'
import { BRAND } from '@/lib/brand'
import { cn } from '@/lib/utils'

/** Intrinsic ratio of public/prisma-logo.png (2172 × 724). */
const RATIO = 3

/** Shared PRISMA mark, sized by height so it stays balanced in each shell. */
export function BrandLogo({
  height = 32,
  className,
  priority = false,
}: {
  height?: number
  className?: string
  priority?: boolean
}) {
  return (
    <Image
      src="/prisma-logo.png"
      alt={`${BRAND.name} — ${BRAND.expansion}`}
      width={Math.round(height * RATIO)}
      height={height}
      className={cn('h-auto w-auto object-contain', className)}
      style={{ height, width: 'auto' }}
      priority={priority}
    />
  )
}
