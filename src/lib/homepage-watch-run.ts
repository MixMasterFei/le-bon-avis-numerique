/**
 * homepage-watch — I/O side: gather the week's expected titles, read what the
 * V2 homepage shows through the page's own selection functions, then (when
 * writes are allowed) import the missing titles and refresh the band pins.
 * Classification and the report are pure, in `homepage-watch.ts`.
 *
 * Every source is fetched on its own: one failing source degrades the report
 * (« vérification incomplète »), it never aborts the run.
 */

import { revalidateTag } from "next/cache"
import { Prisma } from "@prisma/client"
import { prisma } from "@/lib/prisma"
import { withPrismaRetry } from "@/lib/prisma-retry"
import {
  getMovieDetails,
  getMovieWatchProviders,
  getTrendingMovies,
  getTrendingTVShows,
  getTVDetails,
  getTVWatchProviders,
  getUpcomingMovies,
  type TMDBMovie,
  type TMDBTVShow,
} from "@/lib/tmdb"
import { getFreshReleases, getGameDetails, getGamesByIds, getTrendingGameIds, type IGDBGame } from "@/lib/igdb"
import { getCinemaMovies, getNowPlayingTmdbIds } from "@/lib/cinema"
import { selectUpcomingCinema } from "@/lib/cinema-policy"
import { fetchGames } from "@/lib/media-queries"
import { GAMES_RAIL_FILTERS, GAMES_RAIL_LIMIT } from "@/lib/homepage-games-rail"
import { createMovieFromTmdb, createTvFromTmdb } from "@/lib/import-helpers"
import { createGameFromIgdb } from "@/lib/game-import"
import { extractProviders } from "@/lib/streaming-providers"
import { isAdultIgdbGame } from "@/lib/adult-content-filter"
import { computeHomepageSpotlight, HOMEPAGE_SPOTLIGHT_TAG } from "@/lib/homepage-spotlight-data"
import { gameLaunchScore, isMatureAge } from "@/lib/homepage-spotlight"
import {
  HOMEPAGE_CINEMA_CAP,
  NEW_RELEASE_DAYS,
  NEW_SERIES_DAYS,
  buildWatchReport,
  daysFrom,
  freshGameItems,
  igdbReleaseDate,
  isLaunch,
  newSeasonTiming,
  rankSignal,
  releasedDaysAgo,
  shortDate,
  trendingGameItems,
  selectWatchPins,
  catalogueKey,
  classifyExpected,
  mergeExpected,
  pickImports,
  type CatalogueEntry,
  type ClassifiedItem,
  type ExpectedItem,
  type HomepageSlot,
  type PinDraft,
  type WatchHealth,
  type WatchKind,
  type WatchOutcomes,
} from "@/lib/homepage-watch"

const DAY_MS = 24 * 3_600_000
/** How many trending series get a TMDB details read (new-season check). */
const TV_DETAIL_CHECKS = 12
/** How many missing trending titles get a French-providers check. */
const PROVIDER_CHECKS = 12

function errorText(e: unknown): string {
  return (e instanceof Error ? e.message : String(e)).slice(0, 160)
}

export interface HomepageWatchResult {
  classified: ClassifiedItem[]
  outcomes: WatchOutcomes
  pins: PinDraft[]
  /** 16+ launches the band's 16+ cap kept out of the pins (listed in the report). */
  matureSkipped: ClassifiedItem[]
  report: string
  subject: string
  health: WatchHealth
  remaining: number
}

