import { NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"

function extractErrorInfo(error: unknown) {
  const message = error instanceof Error ? error.message : String(error)
  const codeMatch = message.match(/\bP\d{4}\b/)
  return {
    code: codeMatch?.[0] || null,
    message,
  }
}

export async function GET() {
  try {
    await prisma.$queryRaw`SELECT 1`

    const mediaCount = await prisma.mediaItem.count()
    const streamingCount = await prisma.streamingAvailability.count()

    return NextResponse.json({
      ok: true,
      db: "connected",
      mediaItems: mediaCount,
      streamingItems: streamingCount,
    })
  } catch (error) {
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
