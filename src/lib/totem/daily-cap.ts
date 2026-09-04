import { prisma } from "@/lib/prisma"

/**
 * Daily message caps for the Totem Assistant — the cost circuit breakers.
 *
 * These caps count persisted totem_messages rows via Prisma across instances.
 * They are an additional cost guard, not atomic spend reservations: concurrent
 * in-flight responses are not counted until persisted. The hourly limiter
 * reserves requests atomically in the shared database before a model call.
 *
 * Two scopes:
 *  - per authenticated user  (TOTEM_DAILY_USER_CAP, default 50/day)
 *  - global across everyone  (TOTEM_GLOBAL_DAILY_CAP, default 1000/day)
 * Anonymous users skip the per-user count (they're on the shared 5/h
 * limiter) but are covered by the global ceiling.
 *
 * Both env-tunable so the numbers can move without a deploy.
 */

export const TOTEM_DAILY_USER_CAP_DEFAULT = 50
export const TOTEM_GLOBAL_DAILY_CAP_DEFAULT = 1000

export function startOfUtcDay(now: Date = new Date()): Date {
  return new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()))
}

/** Seconds until the next UTC midnight — used for Retry-After headers. */
export function secondsUntilNextUtcDay(now: Date = new Date()): number {
  const next = startOfUtcDay(now).getTime() + 24 * 60 * 60 * 1000
  return Math.max(1, Math.ceil((next - now.getTime()) / 1000))
}

function parseCap(raw: string | undefined, fallback: number): number {
  const n = Number(raw)
  return Number.isFinite(n) && n > 0 ? Math.floor(n) : fallback
}

export function getDailyCaps(): { user: number; global: number } {
  return {
    user: parseCap(process.env.TOTEM_DAILY_USER_CAP, TOTEM_DAILY_USER_CAP_DEFAULT),
    global: parseCap(process.env.TOTEM_GLOBAL_DAILY_CAP, TOTEM_GLOBAL_DAILY_CAP_DEFAULT),
  }
}

export type DailyCapResult = { allowed: true } | { allowed: false; scope: "user" | "global" }

export async function checkDailyCaps(opts: { userId: string | null }): Promise<DailyCapResult> {
  const caps = getDailyCaps()
  const since = startOfUtcDay()

  const [globalCount, userCount] = await Promise.all([
    prisma.totemMessage.count({
      where: { role: "user", createdAt: { gte: since } },
    }),
    opts.userId
      ? prisma.totemMessage.count({
          where: {
            role: "user",
            createdAt: { gte: since },
            conversation: { userId: opts.userId },
          },
        })
      : Promise.resolve(0),
  ])

  if (globalCount >= caps.global) return { allowed: false, scope: "global" }
  if (opts.userId && userCount >= caps.user) return { allowed: false, scope: "user" }
  return { allowed: true }
}
