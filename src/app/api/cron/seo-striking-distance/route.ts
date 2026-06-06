import { NextRequest, NextResponse } from "next/server"
import { isCronOrAdminAuthorized } from "@/lib/cron-auth"
import { logCronRun } from "@/lib/cron-log"
import { runSeoStrikingDistance } from "@/lib/seo-striking-distance"
import { runSeoAutofix } from "@/lib/seo-autofix"
import { sendSeoReport } from "@/lib/email"

// Write-side: the agent runs maillage + up to 3 sequential ~35s gpt-5-mini
// synopsis rewrites on top of the GSC pull, so the old 60s ceiling would time out.
export const maxDuration = 180

export async function GET(req: NextRequest) {
  if (!(await isCronOrAdminAuthorized(req))) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  const startTime = Date.now()
  // ?email=always forces the digest even with 0 opportunities (handy for a
  // first manual verification); default only emails when there's something to act on.
  const forceEmail = req.nextUrl.searchParams.get("email") === "always"
  // Writes are OFF by default — this agent edits user-visible copy, so prod starts
  // in dry-run and is flipped on explicitly via SEO_AGENT_AUTOFIX=true after a
  // manual verification. ?dryRun=1 forces report-only regardless of the env flag.
  const writesEnabled = process.env.SEO_AGENT_AUTOFIX === "true"
  const forceDryRun = req.nextUrl.searchParams.get("dryRun") === "1"
  const dryRun = !writesEnabled || forceDryRun

  try {
    const result = await runSeoStrikingDistance()

    if (!result.configured) {
      // Diagnostic: which env-var NAMES the runtime can see (booleans only,
      // never values). Pinpoints a missing var / wrong-scope / typo at a glance.
      const present = {
        GSC_OAUTH_CLIENT_ID: Boolean(process.env.GSC_OAUTH_CLIENT_ID),
        GSC_OAUTH_CLIENT_SECRET: Boolean(process.env.GSC_OAUTH_CLIENT_SECRET),
        GSC_OAUTH_REFRESH_TOKEN: Boolean(process.env.GSC_OAUTH_REFRESH_TOKEN),
        GSC_PROPERTY_URL: Boolean(process.env.GSC_PROPERTY_URL),
      }
      await logCronRun({
        task: "seo-striking-distance",
        status: "partial",
        summary: "GSC non configuré — aucune analyse",
        details: { configured: false, present },
        startTime,
      })
      return NextResponse.json({ success: false, reason: "gsc_not_configured", present })
    }

    // Write-side: act on the opportunities (maillage + synopsis), then report
    // exactly what was done in the same email.
    const autofix = await runSeoAutofix(result.strikingQueries, { dryRun })

    let emailed = false
    if (result.strikingQueries.length > 0 || forceEmail) {
      const fixedNote = dryRun
        ? ""
        : ` · ${autofix.linksCreated} lien(s) · ${autofix.synopsesRewritten} synopsis`
      await sendSeoReport({
        subject: `SEO — ${result.strikingQueries.length} opportunité(s) à portée de page 1${fixedNote}`,
        report: result.report + autofix.section,
      })
      emailed = true
    }

    await logCronRun({
      task: "seo-striking-distance",
      status: "success",
      summary: `${result.strikingQueries.length} requêtes striking-distance · ${result.totalImpressionsAtStake} impressions en jeu${dryRun ? " · simulation" : ` · ${autofix.linksCreated} liens, ${autofix.synopsesRewritten} synopsis`}${emailed ? " · email envoyé" : ""}`,
      details: {
        configured: true,
        strikingCount: result.strikingQueries.length,
        totalImpressionsAtStake: result.totalImpressionsAtStake,
        range: result.range,
        emailed,
        dryRun,
        linksCreated: autofix.linksCreated,
        synopsesRewritten: autofix.synopsesRewritten,
        flagged: autofix.flagged,
        skippedNonMedia: autofix.skippedNonMedia,
        // Before/after for any rewrite, so a bad one can be reverted by hand.
        rewrites: autofix.targets
          .filter((t) => t.synopsis === "rewritten")
          .map((t) => ({ id: t.routeId, title: t.title, before: t.synopsisBefore, after: t.synopsisAfter })),
      },
      startTime,
    })

    return NextResponse.json({
      success: true,
      strikingCount: result.strikingQueries.length,
      totalImpressionsAtStake: result.totalImpressionsAtStake,
      range: result.range,
      emailed,
      dryRun,
      autofix: {
        linksCreated: autofix.linksCreated,
        synopsesRewritten: autofix.synopsesRewritten,
        flagged: autofix.flagged,
        skippedNonMedia: autofix.skippedNonMedia,
        targets: autofix.targets,
      },
      // Echo the top few so a manual trigger shows results without the email.
      top: result.strikingQueries.slice(0, 8),
    })
  } catch (error) {
    const message = error instanceof Error ? error.message : "SEO striking-distance failed"
    console.error("[seo-striking-distance] failed:", error)

    await logCronRun({
      task: "seo-striking-distance",
      status: "error",
      summary: message,
      startTime,
    })

    return NextResponse.json({ error: message }, { status: 500 })
  }
}
