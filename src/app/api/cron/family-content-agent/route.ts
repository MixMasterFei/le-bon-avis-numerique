import { NextRequest, NextResponse } from "next/server"
import { isCronOrAdminAuthorized } from "@/lib/cron-auth"
import { logCronRun } from "@/lib/cron-log"
import { runFamilyContentAgent } from "@/lib/family-content-agent"

export const maxDuration = 120

export async function GET(req: NextRequest) {
  if (!(await isCronOrAdminAuthorized(req))) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  const startTime = Date.now()
  try {
    const result = await runFamilyContentAgent()

    await logCronRun({
      task: "family-content-agent",
      status: "success",
      summary: `${result.candidatesFound} fiches analysées, rapport envoyé`,
      details: {
        candidatesFound: result.candidatesFound,
        candidatesSent: result.candidatesSent,
      },
      startTime,
    })

    return NextResponse.json({
      success: true,
      candidatesFound: result.candidatesFound,
      candidatesSent: result.candidatesSent,
    })
  } catch (error) {
    const message = error instanceof Error ? error.message : "Family content agent failed"
    console.error("[family-content-agent] failed:", error)

    await logCronRun({
      task: "family-content-agent",
      status: "error",
      summary: message,
      startTime,
    })

    return NextResponse.json({ error: message }, { status: 500 })
  }
}
