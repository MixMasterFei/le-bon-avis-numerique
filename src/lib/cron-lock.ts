import { prisma } from "@/lib/prisma"
import { randomUUID } from "node:crypto"

/**
 * Lease-based lock for long-running cron tasks. Backed by the
 * `cron_locks` table (see `sql/add_cron_locks.sql`).
 *
 * Why: `news-discover` and friends load dedup state in app memory at
 * the start of the run and persist at the end. Concurrent invocations
 * (GH Actions manual retry, Vercel cron + GH Actions overlap) would
 * race and create duplicate stories, since source-URL dedup is purely
 * application-level (no DB-level uniqueness on `NewsStory.sources`).
 *
 * Semantics:
 * - `withCronLock(task, lease, fn)` runs `fn` only if no other holder
 *   has a non-expired lease for `task`. If another holder exists, fn
 *   is skipped and `null` is returned.
 * - The lease auto-expires after `leaseSeconds`, so a Lambda that
 *   times out / OOMs / crashes mid-run doesn't permanently block the
 *   task. Pick `leaseSeconds` ≥ the route's `maxDuration` plus a
 *   margin (e.g. 600s for a 300s task).
 * - On normal exit (success or thrown error), the lock is released.
 *   The release is gated on `acquired_by` so we can't release someone
 *   else's lock if our lease has already expired and another worker
 *   re-acquired it.
 *
 * Uses raw SQL (not the typed Prisma client) so adding a new table
 * doesn't require a `prisma generate` step. Acceptable here because
 * the surface is two queries.
 */
export async function withCronLock<T>(
  task: string,
  leaseSeconds: number,
  fn: () => Promise<T>,
): Promise<T | null> {
  const owner = randomUUID()

  // Atomic acquire: insert if absent, otherwise overwrite ONLY when
  // the existing lease has expired. RETURNING returns 1 row when we
  // won the race, 0 rows when another worker still holds a live lease.
  const acquired = await prisma.$queryRaw<{ task: string }[]>`
    INSERT INTO "cron_locks" ("task", "lease_until", "acquired_at", "acquired_by")
    VALUES (${task}, NOW() + (${leaseSeconds} || ' seconds')::INTERVAL, NOW(), ${owner})
    ON CONFLICT ("task") DO UPDATE
      SET "lease_until" = NOW() + (${leaseSeconds} || ' seconds')::INTERVAL,
          "acquired_at" = NOW(),
          "acquired_by" = ${owner}
      WHERE "cron_locks"."lease_until" < NOW()
    RETURNING "task"
  `

  if (acquired.length === 0) {
    return null
  }

  try {
    return await fn()
  } finally {
    // Best-effort release. Gated on acquired_by so a stale lease that
    // has already been re-acquired by another worker isn't clobbered.
    // Errors here are logged but never re-thrown — the lease will
    // expire on its own if the delete fails.
    try {
      await prisma.$executeRaw`
        DELETE FROM "cron_locks"
        WHERE "task" = ${task} AND "acquired_by" = ${owner}
      `
    } catch (err) {
      console.warn(`[cron-lock] release failed for task=${task}:`, err)
    }
  }
}
