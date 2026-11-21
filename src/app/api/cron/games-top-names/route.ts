import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { logCronRun } from "@/lib/cron-log"
import { searchGames, type IGDBGame } from "@/lib/igdb"
import { createGameFromIgdb } from "@/lib/game-import"
import { pickForLookup, seedLookups } from "@/lib/game-seed-match"
import { TOP_GAMES } from "@/app/jeux/quel-age/topGames.data"
import { allowsInsecureLocalCron, isCronJobRequest } from "@/lib/cron-credential"

// Targeted backfill for the /jeux/quel-age pillar: guarantees the high-search
// titles kids ask for by name (Fortnite, Roblox, Minecraft, Brawl Stars…)
// actually exist in the catalogue, rather than hoping they surface via the
// popularity import. Idempotent — skips titles already present by IGDB id.
// Weekly + dispatch (the seed list changes rarely); enrichment then runs via
// the normal daily cron. Source of truth for the list is topGames.data.ts,
// shared with the pillar page.
//
// Each seed's preferred editions (`catalogueTitles`, exact names) are searched
// first, so a newer edition the pillar prefers gets imported (Mario Kart
// World, not another Mario Kart 8); then its aliases (never the display name — "Toca
// Boca (Toca Life World)" is a label, not a query), with mobile platforms
// included because several seeds are phone-only, and the pick is strict
// (src/lib/game-seed-match.ts): a seed with no real match is reported as
// not found instead of importing IGDB's first fuzzy hit under its name.

export const maxDuration = 60

// The automation credential only (constant-time, fail-closed, scoped to the
// scheduled job routes); development bypass behind an explicit opt-in — see
// weekly-dossier for the rationale (tunnel-exposed `next dev`).
function isAuthorized(req: NextRequest): boolean {
  return isCronJobRequest(req) || allowsInsecureLocalCron()
}

const PACE_MS = 150
// Stop starting new seeds past this point; maxDuration is 60 s.
const TIME_BUDGET_MS = 50_000

export async function GET(req: NextRequest) {
  if (!isAuthorized(req)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  const startTime = Date.now()
  const stats = { examined: 0, imported: 0, alreadyPresent: 0, notFound: 0, skipped: 0, errors: 0 }
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

        // Out of time: report the rest instead of being killed mid-run
        // (maxDuration) with no cron_logs row at all.
        if (Date.now() - startTime > TIME_BUDGET_MS) {
          stats.skipped++
          continue
        }

        // Preferred editions first, then aliases (see seedLookups).
        let pick: IGDBGame | null = null
        let viaEdition = false
        const results = new Map<string, IGDBGame[]>()
        for (const lookup of seedLookups(seed)) {
          const key = lookup.query.toLowerCase()
          let candidates = results.get(key)
          if (!candidates) {
            candidates = await searchGames(lookup.query, 20, { includeMobile: true })
            results.set(key, candidates)
            // Gentle pacing so a 40-title run stays well under IGDB rate limits.
            await new Promise((r) => setTimeout(r, PACE_MS))
          }
          pick = pickForLookup(seed, lookup, candidates)
          if (pick) {
            viaEdition = lookup.kind === "catalogueTitle"
            break
          }
        }
        if (!pick) {
          stats.notFound++
          details.push(`Introuvable sur IGDB : ${seed.name} (essayé : ${seedLookups(seed).map((l) => l.query).join(", ")})`)
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
          details.push(`Importé : ${pick.name} (${seed.name}${viaEdition ? ", édition préférée" : ""})`)
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
      status: (stats.errors > 0 && stats.imported === 0) || stats.skipped > 0 ? "partial" : "success",
      summary: `${stats.imported} jeux importés, ${stats.alreadyPresent} déjà présents, ${stats.notFound} introuvables${stats.skipped ? `, ${stats.skipped} reportés (temps écoulé)` : ""} en ${duration}s`,
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
