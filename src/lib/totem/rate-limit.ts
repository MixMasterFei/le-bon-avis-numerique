// In-memory sliding-window rate limiter for the Totem chat endpoint.
// Anon: 5 messages / hour / IP. Auth: 30 / hour / userId.
//
// Known limit (acceptable for alpha): Vercel Fluid Compute keeps multiple
// instances; counters are per-instance and reset on cold start. Phase 2
// should swap this for Upstash Redis (via Vercel Marketplace) for
// accurate cross-instance counters before high-traffic launch.

const HOUR_MS = 60 * 60 * 1000

const ANON_LIMIT = 5
const AUTH_LIMIT = 30

interface Bucket {
  count: number
  resetAt: number
}

const store = new Map<string, Bucket>()

export interface TotemRateLimitResult {
  allowed: boolean
  remaining: number
  retryAfterSec: number
  limit: number
}

export function checkTotemRateLimit(opts: {
  userId: string | null
  ip: string
}): TotemRateLimitResult {
  const now = Date.now()
  const isAuth = !!opts.userId
  const key = isAuth ? `totem:user:${opts.userId}` : `totem:anon:${opts.ip}`
  const limit = isAuth ? AUTH_LIMIT : ANON_LIMIT

  // Light periodic cleanup
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
  return {
    allowed: true,
    remaining: limit - bucket.count,
    retryAfterSec: 0,
    limit,
  }
}

export function getClientIpFromHeaders(headers: Headers): string {
  // Trust order matters: this key feeds rate-limit buckets, so an
  // attacker-controlled header means an attacker-controlled bucket. On Vercel,
  // x-real-ip and x-vercel-forwarded-for are SET BY THE PLATFORM; a client
  // cannot inject them. cf-connecting-ip is deliberately not honored — this
  // site does not sit behind Cloudflare, so that header arrives straight from
  // the client and rotating it minted a fresh bucket per request.
  return (
    headers.get("x-real-ip") ||
    headers.get("x-vercel-forwarded-for")?.split(",")[0]?.trim() ||
    headers.get("x-forwarded-for")?.split(",")[0]?.trim() ||
    "unknown"
  )
}
