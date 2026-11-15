import { NextRequest, NextResponse } from "next/server"
import { isCronOrAdminAuthorized } from "@/lib/cron-auth"
import { prisma } from "@/lib/prisma"
import { logCronRun } from "@/lib/cron-log"
import {
  discoverTVShows,
  getTVDetails,
  getTVFrenchRating,
  getTVWatchProviderList,
  getTVWatchProviders,
  mapCertificationToInternal,
} from "@/lib/tmdb"
import {
  getCandidateGamesByIds,
  getGameDetails,
  getImportCandidateGames,
  getTrendingGameIds,
  type GameCandidateLane,
  type IGDBGame,
} from "@/lib/igdb"
import { extractProviders } from "@/lib/streaming-providers"
import { isAdultTmdbTv } from "@/lib/adult-content-filter"
import { estimateProvisionalAgeFromStored } from "@/lib/import-helpers"
import { createTvFromTmdb } from "@/lib/tv-import"
import { createGameFromIgdb } from "@/lib/game-import"
import {
  GAME_THRESHOLDS,
  TV_EXCLUDED_GENRES,
  TV_GENRE,
  TV_THRESHOLDS,
  buildTitleIndex,
  compactForLog,
  parseApprovedIds,
  qualifyGame,
  resolveFrPlatformGroups,
  selectGameCandidates,
  selectTvCandidates,
  type TvDiscoverPage,
} from "@/lib/import-candidates"

// ── Import candidates: preview first, import only what Xavier approved ──
//
//   POST /api/cron/import-candidates?kind=tv|games&dryRun=1[&limit=N]
//     → read-only preview: ranked candidate list (TMDB / IGDB discovery, deduped
//       against media_items). Writes ONE cron_logs row (capped list), nothing else.
//
//   POST /api/cron/import-candidates?kind=tv|games&ids=1,2,3
//     → imports exactly those ids (the approved ones) as provisional fiches,
//       skipping any already present. Never imports "whatever discover returns":
//       without `ids` and without dryRun=1 the call is refused.
//
// Manual dispatch only (cron.yml task `import-candidates-tv` / `-games`), never
// scheduled — so it is deliberately absent from EXPECTED_TASKS,
// KNOWN_CRON_TASKS and the /steph glossary (ad-hoc runs stay on
// /admin/operations). Selection rules + thresholds: src/lib/import-candidates.ts.

export const dynamic = "force-dynamic"
export const maxDuration = 300

const TIME_BUDGET_MS = 265_000
const LOG_CAP = 300
const MAX_TV_IMPORT_IDS = 40 // ~3-5 s each (details + providers + 2 image uploads)
const MAX_GAME_IMPORT_IDS = 100

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms))

function clampLimit(raw: string | null, def: number, max: number): number {
  const n = raw === null ? def : parseInt(raw, 10)
  return Number.isFinite(n) ? Math.min(Math.max(1, n), max) : def
}

export async function POST(req: NextRequest) {
  const startTime = Date.now()
  if (!(await isCronOrAdminAuthorized(req))) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  const { searchParams } = new URL(req.url)
  const kind = searchParams.get("kind")
  if (kind !== "tv" && kind !== "games") {
    return NextResponse.json({ error: "kind attendu : tv ou games" }, { status: 400 })
  }
  const dryRun = searchParams.get("dryRun") === "1"
  const rawIds = searchParams.get("ids")

  if (dryRun) {
    return kind === "tv"
      ? previewTv(startTime, clampLimit(searchParams.get("limit"), TV_THRESHOLDS.defaultLimit, TV_THRESHOLDS.maxLimit))
      : previewGames(startTime, clampLimit(searchParams.get("limit"), GAME_THRESHOLDS.defaultLimit, GAME_THRESHOLDS.maxLimit))
  }

  // Import mode: an explicit, approved id list — or nothing.
  const parsed = parseApprovedIds(rawIds, kind === "tv" ? MAX_TV_IMPORT_IDS : MAX_GAME_IMPORT_IDS)
  if (parsed.error) {
    return NextResponse.json(
      { error: `Import refusé : ${parsed.error}. Utilisez dryRun=1 pour la liste de candidats.` },
      { status: 400 },
    )
  }
  return kind === "tv" ? importTv(startTime, parsed.ids) : importGames(startTime, parsed.ids)
}

