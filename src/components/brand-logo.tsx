import Image from 'next/image'
import { BRAND } from '@/lib/brand'
import { cn } from '@/lib/utils'

/** Intrinsic ratio of public/prisma-logo.svg (viewBox 940.5 × 513.75). */
const RATIO = 940.5 / 513.75

/**
 * The logo carries raster data inside the SVG wrapper, so next/image is told
 * not to try optimising it — it would only re-encode what is already bitmap.
 */
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
      src="/prisma-logo.svg"
      alt={`${BRAND.name} — ${BRAND.expansion}`}
      width={Math.round(height * RATIO)}
      height={height}
      className={cn('h-auto w-auto object-contain', className)}
      style={{ height, width: 'auto' }}
      unoptimized
      priority={priority}
    />
  )
}
