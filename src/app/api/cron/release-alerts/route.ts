import { NextRequest, NextResponse } from "next/server"
import { isCronOrAdminAuthorized } from "@/lib/cron-auth"
import { runReleaseAlerts } from "@/lib/release-alerts"
import { logCronRun } from "@/lib/cron-log"

export const dynamic = "force-dynamic"
export const maxDuration = 60

// Daily: turn "Prévenez-moi" subscriptions into bell notifications the day
// each title reaches its release date. See src/lib/release-alerts.ts.
export async function GET(req: NextRequest) {
  const startTime = Date.now()
  if (!(await isCronOrAdminAuthorized(req))) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }
  try {
    const res = await runReleaseAlerts()
    await logCronRun({
      task: "release-alerts",
      status: "success",
      summary: `${res.notified} notification(s) de sortie envoyée(s) (${res.scanned} dues)`,
      details: res,
      startTime,
    })
    return NextResponse.json({ success: true, ...res })
  } catch (error) {
    await logCronRun({
      task: "release-alerts",
      status: "error",
      summary: error instanceof Error ? error.message : "release-alerts failed",
      startTime,
    })
    return NextResponse.json({ error: error instanceof Error ? error.message : "failed" }, { status: 500 })
  }
}
