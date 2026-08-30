// In-memory sliding-window limiter for the interpretation step.
// Anon: 10 queries / hour / IP. Auth: 30 / hour / userId.
//
// Same shape and same known limit as src/lib/totem/rate-limit.ts (counters are
// per-instance on Vercel Fluid Compute and reset on cold start) — the accurate
// ceiling is the DB-counted daily cap in daily-cap.ts. Kept as a SEPARATE store
// from Totem's so a busy chat can't spend the search budget or vice versa.

const HOUR_MS = 60 * 60 * 1000

const ANON_LIMIT = 10
const AUTH_LIMIT = 30

interface Bucket {
  count: number
  resetAt: number
}

const store = new Map<string, Bucket>()

export interface NlRateLimitResult {
  allowed: boolean
  remaining: number
  retryAfterSec: number
  limit: number
}

export function checkNlRateLimit(opts: {
  userId: string | null
  ip: string
}): NlRateLimitResult {
  const now = Date.now()
  const isAuth = !!opts.userId
  const key = isAuth ? `nls:user:${opts.userId}` : `nls:anon:${opts.ip}`
  const limit = isAuth ? AUTH_LIMIT : ANON_LIMIT

  if (store.size > 5000) {
    for (const [k, v] of store.entries()) {
      if (v.resetAt < now) store.delete(k)
    }
  }

  const bucket = store.get(key)
  if (!bucket || bucket.resetAt < now) {
    store.set(key, { count: 1, resetAt: now + HOUR_MS })
    return { allowed: true, remaining: limit - 1, retryAfterSec: 0, limit }
  }

  if (bucket.count >= limit) {
    return {
      allowed: false,
      remaining: 0,
      retryAfterSec: Math.max(1, Math.ceil((bucket.resetAt - now) / 1000)),
      limit,
    }
  }

  bucket.count += 1
  store.set(key, bucket)
  return { allowed: true, remaining: limit - bucket.count, retryAfterSec: 0, limit }
}
