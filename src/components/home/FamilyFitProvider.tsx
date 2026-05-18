"use client"

import { createContext, useCallback, useContext, useEffect, useRef, useState } from "react"
import { useSession } from "next-auth/react"

interface MemberFit {
  id: string
  name: string
  emoji: string
  score: number
  level: "excellent" | "good" | "moderate" | "poor"
}

interface ExcludedMember {
  id: string
  name: string
  reason: string
}

interface FamilyFitResult {
  members: MemberFit[]
  familyWarning?: boolean
  communityFlagged?: boolean
  // Admin-only diagnostic. Surfaced by the homepage debug overlay so we
  // can answer "why does Shrek 2 have no avatars?" without diving into
  // the DB. Non-admin responses never carry this field.
  _debug?: { excluded: ExcludedMember[] }
}

interface FamilyFitContextType {
  getFamilyFit: (mediaId: string) => FamilyFitResult | null
  registerMediaId: (mediaId: string) => void
  isLoading: boolean
}

const FamilyFitContext = createContext<FamilyFitContextType>({
  getFamilyFit: () => null,
  registerMediaId: () => {},
  isLoading: false,
})

export function useFamilyFit() {
  return useContext(FamilyFitContext)
}

export function FamilyFitProvider({ children }: { children: React.ReactNode }) {
  const { data: session } = useSession()
  const [results, setResults] = useState<Record<string, FamilyFitResult>>({})
  const [isLoading, setIsLoading] = useState(false)
  const pendingIds = useRef<Set<string>>(new Set())
  const fetchedIds = useRef<Set<string>>(new Set())
  const batchTimer = useRef<ReturnType<typeof setTimeout> | null>(null)

  const fetchBatch = useCallback(async (ids: string[]) => {
    if (ids.length === 0) return
    setIsLoading(true)
    try {
      const res = await fetch("/api/media/batch-family-fit", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ mediaIds: ids }),
      })
      if (res.ok) {
        const data = await res.json()
        setResults((prev) => ({ ...prev, ...data }))
      }
    } catch (error) {
      console.error("Failed to fetch batch family fit:", error)
    } finally {
      setIsLoading(false)
    }
  }, [])

  // Collect media IDs and batch-fetch after a short delay
  const registerMediaId = useCallback(
    (mediaId: string) => {
      if (!session?.user || fetchedIds.current.has(mediaId)) return
      pendingIds.current.add(mediaId)

      // Debounce: wait 200ms for more IDs to accumulate, then fetch
      if (batchTimer.current) clearTimeout(batchTimer.current)
      batchTimer.current = setTimeout(() => {
        const ids = Array.from(pendingIds.current)
        pendingIds.current.clear()
        for (const id of ids) fetchedIds.current.add(id)
        fetchBatch(ids)
      }, 200)
    },
    [session?.user, fetchBatch]
  )

  const getFamilyFit = useCallback(
    (mediaId: string): FamilyFitResult | null => {
      return results[mediaId] ?? null
    },
    [results]
  )

  // Clean up timer on unmount
  useEffect(() => {
    return () => {
      if (batchTimer.current) clearTimeout(batchTimer.current)
    }
  }, [])

  return (
    <FamilyFitContext.Provider value={{ getFamilyFit, registerMediaId, isLoading }}>
      {children}
    </FamilyFitContext.Provider>
  )
}
