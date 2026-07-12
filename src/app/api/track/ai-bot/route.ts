import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"

// POST — internal endpoint: the middleware fires one call per detected AI
// crawler hit / AI-assistant referral (fire-and-forget via event.waitUntil).
// Day-aggregated upsert so bot bursts can't grow the table: one row per
// (day, bot, kind, surface), count incremented.
//
// Protected by CRON_SECRET (the middleware attaches it) so the endpoint can't
// be spammed into fake stats from outside.
export async function POST(request: NextRequest) {
  try {
    const secret = request.headers.get("x-track-secret")
    if (!process.env.CRON_SECRET || secret !== process.env.CRON_SECRET) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const body = await request.json()
    const { bot, kind, surface, path } = body as {
      bot?: string
      kind?: string
      surface?: string
      path?: string
    }

    if (!bot || !kind || !surface) {
      return NextResponse.json({ error: "bot, kind, surface required" }, { status: 400 })
    }
    if (kind !== "crawler" && kind !== "referral") {
      return NextResponse.json({ error: "Invalid kind" }, { status: 400 })
    }

    // UTC day bucket (DATE column).
    const day = new Date(new Date().toISOString().slice(0, 10))
    const samplePath = typeof path === "string" ? path.slice(0, 300) : null

    await prisma.aiBotHit.upsert({
      where: {
        day_bot_kind_surface: { day, bot: bot.slice(0, 80), kind, surface: surface.slice(0, 40) },
      },
      create: {
        day,
        bot: bot.slice(0, 80),
        kind,
        surface: surface.slice(0, 40),
        count: 1,
        samplePath,
      },
      update: {
        count: { increment: 1 },
        // Keep a rotating example of what was fetched (last write wins).
        ...(samplePath ? { samplePath } : {}),
      },
    })

    return NextResponse.json({ ok: true })
  } catch (error) {
    // Telemetry must never break anything (table may not exist yet on a fresh
    // env before the SQL migration runs) — swallow and report ok.
    console.error("[track/ai-bot] error:", error instanceof Error ? error.message : error)
    return NextResponse.json({ ok: true })
  }
}
