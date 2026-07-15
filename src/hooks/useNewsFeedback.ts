"use client"

import { useEffect, useState } from "react"

// { [storySlug]: "LIKE" | "DISLIKE" }
export type NewsFeedbackMap = Record<string, string>

// Loaded ONCE per page and shared across every news card's inline feedback
// buttons (same module-cache pattern as useUserReactions) — a feed of 10
// stories triggers one fetch, not 10. Keyed by user, failures not cached,
// write-through updated after successful writes (see useUserReactions for
// the rationale on each property).
let cacheUserId: string | null = null
let promise: Promise<NewsFeedbackMap> | null = null
let cache: NewsFeedbackMap | null = null
const subscribers = new Set<(r: NewsFeedbackMap) => void>()

function resetIfUserChanged(userId: string): void {
  if (cacheUserId === userId) return
  cacheUserId = userId
  promise = null
  cache = null
}

async function load(): Promise<NewsFeedbackMap> {
  const res = await fetch("/api/news/feedback/all")
  if (!res.ok) throw new Error(`HTTP ${res.status}`)
  const data = await res.json()
  return (data?.feedback as NewsFeedbackMap) ?? {}
}

function ensureLoaded(userId: string): Promise<NewsFeedbackMap> {
  resetIfUserChanged(userId)
  if (cache) return Promise.resolve(cache)
  if (!promise) {
    promise = load()
      .then((r) => {
        // In-flight account-switch guard — see useUserReactions.
        if (cacheUserId !== userId) return r
        cache = r
        subscribers.forEach((fn) => fn(r))
        return r
      })
      .catch(() => {
        if (cacheUserId === userId) promise = null
        return {}
      })
  }
  return promise
}

/** The current user's news feedback, shared across cards. `null` while loading. */
export function useNewsFeedback(enabled: boolean, userId?: string | null): NewsFeedbackMap | null {
  const [feedback, setFeedback] = useState<NewsFeedbackMap | null>(
    userId && cacheUserId === userId ? cache : null,
  )

  useEffect(() => {
    if (!enabled || !userId) return
    let active = true
    const notify = (r: NewsFeedbackMap) => {
      if (active) setFeedback(r)
    }
    subscribers.add(notify)
    ensureLoaded(userId).then(notify)
    return () => {
      active = false
      subscribers.delete(notify)
    }
  }, [enabled, userId])

  return feedback
}

/** Write-through after a successful write; `null` verdict = removal.
 *  userId must match the cache owner (account-switch guard). */
export function updateNewsFeedbackCache(userId: string, slug: string, verdict: string | null): void {
  if (!cache || cacheUserId !== userId) return
  const next = { ...cache }
  if (verdict === null) delete next[slug]
  else next[slug] = verdict
  cache = next
  subscribers.forEach((fn) => fn(cache!))
}

/** Test/navigation escape hatch. */
export function resetNewsFeedbackCache(): void {
  cacheUserId = null
  promise = null
  cache = null
}