// ── Preview: séries ───────────────────────────────────────────────────

async function previewTv(startTime: number, limit: number) {
  const errors: string[] = []
  try {
    const groups = resolveFrPlatformGroups(await getTVWatchProviderList("FR"))
    const missingPlatforms = groups.filter((g) => g.providerIds.length === 0).map((g) => g.label)
    const today = new Date().toISOString().slice(0, 10)
    const excluded = TV_EXCLUDED_GENRES.join(",")
    const pages: TvDiscoverPage[] = []
    let calls = 0

    const lanes = [
      {
        lane: "core" as const,
        pages: TV_THRESHOLDS.corePagesPerPlatform,
        with_genres: `${TV_GENRE.KIDS}|${TV_GENRE.FAMILY}`,
        without_genres: excluded,
        minVotes: TV_THRESHOLDS.coreMinVotes,
      },
      {
        lane: "animation" as const,
        pages: TV_THRESHOLDS.animationPagesPerPlatform,
        with_genres: String(TV_GENRE.ANIMATION),
        without_genres: `${excluded},${TV_GENRE.KIDS},${TV_GENRE.FAMILY}`,
        minVotes: TV_THRESHOLDS.animationMinVotes,
      },
    ]

    for (const group of groups) {
      if (group.providerIds.length === 0) continue
      for (const lane of lanes) {
        for (let page = 1; page <= lane.pages; page++) {
          if (Date.now() - startTime > TIME_BUDGET_MS) break
          try {
            const res = await discoverTVShows({
              page,
              with_genres: lane.with_genres,
              without_genres: lane.without_genres,
              sort_by: "popularity.desc",
              "vote_count.gte": String(lane.minVotes),
              "first_air_date.lte": today,
              watch_region: "FR",
              with_watch_providers: group.providerIds.join("|"),
              with_watch_monetization_types: "flatrate|free|ads",
            })
            calls++
            pages.push({ platform: group.label, lane: lane.lane, results: res.results ?? [] })
            if (!res.results?.length || page >= (res.total_pages ?? 1)) break
          } catch (e) {
            errors.push(`${group.label}/${lane.lane} p${page} : ${e instanceof Error ? e.message : "erreur"}`)
            break
          }
          await sleep(60)
        }
      }
    }

    const seenIds = [...new Set(pages.flatMap((p) => p.results.map((s) => s.id)))]
    const [existingRows, titleRows] = await Promise.all([
      prisma.mediaItem.findMany({ where: { type: "TV", tmdbId: { in: seenIds } }, select: { tmdbId: true } }),
      prisma.mediaItem.findMany({ where: { type: "TV" }, select: { title: true, originalTitle: true } }),
    ])
    const { candidates, stats } = selectTvCandidates({
      pages,
      existingTmdbIds: new Set(existingRows.map((r) => r.tmdbId).filter((id): id is number => id !== null)),
      existingTitles: buildTitleIndex(titleRows),
      today,
      limit,
    })

    const platformGroups = groups.map((g) => ({ label: g.label, providers: g.providerNames }))
    await logCronRun({
      task: "import-candidates",
      status: errors.length > 0 || missingPlatforms.length > 0 ? "partial" : "success",
      summary: `Aperçu séries : ${stats.returned} candidates (${stats.coreReturned} jeunesse/familial), ${stats.alreadyInCatalogue} déjà en base — rien importé`,
      details: {
        kind: "tv",
        mode: "preview",
        limit,
        thresholds: TV_THRESHOLDS,
        stats,
        tmdbCalls: calls,
        platformGroups,
        missingPlatforms,
        errors: errors.slice(0, 20),
        candidates: compactForLog(candidates, LOG_CAP),
      },
      startTime,
    })

    return NextResponse.json({
      success: true,
      kind: "tv",
      mode: "preview",
      thresholds: TV_THRESHOLDS,
      stats,
      platformGroups,
      missingPlatforms,
      errors,
      candidates,
    })
  } catch (error) {
    return fail(startTime, "tv", "preview", error)
  }
}

