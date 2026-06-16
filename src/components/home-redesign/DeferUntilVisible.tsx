"use client"

import { useEffect, useRef, useState } from "react"

/**
 * Renders its children only once the placeholder scrolls within `rootMargin` of
 * the viewport. Used to defer the homepage's heavy data rails (each fetches +
 * renders a grid of poster images) so they don't all mount on initial load —
 * that fetch-and-render storm was delaying the above-the-fold LCP on mobile
 * (~7.7s vs ~3.9s for the lighter classic homepage).
 *
 * `rootMargin` is generous (default 800px) so a rail is already loaded by the
 * time it's actually scrolled into view — no skeleton flash. A reserved
 * `minHeight` keeps the deferred slot from collapsing; because the swap happens
 * well below the fold, it doesn't cause visible layout shift (CLS stays ~0).
 */
export function DeferUntilVisible({
  children,
  minHeight = 360,
  rootMargin = "800px",
}: {
  children: React.ReactNode
  minHeight?: number
  rootMargin?: string
}) {
  const ref = useRef<HTMLDivElement>(null)
  const [show, setShow] = useState(false)

  useEffect(() => {
    const el = ref.current
    if (!el) return
    if (typeof IntersectionObserver === "undefined") {
      // No IO support → just render (deferred out of the effect body to satisfy
      // the no-sync-setState-in-effect rule).
      queueMicrotask(() => setShow(true))
      return
    }
    const io = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setShow(true)
          io.disconnect()
        }
      },
      { rootMargin },
    )
    io.observe(el)
    return () => io.disconnect()
  }, [rootMargin])

  return (
    <div ref={ref} style={show ? undefined : { minHeight }}>
      {show ? children : null}
    </div>
  )
}
