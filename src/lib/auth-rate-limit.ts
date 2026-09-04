import { createHmac } from "node:crypto"
import { prisma } from "./prisma"

const AUTH_LIMIT = { namespace: "auth", maxRequests: 5, windowMs: 60_000 }

export interface AuthRateLimitResult {
  allowed: boolean
  remaining: number
  resetIn: number
  unavailable?: boolean
}

export async function checkAuthRateLimit(clientIp: string): Promise<AuthRateLimitResult> {
  return checkSharedRateLimit(clientIp, AUTH_LIMIT)
}

/** Atomic PostgreSQL upsert: concurrent/cold instances share a single bucket. */
export async function checkSharedRateLimit(
  identifier: string,
  { namespace, maxRequests, windowMs }: { namespace: string; maxRequests: number; windowMs: number },
): Promise<AuthRateLimitResult> {
  try {
    if (!namespace || !Number.isSafeInteger(maxRequests) || maxRequests < 1 ||
        !Number.isSafeInteger(windowMs) || windowMs < 1) {
      throw new Error("Invalid shared rate-limit configuration")
    }
    const secret = process.env.AUTH_SECRET || process.env.NEXTAUTH_SECRET
    if (!secret) throw new Error("AUTH_SECRET is required for authentication throttling")
    // No raw IP addresses are persisted. Namespace separates this use of the secret.
    const key = createHmac("sha256", secret)
      .update(JSON.stringify(["totem-rate-limit-v1", namespace, identifier])).digest("hex")
    const [bucket] = await prisma.$queryRaw<{ count: number; resetIn: number }[]>`
      INSERT INTO "auth_rate_limits" ("key", "count", "expires_at")
      VALUES (${key}, 1, CURRENT_TIMESTAMP + ${windowMs} * INTERVAL '1 millisecond')
      ON CONFLICT ("key") DO UPDATE SET
        "count" = CASE
          WHEN "auth_rate_limits"."expires_at" <= CURRENT_TIMESTAMP THEN 1
          ELSE LEAST("auth_rate_limits"."count" + 1, ${maxRequests + 1}) END,
        "expires_at" = CASE
          WHEN "auth_rate_limits"."expires_at" <= CURRENT_TIMESTAMP
          THEN CURRENT_TIMESTAMP + ${windowMs} * INTERVAL '1 millisecond'
          ELSE "auth_rate_limits"."expires_at" END
      RETURNING "count",
        GREATEST(1, CEIL(EXTRACT(EPOCH FROM ("expires_at" - CURRENT_TIMESTAMP)) * 1000))::integer AS "resetIn"
    `
    if (!bucket) throw new Error("Authentication throttle returned no bucket")

    // Await occasional bounded cleanup so it completes in serverless routes,
    // including paid requests initiated from Server Components.
    if (Math.random() < 0.05) await cleanupAuthRateLimits()

    return {
      allowed: bucket.count <= maxRequests,
      remaining: Math.max(0, maxRequests - bucket.count),
      resetIn: bucket.resetIn,
    }
  } catch (error) {
    // A missing migration/outage must not silently disable brute-force protection.
    console.error("[rate-limit] shared counter unavailable", error instanceof Error ? error.name : "unknown")
    return { allowed: false, remaining: 0, resetIn: 60_000, unavailable: true }
  }
}

/** Bounded cleanup, with an expiry recheck after concurrent row updates. */
export async function cleanupAuthRateLimits(): Promise<void> {
  try {
    await prisma.$executeRaw`
      DELETE FROM "auth_rate_limits" WHERE "expires_at" < CURRENT_TIMESTAMP AND "key" IN (
        SELECT "key" FROM "auth_rate_limits" WHERE "expires_at" < CURRENT_TIMESTAMP
        ORDER BY "expires_at" LIMIT 500
      )
    `
  } catch {
    // Cleanup failure cannot weaken the counter or change an authorization result.
  }
}
