import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { isCronOrAdminAuthorized } from "@/lib/cron-auth"

function extractErrorInfo(error: unknown) {
  const message = error instanceof Error ? error.message : String(error)
  const codeMatch = message.match(/\bP\d{4}\b/)
  return {
    code: codeMatch?.[0] || null,
    message,
  }
}

export async function GET(req: NextRequest) {
  // Detailed diagnostics (catalog counts, Prisma error codes/messages) reveal
  // DB state and internal error detail that has no business being public, so
  // they're gated to cron/admin callers. Anonymous callers get a bare liveness
  // signal — enough for an uptime probe, nothing exploitable.
  const authorized = await isCronOrAdminAuthorized(req)

  try {
    await prisma.$queryRaw`SELECT 1`

    if (!authorized) {
      return NextResponse.json({ ok: true })
    }

    const [mediaCount, streamingCount] = await Promise.all([
      prisma.mediaItem.count(),
      prisma.streamingAvailability.count(),
    ])

    return NextResponse.json({
      ok: true,
      db: "connected",
      mediaItems: mediaCount,
      streamingItems: streamingCount,
    })
  } catch (error) {
    if (!authorized) {
      return NextResponse.json({ ok: false }, { status: 500 })
    }
    const info = extractErrorInfo(error)
    return NextResponse.json(
      {
        ok: false,
        db: "error",
        errorCode: info.code,
        errorMessage: info.message,
      },
      { status: 500 }
    )
  }
}
