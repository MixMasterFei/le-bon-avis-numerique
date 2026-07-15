"use client"

import { useEffect, useState } from "react"

// { [storySlug]: "LIKE" | "DISLIKE" }
export type NewsFeedbackMap = Record<string, string>

// Loaded ONCE per page and shared across every news card's inline feedback
// buttons (same module-cache pattern as useUserReactions) — a feed of 10
// stories triggers one fetch, not 10.
let promise: Promise<NewsFeedbackMap> | null = null
let cache: NewsFeedbackMap | null = null
const subscribers = new Set<(r: NewsFeedbackMap) => void>()

async function load(): Promise<NewsFeedbackMap> {
  const res = await fetch("/api/news/feedback/all")
  if (!res.ok) return {}
  const data = await res.json()
  return (data?.feedback as NewsFeedbackMap) ?? {}
}

function ensureLoaded(): Promise<NewsFeedbackMap> {
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

/** The current user's news feedback, shared across cards. `null` while loading. */
export function useNewsFeedback(enabled: boolean): NewsFeedbackMap | null {
  const [feedback, setFeedback] = useState<NewsFeedbackMap | null>(cache)

  useEffect(() => {
    if (!enabled) return
    let active = true
    const notify = (r: NewsFeedbackMap) => {
      if (active) setFeedback(r)
    }
    subscribers.add(notify)
    ensureLoaded().then(notify)
    return () => {
      active = false
      subscribers.delete(notify)
    }
  }, [enabled])

  return feedback
}

/** Test/navigation escape hatch. */
export function resetNewsFeedbackCache(): void {
  promise = null
  cache = null
}
