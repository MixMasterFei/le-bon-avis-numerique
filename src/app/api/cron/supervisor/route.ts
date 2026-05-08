import { NextRequest, NextResponse } from "next/server"
import { isCronOrAdminAuthorized } from "@/lib/cron-auth"
import { logCronRun } from "@/lib/cron-log"
import { runCronSupervisor } from "@/lib/cron-supervisor"

export const maxDuration = 180

export async function GET(req: NextRequest) {
  if (!(await isCronOrAdminAuthorized(req))) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  const startTime = Date.now()
  const forceEmail = new URL(req.url).searchParams.get("forceEmail") === "true"

  try {
    const result = await runCronSupervisor({ forceEmail })

    await logCronRun({
      task: "cron-supervisor",
      status: result.issues.length > 0 ? "partial" : "success",
      summary: `${result.issues.length} anomalies, ${result.actions.length} remédiations, email=${result.emailSent ? "oui" : "non"}`,
      details: {
        issues: result.issues.map((issue) => ({
          task: issue.task,
          status: issue.status,
          summary: issue.summary,
        })),
        actions: result.actions.map((action) => ({
          task: action.task,
          ok: action.ok,
          httpStatus: action.httpStatus,
          label: action.label,
        })),
      },
      startTime,
    })

    return NextResponse.json({
      success: true,
      issues: result.issues.length,
      actions: result.actions.length,
      emailSent: result.emailSent,
    })
  } catch (error) {
    const message = error instanceof Error ? error.message : "Cron supervisor failed"
    console.error("[cron-supervisor] failed:", error)

    await logCronRun({
      task: "cron-supervisor",
      status: "error",
      summary: message,
      startTime,
    })

    return NextResponse.json({ error: message }, { status: 500 })
  }
}
