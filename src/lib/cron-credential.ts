import { createHash, timingSafeEqual } from "node:crypto"
import type { NextRequest } from "next/server"

/**
 * The automation credential — `Authorization: Bearer <CRON_SECRET>`, sent by
 * Vercel Cron and by .github/workflows/cron.yml — and the only routes it opens.
 *
 * Until 2026-11-07 a valid secret opened the whole /api/admin namespace in the
 * middleware, Totem transcripts included (account e-mails, family snapshots,
 * message text), and five cron handlers compared the header against an
 * interpolated `Bearer ${process.env.CRON_SECRET}` — which accepted
 * `Bearer undefined` whenever the secret was missing.
 *
 * Every check of that secret goes through this module:
 *  - a missing, empty or blank CRON_SECRET opens nothing (fail closed);
 *  - the comparison is constant-time;
 *  - the credential opens only CRON_JOB_ROUTES, the exact (method, path) pairs
 *    the schedulers call. Anything else — admin pages, transcripts, accounts,
 *    dashboards — needs a current ADMIN session.
 *
 * Adding a scheduled call? Add its (method, path) below. The test
 * (src/lib/__tests__/cron-credential.test.ts) parses cron.yml and vercel.json
 * and fails when a scheduled call is missing here, or when this list keeps a
 * route that nothing schedules any more.
 *
 * Kept free of NextAuth/Prisma so the middleware can import it statically.
 */

export type CronMethod = "GET" | "POST"

export interface CronJobRoute {
  method: CronMethod
  path: string
  /** Who sends this request with the credential. */
  calledBy: "vercel.json" | "cron.yml" | "scripts/enrich-loop"
}

export const CRON_JOB_ROUTES: readonly CronJobRoute[] = [
  // vercel.json — the heartbeat watchdog, on Vercel's own cron.
  { method: "GET", path: "/api/cron/heartbeat", calledBy: "vercel.json" },

  // .github/workflows/cron.yml — the cron handlers.
  { method: "GET", path: "/api/cron/weekly-import", calledBy: "cron.yml" },
  { method: "GET", path: "/api/cron/release-alerts", calledBy: "cron.yml" },
  { method: "GET", path: "/api/cron/weekly-games-import", calledBy: "cron.yml" },
  { method: "GET", path: "/api/cron/games-top-names", calledBy: "cron.yml" },
  { method: "GET", path: "/api/cron/news-discover", calledBy: "cron.yml" },
  { method: "GET", path: "/api/cron/family-content-agent", calledBy: "cron.yml" },
  { method: "GET", path: "/api/cron/supervisor", calledBy: "cron.yml" },
  { method: "GET", path: "/api/cron/weekly-dossier", calledBy: "cron.yml" },
  { method: "GET", path: "/api/cron/game-guides-check", calledBy: "cron.yml" },
  { method: "GET", path: "/api/cron/debt-digest", calledBy: "cron.yml" },
  { method: "GET", path: "/api/cron/seo-striking-distance", calledBy: "cron.yml" },
  { method: "POST", path: "/api/cron/totem-eval", calledBy: "cron.yml" },

  // .github/workflows/cron.yml — catalogue jobs under /api/admin (all POST).
  // The supervisor's remediations re-run a subset of these, same method.
  { method: "POST", path: "/api/admin/import-preschool", calledBy: "cron.yml" },
  { method: "POST", path: "/api/admin/import-cnc-ratings", calledBy: "cron.yml" },
  { method: "POST", path: "/api/admin/screenshots/import", calledBy: "cron.yml" },
  { method: "POST", path: "/api/admin/refresh-release-status", calledBy: "cron.yml" },
  { method: "POST", path: "/api/admin/backfill-game-styles", calledBy: "cron.yml" },
  { method: "POST", path: "/api/admin/synopsis-audit", calledBy: "cron.yml" },
  { method: "POST", path: "/api/admin/enrich", calledBy: "cron.yml" },
  { method: "POST", path: "/api/admin/enrich-deep", calledBy: "cron.yml" },
  { method: "POST", path: "/api/admin/quality/compute", calledBy: "cron.yml" },
  { method: "POST", path: "/api/admin/age-floor", calledBy: "cron.yml" },
  { method: "POST", path: "/api/admin/backfill-ratings", calledBy: "cron.yml" },
  { method: "POST", path: "/api/admin/streaming/update", calledBy: "cron.yml" },
  { method: "POST", path: "/api/admin/similarity/compute", calledBy: "cron.yml" },
  { method: "POST", path: "/api/admin/news/press-kit-scout", calledBy: "cron.yml" },
  { method: "POST", path: "/api/admin/news/prewarm-images-v4", calledBy: "cron.yml" },
  { method: "POST", path: "/api/admin/revert-unreleased", calledBy: "cron.yml" },

  // scripts/enrich-loop.{sh,ps1} — operator fallback for the enrichment page.
  // Its POSTs are covered above; this is its read-only backlog preflight
  // (catalogue counts only, no account data).
  { method: "GET", path: "/api/admin/enrich", calledBy: "scripts/enrich-loop" },
]

const ROUTE_KEYS = new Set(CRON_JOB_ROUTES.map((route) => `${route.method} ${route.path}`))

/** True when (method, pathname) is a job route the automation credential may call. */
export function isCronJobRoute(method: string, pathname: string): boolean {
  return ROUTE_KEYS.has(`${method.toUpperCase()} ${pathname}`)
}

/** The configured secret, or null when it is missing, empty or blank. */
function configuredCronSecret(): string | null {
  const secret = process.env.CRON_SECRET
  if (typeof secret !== "string" || secret.trim() === "") return null
  return secret
}

function sha256(value: string): Buffer {
  return createHash("sha256").update(value, "utf8").digest()
}

/**
 * True when `presented` equals the configured CRON_SECRET. Constant-time
 * (both sides are hashed to equal-length digests first, so neither content
 * nor length leaks), and always false when no secret is configured.
 */
export function matchesCronSecret(presented: string | null | undefined): boolean {
  const secret = configuredCronSecret()
  if (secret === null || typeof presented !== "string") return false
  return timingSafeEqual(sha256(presented), sha256(secret))
}

const BEARER_PREFIX = "Bearer "

/** True when an Authorization header value is exactly `Bearer <CRON_SECRET>`. */
export function hasValidCronBearer(authorization: string | null | undefined): boolean {
  if (typeof authorization !== "string" || !authorization.startsWith(BEARER_PREFIX)) return false
  return matchesCronSecret(authorization.slice(BEARER_PREFIX.length))
}

/** True when the request carries the automation credential AND targets a job route. */
export function isCronJobRequest(
  req: Pick<NextRequest, "method" | "headers" | "nextUrl">,
): boolean {
  return (
    isCronJobRoute(req.method, req.nextUrl.pathname) &&
    hasValidCronBearer(req.headers.get("authorization"))
  )
}

/**
 * Local-development escape hatch for the cron handlers that accept only the
 * credential: `next dev` with ALLOW_INSECURE_CRON_LOCAL=true in `.env.local`.
 * Never true in a deployed build (NODE_ENV is "production" there), so a
 * tunnel-exposed dev server is the only thing it ever opens.
 */
export function allowsInsecureLocalCron(): boolean {
  return (
    process.env.NODE_ENV === "development" &&
    process.env.ALLOW_INSECURE_CRON_LOCAL === "true"
  )
}
