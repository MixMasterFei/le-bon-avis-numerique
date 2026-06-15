"use client"

import { createContext, useContext } from "react"

/**
 * Carries the server-computed V2 gate (admin or HOMEPAGE_V2_PUBLIC) down to
 * client components so they can swap to the V2 visual language WITHOUT each one
 * re-checking auth. The value is rendered into the SSR tree from the root
 * layout, so server and client agree on first paint (no hydration mismatch).
 *
 * Currently consumed by MemberAvatar (→ monogram). The site-wide font swap is
 * handled separately in CSS via the `data-v2-type` attribute on <html>.
 */
const V2TypeContext = createContext(false)

export function V2TypeProvider({
  value,
  children,
}: {
  value: boolean
  children: React.ReactNode
}) {
  return <V2TypeContext.Provider value={value}>{children}</V2TypeContext.Provider>
}

export function useV2Type(): boolean {
  return useContext(V2TypeContext)
}
