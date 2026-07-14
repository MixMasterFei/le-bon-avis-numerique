"use client"

import { useEffect, useState } from "react"

export interface QuickMember {
  id: string
  name: string
  avatarEmoji?: string | null
  avatarStyle?: string | null
  avatarSeed?: string | null
  avatarOptions?: Record<string, unknown> | null
}

// A whole grid of PosterActionBars must not each fetch the family. One
// module-level promise dedupes the GET across every instance for the page's
// lifetime; subscribers are notified once it resolves.
let membersPromise: Promise<QuickMember[]> | null = null
let membersCache: QuickMember[] | null = null
const subscribers = new Set<(m: QuickMember[]) => void>()

async function loadMembers(): Promise<QuickMember[]> {
  const res = await fetch("/api/user/family")
  if (!res.ok) return []
  const data = await res.json()
  const list: QuickMember[] = Array.isArray(data?.familyMembers) ? data.familyMembers : []
  return list
}

function ensureLoaded(): Promise<QuickMember[]> {
  if (membersCache) return Promise.resolve(membersCache)
  if (!membersPromise) {
    membersPromise = loadMembers()
      .then((m) => {
        membersCache = m
        subscribers.forEach((fn) => fn(m))
        return m
      })
      .catch(() => {
        membersCache = []
        return []
      })
  }
  return membersPromise
}

/**
 * Family members for the current user, loaded ONCE per page and shared across
 * all callers. `enabled=false` skips the fetch entirely (e.g. logged-out or
 * flag off). Returns `null` while loading.
 */
export function useFamilyMembers(enabled: boolean): QuickMember[] | null {
  const [members, setMembers] = useState<QuickMember[] | null>(membersCache)

  useEffect(() => {
    if (!enabled) return
    let active = true
    const notify = (m: QuickMember[]) => {
      if (active) setMembers(m)
    }
    subscribers.add(notify)
    ensureLoaded().then(notify)
    return () => {
      active = false
      subscribers.delete(notify)
    }
  }, [enabled])

  return members
}

/** Test/SSR-navigation escape hatch: drop the cache so the next mount refetches. */
export function resetFamilyMembersCache(): void {
  membersPromise = null
  membersCache = null
}
