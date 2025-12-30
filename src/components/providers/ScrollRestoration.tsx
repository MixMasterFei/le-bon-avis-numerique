"use client"

import { useEffect } from "react"
import { usePathname } from "next/navigation"

// Store scroll positions for each path
const scrollPositions: Record<string, number> = {}

export function ScrollRestoration() {
  const pathname = usePathname()

  useEffect(() => {
    // Restore scroll position when navigating back
    if (typeof window !== "undefined") {
      // Set browser to manual scroll restoration
      if ("scrollRestoration" in window.history) {
        window.history.scrollRestoration = "manual"
      }

      // Save scroll position before navigating away
      const handleBeforeUnload = () => {
        scrollPositions[pathname] = window.scrollY
      }

      // Save on scroll (debounced)
      let scrollTimeout: NodeJS.Timeout
      const handleScroll = () => {
        clearTimeout(scrollTimeout)
        scrollTimeout = setTimeout(() => {
          scrollPositions[pathname] = window.scrollY
        }, 100)
      }

      // Restore position on popstate (back/forward navigation)
      const handlePopState = () => {
        const savedPosition = scrollPositions[pathname]
        if (savedPosition !== undefined) {
          // Use requestAnimationFrame to ensure DOM is ready
          requestAnimationFrame(() => {
            window.scrollTo(0, savedPosition)
          })
        }
      }

      window.addEventListener("beforeunload", handleBeforeUnload)
      window.addEventListener("scroll", handleScroll, { passive: true })
      window.addEventListener("popstate", handlePopState)

      // Restore scroll position if we have one saved for this path
      const savedPosition = scrollPositions[pathname]
      if (savedPosition !== undefined) {
        requestAnimationFrame(() => {
          window.scrollTo(0, savedPosition)
        })
      }

      return () => {
        clearTimeout(scrollTimeout)
        window.removeEventListener("beforeunload", handleBeforeUnload)
        window.removeEventListener("scroll", handleScroll)
        window.removeEventListener("popstate", handlePopState)
      }
    }
  }, [pathname])

  return null
}
