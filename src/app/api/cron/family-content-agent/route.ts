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

    // `partial` quand le rapport a été coupé au plafond de tokens ou qu'on est
    // retombé sur la sélection déterministe : dans les deux cas l'e-mail est
    // parti, mais amputé. C'était journalisé en `success` — donc invisible du
    // superviseur, six semaines durant.
    const summary = result.truncated
      ? `${result.candidatesSelected} fiches envoyées (${result.candidatesMatching} en file) — rapport tronqué`
      : `${result.candidatesSelected} fiches envoyées (${result.candidatesMatching} en file)`

    await logCronRun({
      task: "family-content-agent",
      status: result.status,
      summary,
      details: {
        candidatesSelected: result.candidatesSelected,
        candidatesMatching: result.candidatesMatching,
        capped: result.capped,
        truncated: result.truncated,
      },
      startTime,
    })

    return NextResponse.json({
      success: true,
      candidatesSelected: result.candidatesSelected,
      candidatesMatching: result.candidatesMatching,
      capped: result.capped,
      truncated: result.truncated,
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
