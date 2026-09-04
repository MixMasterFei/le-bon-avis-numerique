// Atomic shared hourly limiter for interpretation and refinement.
// Anon: 10 queries / hour / IP. Auth: 30 / hour / userId.
// A separate namespace keeps chat and search budgets independent.
import { checkSharedRateLimit } from "../auth-rate-limit"

const HOUR_MS = 60 * 60 * 1000

const ANON_LIMIT = 10
const AUTH_LIMIT = 30

interface Bucket {
  count: number
  resetAt: number
}

const store = new Map<string, Bucket>()

// The non-paid board and ballot limits remain local. Keep their cleanup even
// though paid searches no longer use this store.
function cleanupLocalStore(now: number) {
  if (store.size > 5000) {
    for (const [key, bucket] of store.entries()) {
      if (bucket.resetAt < now) store.delete(key)
    }
  }
}

export interface NlRateLimitResult {
  allowed: boolean
  remaining: number
  retryAfterSec: number
  limit: number
  unavailable?: boolean
}

export async function checkNlRateLimit(opts: {
  userId: string | null
  ip: string
}): Promise<NlRateLimitResult> {
  const isAuth = !!opts.userId
  const key = isAuth ? `user:${opts.userId}` : `anon:${opts.ip}`
  const limit = isAuth ? AUTH_LIMIT : ANON_LIMIT

  const result = await checkSharedRateLimit(key, {
    namespace: "nl-search-hourly", maxRequests: limit, windowMs: HOUR_MS,
  })
  return {
    allowed: result.allowed,
    remaining: result.remaining,
    retryAfterSec: result.allowed ? 0 : Math.max(1, Math.ceil(result.resetIn / 1000)),
    limit,
    ...(result.unavailable ? { unavailable: true } : {}),
  }
}

/**
 * Separate, tighter window for creating boards. Sharing is a write that
 * produces a public URL, so it gets its own budget rather than drawing on the
 * search one — a burst of share clicks must not cost anyone their searches.
 */
const BOARD_ANON_LIMIT = 5
const BOARD_AUTH_LIMIT = 20

export function checkBoardRateLimit(opts: { userId: string | null; ip: string }): NlRateLimitResult {
  const now = Date.now()
  cleanupLocalStore(now)
  const isAuth = !!opts.userId
  const key = isAuth ? `nlb:user:${opts.userId}` : `nlb:anon:${opts.ip}`
  const limit = isAuth ? BOARD_AUTH_LIMIT : BOARD_ANON_LIMIT

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

/**
 * Voting taps its own window: a ballot round involves several taps per person
 * (3 badges plus corrections), so the ceiling is higher than board creation —
 * but still an hourly wall against scripted ballot stuffing from one address.
 */
const VOTE_LIMIT = 60

export function checkVoteRateLimit(ip: string): NlRateLimitResult {
  const now = Date.now()
  cleanupLocalStore(now)
  const key = `nlv:anon:${ip}`

  const bucket = store.get(key)
  if (!bucket || bucket.resetAt < now) {
    store.set(key, { count: 1, resetAt: now + HOUR_MS })
    return { allowed: true, remaining: VOTE_LIMIT - 1, retryAfterSec: 0, limit: VOTE_LIMIT }
  }
  if (bucket.count >= VOTE_LIMIT) {
    return {
      allowed: false,
      remaining: 0,
      retryAfterSec: Math.max(1, Math.ceil((bucket.resetAt - now) / 1000)),
      limit: VOTE_LIMIT,
    }
  }
  bucket.count += 1
  store.set(key, bucket)
  return { allowed: true, remaining: VOTE_LIMIT - bucket.count, retryAfterSec: 0, limit: VOTE_LIMIT }
}
