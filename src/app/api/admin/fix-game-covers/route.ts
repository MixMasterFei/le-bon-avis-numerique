import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"

export const maxDuration = 60

/**
 * Upgrade IGDB game cover URLs to t_720p.
 * Processes a bounded chunk per call so the admin operation does not time out.
 * Pure string replacement - no external API calls needed.
 */
function clampLimit(raw: unknown): number {
  const n = typeof raw === "number" ? raw : parseInt(String(raw || ""), 10)
  if (!Number.isFinite(n)) return 100
  return Math.min(200, Math.max(1, n))
}

function upgradeIgdbImageUrl(url: string | null): string | null {
  if (!url) return null
  if (!url.includes("images.igdb.com/igdb/image/upload/")) return null
  const next = url.replace(/\/upload\/[^/]+\//, "/upload/t_720p/")
  return next !== url ? next : null
}

function needsUpgradeWhere(afterId?: string) {
  return {
    type: "GAME" as const,
    ...(afterId ? { id: { gt: afterId } } : {}),
    AND: [
      { posterUrl: { not: null } },
      { posterUrl: { startsWith: "https://images.igdb.com/igdb/image/upload/" } },
      { NOT: { posterUrl: { contains: "/t_720p/" } } },
    ],
  }
}

async function readBody(req: NextRequest): Promise<Record<string, unknown>> {
  try {
    return await req.json()
  } catch {
    return {}
  }
}

export async function POST(req: NextRequest) {
  try {
    const searchParams = req.nextUrl.searchParams
    const body = await readBody(req)
    const limit = clampLimit(body.limit ?? searchParams.get("limit"))
    const afterId = searchParams.get("afterId") || undefined
    const totalParam = searchParams.get("total")
    const total = Number.isFinite(parseInt(totalParam || "", 10))
      ? parseInt(totalParam || "", 10)
      : await prisma.mediaItem.count({ where: needsUpgradeWhere() })

    const games = await prisma.mediaItem.findMany({
      where: needsUpgradeWhere(afterId),
      select: { id: true, title: true, posterUrl: true },
      orderBy: { id: "asc" },
      take: limit,
    })

    let updated = 0
    let skipped = 0
    let errors = 0

    for (const game of games) {
      try {
        const newUrl = upgradeIgdbImageUrl(game.posterUrl)
        if (!newUrl) {
          skipped++
          continue
        }

        await prisma.mediaItem.update({
          where: { id: game.id },
          data: { posterUrl: newUrl },
        })
        updated++
      } catch (error) {
        errors++
        console.warn("[fix-game-covers] failed for", game.id, game.title, error)
      }
    }

    const remaining = await prisma.mediaItem.count({
      where: needsUpgradeWhere(),
    })

    return NextResponse.json({
      success: true,
      done: remaining === 0 || games.length === 0,
      processed: games.length,
      updated,
      skipped,
      errors,
      remaining,
      total,
      lastId: games.at(-1)?.id ?? null,
    })
  } catch (error) {
    console.error("Fix game covers error:", error)
    return NextResponse.json(
      { success: false, error: error instanceof Error ? error.message : "Fix failed" },
      { status: 500 },
    )
  }
}

export async function GET() {
  const needsFixing = await prisma.mediaItem.count({
    where: needsUpgradeWhere(),
  })

  const alreadyFixed = await prisma.mediaItem.count({
    where: {
      type: "GAME",
      posterUrl: { contains: "t_720p" },
    },
  })

  return NextResponse.json({
    needsFixing,
    alreadyFixed,
    message: needsFixing > 0
      ? `${needsFixing} jeux avec des covers basse resolution.`
      : "Toutes les covers sont en haute resolution.",
  })
}
