"use client"

import { cn } from "@/lib/utils"

interface TopProgressBarProps {
  loading: boolean
}

/**
 * Slim 2px progress bar pinned to the top of the viewport. Indeterminate
 * (slides across) — used as a "something is happening" signal while the
 * listing pages refetch after a filter or pagination change. Modeled on the
 * NProgress / YouTube / Vercel pattern: discreet enough to coexist with the
 * editorial layout, impossible to miss because it's at the very top of the
 * screen.
 *
 * Pair it with a grid-opacity dim (`opacity-60 pointer-events-none`) on
 * stale results so users get *both* signals (top bar = work happening,
 * dim grid = these results are stale).
 */
export function TopProgressBar({ loading }: TopProgressBarProps) {
  return (
    <div
      aria-hidden
      role="presentation"
      className={cn(
        "fixed top-0 left-0 right-0 z-50 h-[2px] overflow-hidden pointer-events-none transition-opacity duration-200",
        loading ? "opacity-100" : "opacity-0",
      )}
    >
      <div
        className="h-full w-1/3 bg-gradient-to-r from-rose-400 via-rose-500 to-rose-400"
        style={{
          animation: loading ? "top-progress-slide 1.2s ease-in-out infinite" : "none",
          willChange: "transform",
        }}
      />
    </div>
  )
}
