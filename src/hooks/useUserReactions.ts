"use client"

import { useEffect, useState } from "react"

// { [mediaId]: { [familyMemberId]: ReactionType-string } }
export type UserReactions = Record<string, Record<string, string>>

// Loaded ONCE per page and shared across every PosterActionBar (like
// useFamilyMembers) — a grid of 30 posters triggers one fetch, not 30.
//
// The cache is KEYED BY USER: a session change (logout → other account
// without a full reload) invalidates it, so one account's reactions can
// never leak into another's UI. Failures are NOT cached — the next mount
// retries instead of pinning an empty result forever. Successful writes
// update the cache in place (write-through) so a remounted card never
// resurrects a stale pre-write state.
let cacheUserId: string | null = null
let promise: Promise<UserReactions> | null = null
let cache: UserReactions | null = null
const subscribers = new Set<(r: UserReactions) => void>()

function resetIfUserChanged(userId: string): void {
  if (cacheUserId === userId) return
  cacheUserId = userId
  promise = null
  cache = null
}

async function load(): Promise<UserReactions> {
  const res = await fetch("/api/user/reactions/all")
  if (!res.ok) throw new Error(`HTTP ${res.status}`)
  const data = await res.json()
  return (data?.reactions as UserReactions) ?? {}
}

function ensureLoaded(userId: string): Promise<UserReactions> {
  resetIfUserChanged(userId)
  if (cache) return Promise.resolve(cache)
  if (!promise) {
    promise = load()
      .then((r) => {
        // In-flight account-switch guard: if the session changed while this
        // request was running, its result belongs to the PREVIOUS account —
        // discard it instead of populating the new account's cache.
        if (cacheUserId !== userId) return r
        cache = r
        subscribers.forEach((fn) => fn(r))
        return r
      })
      .catch(() => {
        // Transient failure: DON'T cache emptiness — clear the promise so
        // the next mount retries, and serve {} for now. Only clear it if it
        // is still OURS (a session switch already replaced it).
        if (cacheUserId === userId) promise = null
        return {}
      })
  }
  return promise
}

/** The current user's reactions, shared across all bars. `null` while loading. */
export function useUserReactions(enabled: boolean, userId?: string | null): UserReactions | null {
  const [reactions, setReactions] = useState<UserReactions | null>(
    userId && cacheUserId === userId ? cache : null,
  )

  useEffect(() => {
    if (!enabled || !userId) return
    let active = true
    const notify = (r: UserReactions) => {
      if (active) setReactions(r)
    }
    subscribers.add(notify)
    ensureLoaded(userId).then(notify)
    return () => {
      active = false
      subscribers.delete(notify)
    }
  }, [enabled, userId])

  return reactions
}

/**
 * Write-through after a SUCCESSFUL reaction write: keeps the shared cache in
 * sync so a component that remounts (rail swap, navigation back) seeds from
 * the post-write state, not the stale preload. Pass `reaction: null` for a
 * removal. The userId must match the cache owner — a late write finishing
 * after an account switch is discarded.
 */
export function updateUserReactionsCache(
  userId: string,
  mediaId: string,
  familyMemberId: string,
  reaction: string | null,
): void {
  if (!cache || cacheUserId !== userId) return
  const forMedia = { ...(cache[mediaId] ?? {}) }
  if (reaction === null) delete forMedia[familyMemberId]
  else forMedia[familyMemberId] = reaction
  cache = { ...cache, [mediaId]: forMedia }
  subscribers.forEach((fn) => fn(cache!))
}

/** Test/navigation escape hatch. */
export function resetUserReactionsCache(): void {
  cacheUserId = null
  promise = null
  cache = null
}
