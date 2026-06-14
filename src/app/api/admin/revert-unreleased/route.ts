import { NextRequest, NextResponse } from "next/server"
import { isCronOrAdminAuthorized } from "@/lib/cron-auth"
import { revertUnreleasedToProvisional } from "@/lib/revert-unreleased"
import { logCronRun } from "@/lib/cron-log"

// Pass B fetches TMDB status per null-dated candidate (~26 today, ~3s), but
// keep headroom in case the backlog grows.
export const maxDuration = 300

/**
 * POST /api/admin/revert-unreleased
 *
 * One-off cleanup: revert titles enriched while still unreleased back to
 * "provisional" so their fabricated content metrics stop showing. Catches the
 * null-date upcoming case (e.g. "Les Indestructibles 3") via TMDB status.
 *
 * Body (all optional):
 *   { "apply": false, "skipNull": false, "limit": 0 }
 *   - apply=false (default) → DRY-RUN: returns the targets, writes nothing.
 *   - apply=true            → deletes ContentMetrics, sets isEnriched=false,
 *                             stores releaseStatus. KEEPS the age estimate.
 *
 * Runs in prod where TMDB_API_KEY exists. Dual cron/admin authorized.
 */
export async function POST(req: NextRequest) {
  const startTime = Date.now()

  if (!(await isCronOrAdminAuthorized(req))) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  const body = await req.json().catch(() => ({}))
  const apply = body.apply === true
  const skipNull = body.skipNull === true
  const limit = Number.isFinite(body.limit) ? Number(body.limit) : 0

  try {
    const result = await revertUnreleasedToProvisional({ apply, skipNull, limit })
    const duration = Math.round((Date.now() - startTime) / 1000)

    // Only log a cron run on an actual write — dry-runs are noise.
    if (apply) {
      await logCronRun({
        task: "revert-unreleased",
        status: "success",
        summary: `${result.reverted} fiche(s) à venir repassées en provisoire (${result.checkedNullDated} dates nulles vérifiées) en ${duration}s`,
        details: {
          reverted: result.reverted,
          checkedNullDated: result.checkedNullDated,
          titles: result.targets.map((t) => `${t.title} (${t.reason})`),
        },
        startTime,
      })
    }

    return NextResponse.json({
      success: true,
      dryRun: result.dryRun,
      duration: `${duration}s`,
      checkedNullDated: result.checkedNullDated,
      reverted: result.reverted,
      targets: result.targets,
    })
  } catch (error) {
    return NextResponse.json(
      { error: "Revert failed", message: error instanceof Error ? error.message : "Unknown" },
      { status: 500 }
    )
  }
}
