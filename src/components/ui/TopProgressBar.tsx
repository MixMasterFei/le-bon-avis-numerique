"use client"

import { useEffect, useState } from "react"
import { createPortal } from "react-dom"
import { cn } from "@/lib/utils"

interface TopProgressBarProps {
  loading: boolean
}

// Minimum time the bar stays visible once it appears. useTransition's
// isPending can flip back to false in <100ms for cached navigations,
// which made the bar invisible (it never had time to fade in). Forcing
// at least one full sweep means filter clicks always produce a visible
// confirmation.
const MIN_VISIBLE_MS = 600

/**
 * Slim 4px progress bar pinned to the top of the viewport. Indeterminate
 * (slides across) — used as a "something is happening" signal while the
 * listing pages refetch after a filter or pagination change. NProgress /
 * YouTube / Vercel pattern.
 *
 * Rendered via a portal to document.body so the fixed positioning isn't
 * trapped by any ancestor stacking context (the sticky sidebar created
 * one) and the bar always paints above the site header.
 */
export function TopProgressBar({ loading }: TopProgressBarProps) {
  const [visible, setVisible] = useState(false)

  // Show immediately when loading flips true; hold for MIN_VISIBLE_MS
  // after it flips back to false so very fast navigations still show a
  // full sweep.
  useEffect(() => {
    if (loading) {
      const t = window.setTimeout(() => setVisible(true), 0)
      return () => clearTimeout(t)
    }
    const t = setTimeout(() => setVisible(false), MIN_VISIBLE_MS)
    return () => clearTimeout(t)
  }, [loading])

  if (typeof document === "undefined") return null

  const bar = (
    <div
      aria-hidden
      role="presentation"
      className={cn(
        "fixed top-0 left-0 right-0 h-[4px] overflow-hidden pointer-events-none transition-opacity duration-150",
        visible ? "opacity-100" : "opacity-0",
      )}
      style={{ zIndex: 9999 }}
    >
      <div
        className="h-full w-1/3 bg-gradient-to-r from-rose-400 via-rose-600 to-rose-400 shadow-[0_0_8px_rgba(244,63,94,0.5)]"
        style={{
          animation: visible ? "top-progress-slide 1.1s ease-in-out infinite" : "none",
          willChange: "transform",
        }}
      />
    </div>
  )

  return createPortal(bar, document.body)
}
