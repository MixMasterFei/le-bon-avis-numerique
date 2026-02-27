"use client"

import { useEffect, useRef } from "react"
import { usePathname } from "next/navigation"

/**
 * Handles scroll restoration for Next.js App Router:
 * - Forward navigation (link clicks): scrolls to top (Next.js default)
 * - Back/forward navigation: restores previous scroll position
 */
export function ScrollRestoration() {
  const pathname = usePathname()
  const prevPathname = useRef(pathname)
  const scrollMap = useRef<Map<string, number>>(new Map())
  const isPopState = useRef(false)

  // Track back/forward navigation via popstate
  useEffect(() => {
    if ("scrollRestoration" in window.history) {
      window.history.scrollRestoration = "manual"
    }

    const handlePopState = () => {
      isPopState.current = true
    }
    window.addEventListener("popstate", handlePopState)
    return () => window.removeEventListener("popstate", handlePopState)
  }, [])

  // Save/restore scroll on pathname change
  useEffect(() => {
    if (prevPathname.current !== pathname) {
      // Save scroll position for the page we're leaving
      scrollMap.current.set(prevPathname.current, window.scrollY)

      if (isPopState.current) {
        // Back/forward: restore saved position
        const saved = scrollMap.current.get(pathname)
        if (saved !== undefined) {
          // Wait for DOM to render, then restore
          requestAnimationFrame(() => {
            setTimeout(() => window.scrollTo(0, saved), 0)
          })
        }
        isPopState.current = false
      }
      // Forward navigation: Next.js <Link> already scrolls to top

      prevPathname.current = pathname
    }
  }, [pathname])

  return null
}
