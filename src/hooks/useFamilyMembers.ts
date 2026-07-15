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
//
// Keyed by USER (a session change without a full reload must never serve
// another account's family) and failures are not cached (next mount retries).
let cacheUserId: string | null = null
let membersPromise: Promise<QuickMember[]> | null = null
let membersCache: QuickMember[] | null = null
const subscribers = new Set<(m: QuickMember[]) => void>()

function resetIfUserChanged(userId: string): void {
  if (cacheUserId === userId) return
  cacheUserId = userId
  membersPromise = null
  membersCache = null
}

async function loadMembers(): Promise<QuickMember[]> {
  const res = await fetch("/api/user/family")
  if (!res.ok) throw new Error(`HTTP ${res.status}`)
  const data = await res.json()
  const list: QuickMember[] = Array.isArray(data?.familyMembers) ? data.familyMembers : []
  return list
}

function ensureLoaded(userId: string): Promise<QuickMember[]> {
  resetIfUserChanged(userId)
  if (membersCache) return Promise.resolve(membersCache)
  if (!membersPromise) {
    membersPromise = loadMembers()
      .then((m) => {
        // In-flight account-switch guard — see useUserReactions.
        if (cacheUserId !== userId) return m
        membersCache = m
        subscribers.forEach((fn) => fn(m))
        return m
      })
      .catch(() => {
        // Transient failure — don't cache emptiness, retry on next mount.
        if (cacheUserId === userId) membersPromise = null
        return []
      })
  }
  return membersPromise
}

/**
 * Family members for the current user, loaded ONCE per page and shared across
 * all callers. `enabled=false` (or no userId) skips the fetch entirely (e.g.
 * logged-out or flag off). Returns `null` while loading.
 */
export function useFamilyMembers(enabled: boolean, userId?: string | null): QuickMember[] | null {
  const [members, setMembers] = useState<QuickMember[] | null>(
    userId && cacheUserId === userId ? membersCache : null,
  )

  useEffect(() => {
    if (!enabled || !userId) return
    let active = true
    const notify = (m: QuickMember[]) => {
      if (active) setMembers(m)
    }
    subscribers.add(notify)
    ensureLoaded(userId).then(notify)
    return () => {
      active = false
      subscribers.delete(notify)
    }
  }, [enabled, userId])

  return members
}

/** Test/SSR-navigation escape hatch: drop the cache so the next mount refetches. */
export function resetFamilyMembersCache(): void {
  cacheUserId = null
  membersPromise = null
  membersCache = null
}