export async function runHomepageWatch(opts: {
  writesEnabled: boolean
  dryRun: boolean
  now?: Date
}): Promise<HomepageWatchResult> {
  const now = opts.now ?? new Date()
  const canWrite = opts.writesEnabled && !opts.dryRun
  const outcomes: WatchOutcomes = {
    dryRun: opts.dryRun,
    writesEnabled: opts.writesEnabled,
    sources: {},
    homepageReadOk: true,
    catalogueReadOk: true,
    imports: { candidates: 0, created: 0, skipped: 0, failed: 0, keys: [] },
    pins: { desired: 0, written: 0, failed: false, removed: 0 },
  }
  const raw: ExpectedItem[] = []
  // TMDB objects of titles we may import or re-check, by key.
  const trendingTv = new Map<string, TMDBTVShow>()
  const trendingMovie = new Map<string, TMDBMovie>()
  const igdbGames = new Map<number, IGDBGame>()

  const source = async (name: string, fn: () => Promise<number>) => {
    try {
      outcomes.sources[name] = { ok: true, count: await fn() }
    } catch (e) {
      outcomes.sources[name] = { ok: false, count: 0, error: errorText(e) }
    }
  }

  // ── 1. Expected list ───────────────────────────────────────────────────
  let nowPlayingIds = new Set<number>()
  const soonIds = new Set<number>()

  await source("Cinéma à l'affiche", async () => {
    // Same list, same French order as the homepage cinema rail; the big ones only.
    const movies = (await getCinemaMovies()).slice(0, 20)
    nowPlayingIds = await getNowPlayingTmdbIds()
    movies.forEach((m, i) => {
      raw.push({
        key: `MOVIE:tmdb:${m.tmdbId}`,
        kind: "MOVIE",
        title: m.title,
        sources: ["cinema"],
        signal: rankSignal(i, movies.length),
        tmdbId: m.tmdbId,
        frRelevant: true,
        isNew: m.cinemaReleaseBucket === "recent" || m.cinemaReleaseBucket === "upcoming",
        note: m.releaseDate ? `sortie le ${shortDate(m.releaseDate)}` : undefined,
        releasedDaysAgo: releasedDaysAgo(m.releaseDate, now),
      })
    })
    return movies.length
  })

  await source("Cinéma, sorties sous 7 jours", async () => {
    const pages = await Promise.all([1, 2].map((p) => getUpcomingMovies(p)))
    const soon = selectUpcomingCinema(pages.flatMap((p) => p.results ?? []), nowPlayingIds, now).filter(
      (m) => (daysFrom(m.release_date, now) ?? -99) >= -7,
    )
    soon.forEach((m, i) => {
      soonIds.add(m.id)
      raw.push({
        key: `MOVIE:tmdb:${m.id}`,
        kind: "MOVIE",
        title: m.title,
        sources: ["cinema-soon"],
        signal: Math.round(rankSignal(i, soon.length) * 0.6),
        tmdbId: m.id,
        frRelevant: true,
        isNew: true,
        note: `sortie le ${shortDate(m.release_date)}`,
        releasedDaysAgo: releasedDaysAgo(m.release_date, now),
      })
    })
    return soon.length
  })

  await source("Films en tendance", async () => {
    const pages = await Promise.all([1, 2].map((p) => getTrendingMovies("week", p)))
    const list = pages.flatMap((p) => p.results ?? [])
    list.forEach((m, i) => {
      const key = `MOVIE:tmdb:${m.id}`
      trendingMovie.set(key, m)
      const inCinema = nowPlayingIds.has(m.id) || soonIds.has(m.id)
      raw.push({
        key,
        kind: "MOVIE",
        title: m.title,
        sources: ["trending-movie"],
        signal: rankSignal(i, list.length),
        tmdbId: m.id,
        // Settled below for titles outside French cinemas (platforms / providers).
        frRelevant: inCinema || m.original_language === "fr",
        isNew: inCinema || isLaunch(m.release_date, now),
        releasedDaysAgo: releasedDaysAgo(m.release_date, now),
      })
    })
    return list.length
  })

  await source("Séries en tendance", async () => {
    const pages = await Promise.all([1, 2].map((p) => getTrendingTVShows("week", p)))
    const list = pages.flatMap((p) => p.results ?? [])
    list.forEach((s, i) => {
      const key = `TV:tmdb:${s.id}`
      trendingTv.set(key, s)
      raw.push({
        key,
        kind: "TV",
        title: s.name,
        sources: ["trending-tv"],
        signal: rankSignal(i, list.length),
        tmdbId: s.id,
        frRelevant: s.original_language === "fr",
        isNew: isLaunch(s.first_air_date, now, NEW_SERIES_DAYS),
        note: s.first_air_date && isLaunch(s.first_air_date, now, NEW_SERIES_DAYS) ? `lancée le ${shortDate(s.first_air_date)}` : undefined,
        // A new season (step 3) replaces this with its latest episode's date.
        releasedDaysAgo: releasedDaysAgo(s.first_air_date, now),
      })
    })
    return list.length
  })

  await source("Jeux sortis récemment", async () => {
    const games = await getFreshReleases(40, { days: NEW_RELEASE_DAYS, minRatingCount: 3 })
    for (const g of games) igdbGames.set(g.id, g)
    // Rating count × recency, not rating count alone (see freshGameItems).
    const score = (g: IGDBGame) =>
      gameLaunchScore({ votes: g.total_rating_count, trending: null, releaseDate: igdbReleaseDate(g) }, now)
    const items = freshGameItems(games, now, isAdultIgdbGame, score)
    raw.push(...items)
    return items.length
  })

  await source("Jeux en tendance", async () => {
    const trending = await getTrendingGameIds(80)
    const ids = trending.map((t) => t.gameId)
    // Release dates: from the catalogue when we have the game, else from IGDB.
    const knownRows = await withPrismaRetry(() =>
      prisma.mediaItem.findMany({
        where: { type: "GAME", igdbId: { in: ids } },
        select: { igdbId: true, title: true, releaseDate: true },
      }),
    )
    const knownIds = new Set(knownRows.map((k) => k.igdbId as number))
    const unknownIds = ids.filter((id) => !knownIds.has(id) && !igdbGames.has(id)).slice(0, 60)
    if (unknownIds.length > 0) {
      for (const g of await getGamesByIds(unknownIds)) igdbGames.set(g.id, g)
    }
    const known = new Map(knownRows.map((k) => [k.igdbId as number, { title: k.title, releaseDate: k.releaseDate }]))
    const items = trendingGameItems(trending, known, igdbGames, now, isAdultIgdbGame)
    raw.push(...items)
    return items.length
  })

  await source("Titres de nos actualités (7 jours)", async () => {
    const stories = await withPrismaRetry(() =>
      prisma.newsStory.findMany({
        where: { status: "PUBLISHED", publishedAt: { gte: new Date(now.getTime() - 7 * DAY_MS) }, relatedMediaId: { not: null } },
        select: { relatedMediaId: true },
        take: 200,
      }),
    )
    // Primary subject only: the full related list matches whole franchises.
    const counts = new Map<string, number>()
    for (const s of stories) counts.set(s.relatedMediaId as string, (counts.get(s.relatedMediaId as string) ?? 0) + 1)
    if (counts.size === 0) return 0
    const rows = await withPrismaRetry(() =>
      prisma.mediaItem.findMany({
        where: { id: { in: [...counts.keys()] }, type: { in: ["MOVIE", "TV", "GAME"] } },
        select: { id: true, type: true, title: true, tmdbId: true, igdbId: true, releaseDate: true },
      }),
    )
    for (const r of rows) {
      const kind = r.type as WatchKind
      raw.push({
        key: catalogueKey(kind, r) ?? `media:${r.id}`,
        kind,
        title: r.title,
        sources: ["news"],
        signal: Math.min(60, 20 * (counts.get(r.id) ?? 1)),
        tmdbId: r.tmdbId ?? undefined,
        igdbId: r.igdbId ?? undefined,
        mediaId: r.id,
        frRelevant: true,
        isNew: isLaunch(r.releaseDate, now),
        releasedDaysAgo: releasedDaysAgo(r.releaseDate, now),
      })
    }
    return rows.length
  })

  const expected = mergeExpected(raw)

  // ── 2. Catalogue rows for every expected title ─────────────────────────
  const catalogue = new Map<string, CatalogueEntry>()
  const platformsByKey = new Map<string, string[]>()
  const tmdbMovieIds = expected.filter((e) => e.kind === "MOVIE" && e.tmdbId).map((e) => e.tmdbId as number)
  const tmdbTvIds = expected.filter((e) => e.kind === "TV" && e.tmdbId).map((e) => e.tmdbId as number)
  const igdbIds = expected.filter((e) => e.kind === "GAME" && e.igdbId).map((e) => e.igdbId as number)
  const mediaIds = expected.filter((e) => e.mediaId).map((e) => e.mediaId as string)
  try {
    const rows = await withPrismaRetry(() =>
      prisma.mediaItem.findMany({
        where: {
          OR: [
            { type: "MOVIE", tmdbId: { in: tmdbMovieIds } },
            { type: "TV", tmdbId: { in: tmdbTvIds } },
            { type: "GAME", igdbId: { in: igdbIds } },
            { id: { in: mediaIds } },
          ],
        },
        select: { id: true, type: true, title: true, expertAgeRec: true, isEnriched: true, posterUrl: true, tmdbId: true, igdbId: true, platforms: true },
      }),
    )
    for (const r of rows) {
      if (r.type !== "MOVIE" && r.type !== "TV" && r.type !== "GAME") continue
      const entry: CatalogueEntry = {
        id: r.id,
        kind: r.type,
        title: r.title,
        expertAgeRec: r.expertAgeRec,
        isEnriched: r.isEnriched,
        posterUrl: r.posterUrl,
      }
      const key = catalogueKey(r.type, r)
      if (key) {
        catalogue.set(key, entry)
        platformsByKey.set(key, r.platforms ?? [])
      }
      catalogue.set(`media:${r.id}`, entry)
    }
  } catch (e) {
    outcomes.catalogueReadOk = false
    outcomes.sources["Catalogue"] = { ok: false, count: 0, error: errorText(e) }
  }

  // ── 3. French relevance + new seasons (bounded API reads) ──────────────
  let providerChecks = 0
  for (const item of expected) {
    if (item.frRelevant || (item.kind !== "MOVIE" && item.kind !== "TV")) continue
    const platforms = platformsByKey.get(item.key)
    if (platforms && platforms.length > 0) {
      item.frRelevant = true
      continue
    }
    if (catalogue.has(item.key) || providerChecks >= PROVIDER_CHECKS || !item.tmdbId) continue
    providerChecks++
    try {
      const watch = item.kind === "MOVIE" ? await getMovieWatchProviders(item.tmdbId) : await getTVWatchProviders(item.tmdbId)
      item.frRelevant = extractProviders(watch).length > 0
    } catch {
      /* unknown → stays not relevant; never imported on a guess */
    }
  }

  const tvDetails = new Map<string, Awaited<ReturnType<typeof getTVDetails>>>()
  const tvToCheck = expected.filter((e) => e.kind === "TV" && e.frRelevant && !e.isNew && e.tmdbId).slice(0, TV_DETAIL_CHECKS)
  for (const item of tvToCheck) {
    try {
      const d = await getTVDetails(item.tmdbId as number)
      tvDetails.set(item.key, d)
      const season = newSeasonTiming(d, now)
      if (season) {
        item.isNew = true
        item.releasedDaysAgo = season.releasedDaysAgo
        item.note = season.note
      }
    } catch {
      /* stays as classified from the premiere date */
    }
  }

  // ── 4. What the V2 homepage shows (its own selection functions) ────────
  const homepage: HomepageSlot[] = []
  try {
    const [spotlight, cinema, games] = await Promise.all([
      computeHomepageSpotlight(now),
      // CinemaRail: /api/cinema?maxAge=14 (default cinema cap), first 12 cards.
      getCinemaMovies({ maxAge: HOMEPAGE_CINEMA_CAP }),
      // GamesRail: the same query as the page (gamesRailUrl) — uncapped since
      // 27 Nov 2026 (a news row), ranked by notability × recency.
      fetchGames({ ...GAMES_RAIL_FILTERS }),
    ])
    spotlight.forEach((s, i) => homepage.push({ section: "spotlight", position: i + 1, mediaId: s.id }))
    cinema.slice(0, 12).forEach((m, i) =>
      homepage.push({ section: "cinema", position: i + 1, mediaId: m.inDatabase ? m.id : null, tmdbId: m.tmdbId }),
    )
    games.items.slice(0, GAMES_RAIL_LIMIT).forEach((g, i) => homepage.push({ section: "games", position: i + 1, mediaId: g.id }))
  } catch (e) {
    outcomes.homepageReadOk = false
    outcomes.sources["Lecture de l'accueil"] = { ok: false, count: 0, error: errorText(e) }
  }

  const classified = classifyExpected(expected, catalogue, homepage)
  // Without the catalogue every title would read as « missing »: no writes.
  const writeNow = canWrite && outcomes.catalogueReadOk

  // ── 5. Imports (missing, relevant in France, capped) ───────────────────
  const imports = pickImports(classified)
  outcomes.imports.candidates = imports.length
  if (writeNow) {
    for (const item of imports) {
      try {
        let created: string | null = null
        if (item.kind === "MOVIE" && item.tmdbId) {
          const details = await getMovieDetails(item.tmdbId)
          let providers: string[] = []
          try {
            providers = extractProviders(await getMovieWatchProviders(item.tmdbId))
          } catch {
            providers = []
          }
          created = await createMovieFromTmdb(details, { providers })
        } else if (item.kind === "TV" && item.tmdbId) {
          const details = tvDetails.get(item.key) ?? (await getTVDetails(item.tmdbId))
          let providers: string[] = []
          try {
            providers = extractProviders(await getTVWatchProviders(item.tmdbId))
          } catch {
            providers = []
          }
          created = await createTvFromTmdb(details, { providers })
        } else if (item.kind === "GAME" && item.igdbId) {
          const game = igdbGames.get(item.igdbId) ?? (await getGameDetails(item.igdbId))
          created = game ? await createGameFromIgdb(game) : null
        }
        if (created) {
          outcomes.imports.created++
          outcomes.imports.keys.push(item.key)
        } else {
          outcomes.imports.skipped++ // adult guard / unknown upstream
        }
      } catch (e) {
        // A parallel import got there first: the title exists, nothing to fix.
        if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === "P2002") {
          outcomes.imports.skipped++
        } else {
          outcomes.imports.failed++
          console.error(`[homepage-watch] import failed for ${item.key} "${item.title}":`, errorText(e))
        }
      }
    }
  }

  // ── 6. Band pins ───────────────────────────────────────────────────────
  let adminPinned = new Set<string>()
  let adminMatureCount = 0
  try {
    const admin = await prisma.homepageSpotlight.findMany({
      where: { source: "admin", expiresAt: { gt: now } },
      select: { mediaId: true, startsAt: true, media: { select: { expertAgeRec: true } } },
    })
    adminPinned = new Set(admin.map((a) => a.mediaId))
    // Live admin 16+ pins use the band's 16+ slots first (counted, never removed).
    adminMatureCount = admin.filter((a) => a.startsAt <= now && isMatureAge(a.media?.expertAgeRec)).length
  } catch {
    /* table not created yet (migration 016) — the write below reports it */
  }
  const { pins, matureSkipped } = selectWatchPins(classified, now, { adminPinnedIds: adminPinned, adminMatureCount })
  outcomes.pins.desired = pins.length
  if (writeNow) {
    try {
      const [removed, created] = await prisma.$transaction([
        prisma.homepageSpotlight.deleteMany({ where: { source: "watch" } }),
        prisma.homepageSpotlight.createMany({
          data: pins.map((p) => ({
            mediaId: p.mediaId,
            reason: p.reason,
            source: "watch",
            rank: p.rank,
            startsAt: p.startsAt,
            expiresAt: p.expiresAt,
          })),
          skipDuplicates: true,
        }),
      ])
      outcomes.pins.removed = removed.count
      outcomes.pins.written = created.count
      revalidateTag(HOMEPAGE_SPOTLIGHT_TAG, { expire: 0 })
    } catch (e) {
      if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === "P2021") {
        // Migration 016 not applied yet: a known setup state, not a failing
        // write — reported in the email, without tripping the supervisor.
        outcomes.pins.tableMissing = true
      } else {
        outcomes.pins.failed = true
        outcomes.pins.error = errorText(e)
      }
    }
  }

  const { report, subject, health, remaining } = buildWatchReport({ classified, outcomes, pins, now, matureSkipped })
  return { classified, outcomes, pins, matureSkipped, report, subject, health, remaining }
}
