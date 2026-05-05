"use client"

import { useCallback, useSyncExternalStore } from "react"

const STORAGE_KEY = "totem.recentSearches.v1"
const MAX_ENTRIES = 8

export interface RecentSearchEntry {
  q: string
  ts: number
  // When the user clicks an autocomplete suggestion (vs. typing + Enter)
  // we remember the destination so re-clicking the entry jumps straight
  // back to the media detail instead of running a new search.
  href?: string
  title?: string
}

// Module-level cache so useSyncExternalStore's getSnapshot returns the
// SAME array reference across calls when the underlying value hasn't
// changed. Returning a fresh `JSON.parse(...)` array on every call
// would trigger an infinite render loop (React detects "the snapshot
// changed" because the reference is new).
let cachedRaw = ""
let cachedSnapshot: RecentSearchEntry[] = []
const EMPTY: RecentSearchEntry[] = []

function parse(raw: string): RecentSearchEntry[] {
  if (!raw) return EMPTY
  try {
    const parsed = JSON.parse(raw)
    if (!Array.isArray(parsed)) return EMPTY
    return parsed.filter(
      (e): e is RecentSearchEntry =>
        typeof e === "object" &&
        e !== null &&
        typeof (e as RecentSearchEntry).q === "string" &&
        typeof (e as RecentSearchEntry).ts === "number",
    )
  } catch {
    return EMPTY
  }
}

function getSnapshot(): RecentSearchEntry[] {
  if (typeof window === "undefined") return EMPTY
  const raw = window.localStorage.getItem(STORAGE_KEY) ?? ""
  if (raw === cachedRaw) return cachedSnapshot
  cachedRaw = raw
  cachedSnapshot = parse(raw)
  return cachedSnapshot
}

// SSR snapshot — must be stable too (returning a fresh [] every call
// would also trigger a hydration mismatch warning).
function getServerSnapshot(): RecentSearchEntry[] {
  return EMPTY
}

const listeners = new Set<() => void>()

function subscribe(callback: () => void): () => void {
  listeners.add(callback)
  // Cross-tab sync: a recent search added in another tab updates here too.
  const onStorage = (e: StorageEvent) => {
    if (e.key === STORAGE_KEY) {
      cachedRaw = "" // force re-read on next getSnapshot
      callback()
    }
  }
  if (typeof window !== "undefined") {
    window.addEventListener("storage", onStorage)
  }
  return () => {
    listeners.delete(callback)
    if (typeof window !== "undefined") {
      window.removeEventListener("storage", onStorage)
    }
  }
}

function writeAndEmit(entries: RecentSearchEntry[]) {
  if (typeof window === "undefined") return
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(entries))
  } catch {
    // Quota / private mode — silently noop. Recent searches is a nice-
    // to-have, never load-bearing.
  }
  // Invalidate cache + notify subscribers in the same tab (storage event
  // only fires in OTHER tabs, so we need our own broadcast for same-tab
  // updates from add/remove/clear).
  cachedRaw = ""
  for (const l of listeners) l()
}

export function useRecentSearches() {
  const entries = useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot)

  const add = useCallback((entry: Omit<RecentSearchEntry, "ts">) => {
    const q = entry.q.trim()
    if (!q) return
    const prev = getSnapshot()
    // Dedup by lowercased query — the same search typed with different
    // casing shouldn't waste a slot.
    const key = q.toLowerCase()
    const filtered = prev.filter((e) => e.q.toLowerCase() !== key)
    const next = [{ ...entry, q, ts: Date.now() }, ...filtered].slice(0, MAX_ENTRIES)
    writeAndEmit(next)
  }, [])

  const remove = useCallback((q: string) => {
    const prev = getSnapshot()
    const next = prev.filter((e) => e.q.toLowerCase() !== q.toLowerCase())
    writeAndEmit(next)
  }, [])

  const clear = useCallback(() => {
    writeAndEmit(EMPTY)
  }, [])

  return { entries, add, remove, clear }
}
