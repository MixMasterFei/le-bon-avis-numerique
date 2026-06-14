/**
 * Params that must survive every in-page navigation on the catalogue (filter
 * changes, pagination, the variant toggle). Without carrying `v` through, an
 * admin browsing the V2 variant would be bounced back to classic the moment
 * they touched a filter or changed page. `font` is the existing dev font
 * override that ApercuFilterSidebar already preserved ad hoc.
 */
// `demographic` is manga-only (never present on other routes, so a harmless
// no-op there) — carrying it keeps the shounen/shoujo selection alive when a
// manga filter changes.
const STICKY_KEYS = ["font", "v", "demographic"] as const

/**
 * Copy the sticky params from `current` into `target` (in place), unless
 * `target` already sets them. Returns `target` for chaining.
 */
export function preserveStickyParams(
  target: URLSearchParams,
  current: URLSearchParams | null | undefined,
): URLSearchParams {
  if (!current) return target
  for (const key of STICKY_KEYS) {
    if (target.has(key)) continue
    const value = current.get(key)
    if (value) target.set(key, value)
  }
  return target
}
