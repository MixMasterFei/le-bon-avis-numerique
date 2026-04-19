import { NextResponse } from "next/server"
import { auth } from "@/lib/auth"
import { logCronRun } from "@/lib/cron-log"
import { runNewsDiscover } from "@/lib/news-discover"

export const maxDuration = 60
export const dynamic = "force-dynamic"

const OWNER_EMAIL = "masterfei@gmail.com"

export async function POST() {
  const session = await auth()
  const user = session?.user as { email?: string | null; role?: string } | undefined
  const isOwner = user?.email === OWNER_EMAIL || user?.role === "ADMIN"
  if (!isOwner) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  const startTime = Date.now()
  try {
    const stats = await runNewsDiscover()
    await logCronRun({
      task: "news-discover",
      status: stats.storiesPersisted > 0 ? "success" : "partial",
      summary: `Refresh manuel : ${stats.storiesPersisted} histoires`,
      details: stats as unknown as Record<string, unknown>,
      startTime,
    })
    return NextResponse.json({ success: true, ...stats })
  } catch (error) {
    const msg = error instanceof Error ? error.message : "Unknown error"
    await logCronRun({
      task: "news-discover",
      status: "error",
      summary: `Refresh manuel : ${msg}`,
      startTime,
    })
    return NextResponse.json({ error: "Refresh failed", message: msg }, { status: 500 })
  }
}
