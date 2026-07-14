"use client"

import { useEffect, useState } from "react"

// { [mediaId]: { [familyMemberId]: ReactionType-string } }
export type UserReactions = Record<string, Record<string, string>>

// Loaded ONCE per page and shared across every PosterActionBar (like
// useFamilyMembers) — a grid of 30 posters triggers one fetch, not 30.
let promise: Promise<UserReactions> | null = null
let cache: UserReactions | null = null
const subscribers = new Set<(r: UserReactions) => void>()

async function load(): Promise<UserReactions> {
  const res = await fetch("/api/user/reactions/all")
  if (!res.ok) return {}
  const data = await res.json()
  return (data?.reactions as UserReactions) ?? {}
}

function ensureLoaded(): Promise<UserReactions> {
  if (cache) return Promise.resolve(cache)
  if (!promise) {
    promise = load()
      .then((r) => {
        cache = r
        subscribers.forEach((fn) => fn(r))
        return r
      })
      .catch(() => {
        cache = {}
        return {}
      })
  }
  return promise
}

/** The current user's reactions, shared across all bars. `null` while loading. */
export function useUserReactions(enabled: boolean): UserReactions | null {
  const [reactions, setReactions] = useState<UserReactions | null>(cache)

  useEffect(() => {
    if (!enabled) return
    let active = true
    const notify = (r: UserReactions) => {
      if (active) setReactions(r)
    }
    subscribers.add(notify)
    ensureLoaded().then(notify)
    return () => {
      active = false
      subscribers.delete(notify)
    }
  }, [enabled])

  return reactions
}

/** Test/navigation escape hatch. */
export function resetUserReactionsCache(): void {
  promise = null
  cache = null
}