// ── Preview: jeux ─────────────────────────────────────────────────────

async function previewGames(startTime: number, limit: number) {
  const errors: string[] = []
  try {
    const games: IGDBGame[] = []
    const lanes: GameCandidateLane[] = ["pegi", "family", "mobile"]
    for (const lane of lanes) {
      for (let p = 0; p < GAME_THRESHOLDS.pagesPerLane; p++) {
        try {
          const batch = await getImportCandidateGames(lane, p * 500, 500)
          games.push(...batch)
          if (batch.length < 500) break
        } catch (e) {
          errors.push(`${lane} p${p + 1} : ${e instanceof Error ? e.message : "erreur"}`)
          break
        }
        await sleep(300) // IGDB: 4 req/s
      }
    }

    let trendingIds = new Set<number>()
    try {
      const trending = await getTrendingGameIds(GAME_THRESHOLDS.trendingIds)
      trendingIds = new Set(trending.map((t) => t.gameId))
      await sleep(300)
      games.push(...(await getCandidateGamesByIds([...trendingIds])))
    } catch (e) {
      errors.push(`tendances : ${e instanceof Error ? e.message : "erreur"}`)
    }

    const seenIds = [...new Set(games.map((g) => g.id))]
    const [existingRows, titleRows] = await Promise.all([
      prisma.mediaItem.findMany({ where: { type: "GAME", igdbId: { in: seenIds } }, select: { igdbId: true } }),
      prisma.mediaItem.findMany({ where: { type: "GAME" }, select: { title: true, originalTitle: true } }),
    ])
    const { candidates, stats } = selectGameCandidates({
      games,
      trendingIds,
      existingIgdbIds: new Set(existingRows.map((r) => r.igdbId).filter((id): id is number => id !== null)),
      existingTitles: buildTitleIndex(titleRows),
      nowSec: Math.floor(Date.now() / 1000),
      limit,
    })

    await logCronRun({
      task: "import-candidates",
      status: errors.length > 0 ? "partial" : "success",
      summary: `Aperçu jeux : ${stats.returned} candidats (${stats.coreReturned} avec PEGI ≤ 16), ${stats.alreadyInCatalogue} déjà en base — rien importé`,
      details: {
        kind: "games",
        mode: "preview",
        limit,
        thresholds: GAME_THRESHOLDS,
        stats,
        errors: errors.slice(0, 20),
        candidates: compactForLog(candidates, LOG_CAP),
      },
      startTime,
    })

    return NextResponse.json({
      success: true,
      kind: "games",
      mode: "preview",
      thresholds: GAME_THRESHOLDS,
      stats,
      errors,
      candidates,
    })
  } catch (error) {
    return fail(startTime, "games", "preview", error)
  }
}

// ── Import: the approved ids only ─────────────────────────────────────

async function importTv(startTime: number, ids: number[]) {
  const results: string[] = []
  const stats = { requested: ids.length, imported: 0, alreadyPresent: 0, skipped: 0, notReached: 0, errors: 0 }
  try {
    const present = new Set(
      (await prisma.mediaItem.findMany({ where: { type: "TV", tmdbId: { in: ids } }, select: { tmdbId: true } }))
        .map((r) => r.tmdbId),
    )
    for (const tmdbId of ids) {
      if (present.has(tmdbId)) {
        stats.alreadyPresent++
        continue
      }
      if (Date.now() - startTime > TIME_BUDGET_MS) {
        stats.notReached++
        results.push(`tmdb:${tmdbId} non traité (temps écoulé) — relancer avec les ids restants`)
        continue
      }
      try {
        const details = await getTVDetails(tmdbId)
        if (isAdultTmdbTv(details)) {
          stats.skipped++
          results.push(`tmdb:${tmdbId} ${details.name} — refusé (garde contenu adulte)`)
          continue
        }
        const frRating = getTVFrenchRating(details.content_ratings)
        const platforms = extractProviders(await getTVWatchProviders(tmdbId))
        const { age } = estimateProvisionalAgeFromStored({
          officialRating: mapCertificationToInternal(frRating),
          genres: details.genres?.map((g) => g.name) ?? [],
        })
        await createTvFromTmdb(details, { frRating, expertAgeRec: age, platforms })
        stats.imported++
        results.push(`tmdb:${tmdbId} ${details.name} — importée (âge provisoire ${age})`)
      } catch (e) {
        stats.errors++
        results.push(`tmdb:${tmdbId} — erreur : ${e instanceof Error ? e.message : "inconnue"}`)
      }
      await sleep(120)
    }
    return await finishImport(startTime, "tv", stats, results)
  } catch (error) {
    return fail(startTime, "tv", "import", error)
  }
}

