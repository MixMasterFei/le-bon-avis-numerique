import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { logCronRun } from "@/lib/cron-log"
import { searchGames } from "@/lib/igdb"
import { createGameFromIgdb } from "@/lib/game-import"
import { TOP_GAMES } from "@/app/jeux/quel-age/topGames.data"

// Targeted backfill for the /jeux/quel-age pillar: guarantees the high-search
// titles kids ask for by name (Fortnite, Roblox, Minecraft, GTA…) actually
// exist in the catalogue, rather than hoping they surface via the popularity
// import. Idempotent — skips titles already present by IGDB id. Manual /
// dispatch-only (the seed list changes rarely); enrichment then runs via the
// normal daily cron. Source of truth for the list is topGames.data.ts, shared
// with the pillar page.

export const maxDuration = 60

function isAuthorized(req: NextRequest): boolean {
  const authHeader = req.headers.get("authorization")
  if (authHeader === `Bearer ${process.env.CRON_SECRET}`) return true
  if (
    process.env.NODE_ENV === "development" &&
    process.env.ALLOW_INSECURE_CRON_LOCAL === "true"
  ) {
    return true
  }
  return false
}

export async function GET(req: NextRequest) {
  if (!isAuthorized(req)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  const startTime = Date.now()
  const stats = { examined: 0, imported: 0, alreadyPresent: 0, notFound: 0, errors: 0 }
  const details: string[] = []

  try {
    for (const seed of TOP_GAMES) {
      stats.examined++
      try {
        // IGDB search on the display name; then prefer a candidate whose name
        // actually contains one of the seed's aliases (so "GTA" resolves to a
        // Grand Theft Auto entry, not a fuzzy match), most-rated first.
        const candidates = await searchGames(seed.name, 20)
        const matched = candidates
          .filter((g) => {
            const n = g.name?.toLowerCase() ?? ""
            return seed.aliases.some((a) => n.includes(a))
          })
          .sort((a, b) => (b.total_rating_count ?? 0) - (a.total_rating_count ?? 0))

        const pick = matched[0] ?? candidates[0]
        if (!pick) {
          stats.notFound++
          details.push(`Introuvable sur IGDB : ${seed.name}`)
          continue
        }

        const existing = await prisma.mediaItem.findFirst({
          where: { type: "GAME", igdbId: pick.id },
          select: { id: true },
        })
        if (existing) {
          stats.alreadyPresent++
          continue
        }

        const created = await createGameFromIgdb(pick)
        if (created) {
          stats.imported++
          details.push(`Importé : ${pick.name} (${seed.name})`)
        } else {
          details.push(`Ignoré (guard) : ${pick.name}`)
        }
        // Gentle pacing so a 24-title run stays well under IGDB rate limits.
        await new Promise((r) => setTimeout(r, 150))
      } catch (e) {
        stats.errors++
        details.push(`Erreur ${seed.name} : ${e instanceof Error ? e.message : "inconnue"}`)
      }
    }

    const duration = Math.round((Date.now() - startTime) / 1000)
    await logCronRun({
      task: "games-top-names",
      status: stats.errors > 0 && stats.imported === 0 ? "partial" : "success",
      summary: `${stats.imported} jeux importés, ${stats.alreadyPresent} déjà présents, ${stats.notFound} introuvables en ${duration}s`,
      details: { stats, details },
      startTime,
    })

    return NextResponse.json({ success: true, duration: `${duration}s`, stats, details })
  } catch (error) {
    await logCronRun({
      task: "games-top-names",
      status: "error",
      summary: error instanceof Error ? error.message : "games-top-names failed",
      startTime,
    })
    return NextResponse.json(
      { error: "games-top-names failed", message: error instanceof Error ? error.message : "Unknown" },
      { status: 500 },
    )
  }
}
