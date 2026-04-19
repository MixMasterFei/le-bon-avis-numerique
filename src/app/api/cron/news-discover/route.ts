import { NextRequest, NextResponse } from "next/server"
import { isCronOrAdminAuthorized } from "@/lib/cron-auth"
import { logCronRun } from "@/lib/cron-log"
import { runNewsDiscover } from "@/lib/news-discover"

export const maxDuration = 60

export async function GET(req: NextRequest) {
  if (!(await isCronOrAdminAuthorized(req))) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  const startTime = Date.now()
  try {
    const stats = await runNewsDiscover()
    await logCronRun({
      task: "news-discover",
      status: stats.storiesPersisted > 0 ? "success" : "partial",
      summary: `${stats.storiesPersisted} histoires synthétisées à partir de ${stats.itemsCollected} articles`,
      details: stats as unknown as Record<string, unknown>,
      startTime,
    })
    return NextResponse.json({ success: true, ...stats })
  } catch (error) {
    const msg = error instanceof Error ? error.message : "Unknown error"
    console.error("[cron] news-discover failed:", error)
    await logCronRun({
      task: "news-discover",
      status: "error",
      summary: msg,
      startTime,
    })
    return NextResponse.json({ error: "Discover failed", message: msg }, { status: 500 })
  }
}
