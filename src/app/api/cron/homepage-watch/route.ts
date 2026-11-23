import { NextRequest, NextResponse } from "next/server"
import { isCronOrAdminAuthorized } from "@/lib/cron-auth"
import { logCronRun } from "@/lib/cron-log"
import { sendHomepageWatchReport } from "@/lib/email"
import { runHomepageWatch } from "@/lib/homepage-watch-run"

// ~40 third-party reads (cinema pages are cached) + up to 8 imports, each a
// details read, a providers read and two poster uploads.
export const maxDuration = 120

/**
 * GET /api/cron/homepage-watch — every two days (cron.yml `41 5 *\/2 * *`).
 *
 * Compares the V2 homepage with the week's releases and buzz, then imports
 * the missing titles (≤ 8, through the existing import functions — ages come
 * from those and from enrichment, never from here) and refreshes the pins of
 * the « À ne pas manquer cette semaine » band (≤ 8, 14-day expiry).
 *
 * Writes are ON by default IN PRODUCTION ONLY (fail-closed on previews/local,
 * same VERCEL_ENV guard as the SEO agent). Kill switch:
 * HOMEPAGE_WATCH_AUTOFIX="false" → report only. `?dryRun=1` → report only,
 * and no email and no cron_logs row, so an on-demand check never refreshes
 * « last run » (same rule as game-guides-check).
 */
export async function GET(req: NextRequest) {
  if (!(await isCronOrAdminAuthorized(req))) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  const startTime = Date.now()
  const writesEnabled =
    process.env.VERCEL_ENV === "production" && process.env.HOMEPAGE_WATCH_AUTOFIX !== "false"
  const dryRun = req.nextUrl.searchParams.get("dryRun") === "1"

  try {
    const result = await runHomepageWatch({ writesEnabled, dryRun })
    const { outcomes, classified, pins } = result

    // 16+ launches the band's 16+ cap kept out of the pins.
    const capSkipped = new Set(result.matureSkipped.map((c) => c.key))
    // Compact per-title outcome, so a run can be read back from cron_logs.
    const titles = classified.map((c) => ({
      key: c.key,
      title: c.title,
      kind: c.kind,
      status: c.status,
      age: c.entry?.expertAgeRec ?? null,
      sources: c.sources,
      placements: c.placements,
      imported: outcomes.imports.keys.includes(c.key),
      ...(capSkipped.has(c.key) ? { matureCapSkipped: true } : {}),
    }))

    if (dryRun) {
      return NextResponse.json({ success: true, dryRun: true, health: result.health, remaining: result.remaining, outcomes, pins, titles, report: result.report })
    }

    let emailed = false
    try {
      await sendHomepageWatchReport({ subject: result.subject, report: result.report })
      emailed = true
    } catch (e) {
      console.error("[homepage-watch] email failed:", e)
    }

    const status =
      result.health === "sources-failed"
        ? "error"
        : result.health === "ok" && outcomes.imports.failed === 0
          ? "success"
          : "partial"
    const counts = (s: string) => classified.filter((c) => c.status === s).length
    await logCronRun({
      task: "homepage-watch",
      status,
      summary:
        result.health === "sources-failed"
          ? "Sources indisponibles — rien vérifié"
          : `${classified.length} titres attendus · ${counts("on-homepage")} à l'accueil · ${counts("missing")} hors catalogue · ${counts("age-capped")} filtrés par l'âge · ${writesEnabled ? `${outcomes.imports.created} import(s), ${outcomes.pins.written} épingle(s)` : "rapport seul"}${result.remaining === 0 ? " · rien à faire" : ` · ${result.remaining} à traiter`}${emailed ? " · email envoyé" : ""}`,
      details: {
        health: result.health,
        remaining: result.remaining,
        writesEnabled,
        emailed,
        // Same « outcomes » shape the SEO agent logs: tells « nothing to do »
        // from « every write failed » without re-reading the email.
        outcomes,
        pins: pins.map((p) => ({ mediaId: p.mediaId, title: p.title, rank: p.rank, reason: p.reason })),
        titles,
      },
      startTime,
    })

    return NextResponse.json({ success: status !== "error", health: result.health, remaining: result.remaining, outcomes, pins, emailed })
  } catch (error) {
    await logCronRun({
      task: "homepage-watch",
      status: "error",
      summary: error instanceof Error ? error.message : "homepage-watch failed",
      startTime,
    })
    return NextResponse.json(
      { error: "homepage-watch failed", message: error instanceof Error ? error.message : "Unknown" },
      { status: 500 },
    )
  }
}
