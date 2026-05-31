import { NextRequest, NextResponse } from "next/server"
import { isCronOrAdminAuthorized } from "@/lib/cron-auth"
import { logCronRun } from "@/lib/cron-log"
import { runSeoStrikingDistance } from "@/lib/seo-striking-distance"
import { sendSeoReport } from "@/lib/email"

export const maxDuration = 60

export async function GET(req: NextRequest) {
  if (!(await isCronOrAdminAuthorized(req))) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  const startTime = Date.now()
  // ?email=always forces the digest even with 0 opportunities (handy for a
  // first manual verification); default only emails when there's something to act on.
  const forceEmail = req.nextUrl.searchParams.get("email") === "always"

  try {
    const result = await runSeoStrikingDistance()

    if (!result.configured) {
      await logCronRun({
        task: "seo-striking-distance",
        status: "partial",
        summary: "GSC non configuré — aucune analyse",
        details: { configured: false },
        startTime,
      })
      return NextResponse.json({ success: false, reason: "gsc_not_configured" })
    }

    let emailed = false
    if (result.strikingQueries.length > 0 || forceEmail) {
      await sendSeoReport({
        subject: `SEO — ${result.strikingQueries.length} opportunité(s) à portée de page 1`,
        report: result.report,
      })
      emailed = true
    }

    await logCronRun({
      task: "seo-striking-distance",
      status: "success",
      summary: `${result.strikingQueries.length} requêtes striking-distance · ${result.totalImpressionsAtStake} impressions en jeu${emailed ? " · email envoyé" : ""}`,
      details: {
        configured: true,
        strikingCount: result.strikingQueries.length,
        totalImpressionsAtStake: result.totalImpressionsAtStake,
        range: result.range,
        emailed,
      },
      startTime,
    })

    return NextResponse.json({
      success: true,
      strikingCount: result.strikingQueries.length,
      totalImpressionsAtStake: result.totalImpressionsAtStake,
      range: result.range,
      emailed,
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
