import { NextRequest, NextResponse } from "next/server"
import { isCronOrAdminAuthorized } from "@/lib/cron-auth"
import { logCronRun } from "@/lib/cron-log"
import { runDebtDigest } from "@/lib/debt-digest"

// Read-only: a few count() queries + fetchAdminKpis + one email. Quick,
// but give it headroom in case the DB is under load.
export const maxDuration = 60

export async function GET(req: NextRequest) {
  if (!(await isCronOrAdminAuthorized(req))) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  const startTime = Date.now()
  // ?email=false → compute the report and return it without sending the
  // mail (handy when iterating on the format from the admin tools).
  const sendEmail = new URL(req.url).searchParams.get("email") !== "false"

  try {
    const result = await runDebtDigest({ email: sendEmail })

    await logCronRun({
      task: "debt-digest",
      status: result.cronProblems > 0 ? "partial" : "success",
      summary: `${result.cronProblems} job(s) en souffrance, ${result.catalogUnenriched} à enrichir, email=${result.emailSent ? "oui" : "non"}`,
      details: { cronProblems: result.cronProblems, catalogUnenriched: result.catalogUnenriched, emailSent: result.emailSent },
      startTime,
    })

    return NextResponse.json({
      success: true,
      cronProblems: result.cronProblems,
      catalogUnenriched: result.catalogUnenriched,
      emailSent: result.emailSent,
      report: sendEmail ? undefined : result.report,
    })
  } catch (error) {
    const msg = error instanceof Error ? error.message : "Debt digest failed"
    console.error("[cron] debt-digest failed:", error)
    await logCronRun({ task: "debt-digest", status: "error", summary: msg, startTime })
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}
