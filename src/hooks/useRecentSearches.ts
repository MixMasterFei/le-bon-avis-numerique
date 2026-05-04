"use client"

import { useCallback, useEffect, useState } from "react"

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

function read(): RecentSearchEntry[] {
  if (typeof window === "undefined") return []
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY)
    if (!raw) return []
    const parsed = JSON.parse(raw)
    if (!Array.isArray(parsed)) return []
    return parsed.filter(
      (e): e is RecentSearchEntry =>
        typeof e === "object" &&
        e !== null &&
        typeof (e as RecentSearchEntry).q === "string" &&
        typeof (e as RecentSearchEntry).ts === "number",
    )
  } catch {
    return []
  }
}

function write(entries: RecentSearchEntry[]) {
  if (typeof window === "undefined") return
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(entries))
  } catch {
    // Quota / private mode — silently noop. Recent searches is a nice-
    // to-have, never load-bearing.
  }
}

export function useRecentSearches() {
  const [entries, setEntries] = useState<RecentSearchEntry[]>([])

  useEffect(() => {
    setEntries(read())
  }, [])

  const add = useCallback((entry: Omit<RecentSearchEntry, "ts">) => {
    const q = entry.q.trim()
    if (!q) return
    setEntries((prev) => {
      // Dedup by lowercased query — the same search typed with
      // different casing shouldn't waste a slot.
      const key = q.toLowerCase()
      const filtered = prev.filter((e) => e.q.toLowerCase() !== key)
      const next = [{ ...entry, q, ts: Date.now() }, ...filtered].slice(
        0,
        MAX_ENTRIES,
      )
      write(next)
      return next
    })
  }, [])

  const remove = useCallback((q: string) => {
    setEntries((prev) => {
      const next = prev.filter((e) => e.q.toLowerCase() !== q.toLowerCase())
      write(next)
      return next
    })
  }, [])

  const clear = useCallback(() => {
    setEntries([])
    write([])
  }, [])

  return { entries, add, remove, clear }
}
