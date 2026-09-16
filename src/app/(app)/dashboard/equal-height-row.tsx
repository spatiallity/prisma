'use client'

import { useEffect, useRef, useState, type ReactNode } from 'react'

/**
 * The Bottleneck card's own content (however many rows it has right now)
 * has no relationship to the left column's (design charts + SPK table) —
 * relying on CSS align-items:stretch alone (tried both as a Grid and as a
 * Flexbox row) kept rendering each side at its own natural content height
 * instead of matching them. This measures the left column with a
 * ResizeObserver and applies that as an explicit pixel height on the right,
 * which sidesteps the stretch/automatic-minimum-size ambiguity entirely —
 * once the wrapper has a real height value, the Card inside it (h-full +
 * flex column + min-h-0 on its scrolling list) clips and scrolls exactly
 * like the SPK Sedang Berjalan table does within its own fixed max-height.
 */
export function EqualHeightRow({ left, right }: { left: ReactNode; right: ReactNode }) {
  const leftRef = useRef<HTMLDivElement>(null)
  const [height, setHeight] = useState<number>()

  useEffect(() => {
    const el = leftRef.current
    if (!el) return
    const observer = new ResizeObserver((entries) => {
      const next = entries[0]?.contentRect.height
      if (next) setHeight(next)
    })
    observer.observe(el)
    return () => observer.disconnect()
  }, [])

  return (
    <div className="flex flex-col gap-5 lg:flex-row lg:items-start">
      <div ref={leftRef} className="min-w-0 lg:flex-[2]">
        {left}
      </div>
      <div className="min-w-0 lg:flex-1" style={height ? { height } : undefined}>
        {right}
      </div>
    </div>
  )
}
