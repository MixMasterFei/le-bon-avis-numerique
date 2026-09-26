import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { logCronRun } from "@/lib/cron-log"
import { searchGames, type IGDBGame } from "@/lib/igdb"
import { createGameFromIgdb } from "@/lib/game-import"
import { pickIgdbCandidate } from "@/lib/game-seed-match"
import { TOP_GAMES } from "@/app/jeux/quel-age/topGames.data"

// Targeted backfill for the /jeux/quel-age pillar: guarantees the high-search
// titles kids ask for by name (Fortnite, Roblox, Minecraft, Brawl Stars…)
// actually exist in the catalogue, rather than hoping they surface via the
// popularity import. Idempotent — skips titles already present by IGDB id.
// Weekly + dispatch (the seed list changes rarely); enrichment then runs via
// the normal daily cron. Source of truth for the list is topGames.data.ts,
// shared with the pillar page.
//
// Search runs on each seed's aliases (never on the display name — "Toca
// Boca (Toca Life World)" is a label, not a query), with mobile platforms
// included because several seeds are phone-only, and the pick is strict
// (src/lib/game-seed-match.ts): a seed with no real match is reported as
// not found instead of importing IGDB's first fuzzy hit under its name.

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

const PACE_MS = 150

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
        // A pinned fiche needs no lookup — only a check that it still exists.
        if (seed.forcedId) {
          const forced = await prisma.mediaItem.findUnique({
            where: { id: seed.forcedId },
            select: { id: true },
          })
          if (forced) {
            stats.alreadyPresent++
          } else {
            stats.notFound++
            details.push(`Fiche épinglée absente : ${seed.name} (${seed.forcedId})`)
          }
          continue
        }

        let pick: IGDBGame | null = null
        for (const alias of seed.aliases) {
          const candidates = await searchGames(alias, 20, { includeMobile: true })
          pick = pickIgdbCandidate(seed, candidates)
          // Gentle pacing so a 40-title run stays well under IGDB rate limits.
          await new Promise((r) => setTimeout(r, PACE_MS))
          if (pick) break
        }
        if (!pick) {
          stats.notFound++
          details.push(`Introuvable sur IGDB : ${seed.name} (essayé : ${seed.aliases.join(", ")})`)
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