async function importGames(startTime: number, ids: number[]) {
  const results: string[] = []
  const stats = { requested: ids.length, imported: 0, alreadyPresent: 0, skipped: 0, notReached: 0, errors: 0 }
  try {
    const present = new Set(
      (await prisma.mediaItem.findMany({ where: { type: "GAME", igdbId: { in: ids } }, select: { igdbId: true } }))
        .map((r) => r.igdbId),
    )
    const nowSec = Math.floor(Date.now() / 1000)
    for (const igdbId of ids) {
      if (present.has(igdbId)) {
        stats.alreadyPresent++
        continue
      }
      if (Date.now() - startTime > TIME_BUDGET_MS) {
        stats.notReached++
        results.push(`igdb:${igdbId} non traité (temps écoulé) — relancer avec les ids restants`)
        continue
      }
      try {
        const game = await getGameDetails(igdbId)
        if (!game) {
          stats.skipped++
          results.push(`igdb:${igdbId} — introuvable`)
          continue
        }
        // Approved by a human, but the hard guards still hold.
        const q = qualifyGame(game, nowSec)
        if (!q.ok && (q.reason === "adult" || q.reason === "pegi-18" || q.reason === "unreleased")) {
          stats.skipped++
          results.push(`igdb:${igdbId} ${game.name} — refusé (${q.reason})`)
          continue
        }
        const created = await createGameFromIgdb(game)
        if (created) {
          stats.imported++
          results.push(`igdb:${igdbId} ${game.name} — importé`)
        } else {
          stats.skipped++
          results.push(`igdb:${igdbId} ${game.name} — refusé (garde contenu adulte)`)
        }
      } catch (e) {
        stats.errors++
        results.push(`igdb:${igdbId} — erreur : ${e instanceof Error ? e.message : "inconnue"}`)
      }
      await sleep(300)
    }
    return await finishImport(startTime, "games", stats, results)
  } catch (error) {
    return fail(startTime, "games", "import", error)
  }
}

async function finishImport(
  startTime: number,
  kind: "tv" | "games",
  stats: { requested: number; imported: number; alreadyPresent: number; skipped: number; notReached: number; errors: number },
  results: string[],
) {
  const label = kind === "tv" ? "séries" : "jeux"
  await logCronRun({
    task: "import-candidates",
    status: stats.errors > 0 || stats.notReached > 0 ? "partial" : "success",
    summary: `Import validé (${label}) : ${stats.imported}/${stats.requested} importés, ${stats.alreadyPresent} déjà en base`,
    details: { kind, mode: "import", stats, results: results.slice(0, LOG_CAP) },
    startTime,
  })
  return NextResponse.json({ success: true, kind, mode: "import", stats, results })
}

async function fail(startTime: number, kind: "tv" | "games", mode: "preview" | "import", error: unknown) {
  const message = error instanceof Error ? error.message : "import-candidates failed"
  await logCronRun({
    task: "import-candidates",
    status: "error",
    summary: `${kind}/${mode} : ${message}`,
    details: { kind, mode },
    startTime,
  })
  return NextResponse.json({ error: message }, { status: 500 })
}
