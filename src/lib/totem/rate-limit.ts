// Atomic shared hourly rate limiter for the Totem chat endpoint.
// Anon: 5 messages / hour / IP. Auth: 30 / hour / userId.
import { checkSharedRateLimit } from "../auth-rate-limit"

const HOUR_MS = 60 * 60 * 1000

const ANON_LIMIT = 5
const AUTH_LIMIT = 30

export interface TotemRateLimitResult {
  allowed: boolean
  remaining: number
  retryAfterSec: number
  limit: number
  unavailable?: boolean
}

export async function checkTotemRateLimit(opts: {
  userId: string | null
  ip: string
}): Promise<TotemRateLimitResult> {
  const isAuth = !!opts.userId
  const key = isAuth ? `user:${opts.userId}` : `anon:${opts.ip}`
  const limit = isAuth ? AUTH_LIMIT : ANON_LIMIT

  const result = await checkSharedRateLimit(key, {
    namespace: "totem-hourly", maxRequests: limit, windowMs: HOUR_MS,
  })
  return {
    allowed: result.allowed,
    remaining: result.remaining,
    retryAfterSec: result.allowed ? 0 : Math.max(1, Math.ceil(result.resetIn / 1000)),
    limit,
    ...(result.unavailable ? { unavailable: true } : {}),
  }
}

export { getClientIpFromHeaders } from "../client-ip"
