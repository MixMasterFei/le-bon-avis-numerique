import { prisma } from "@/lib/prisma"
import { withPrismaRetry } from "@/lib/prisma-retry"
import { NON_POSTER_URLS } from "@/lib/media-route"
import { isChristmasThemed } from "@/lib/seasonal"
import { guideKeyForTitle } from "@/lib/game-guides"
import { isGameGuidePublic } from "@/lib/game-guide-flag"
import {
  NOEL_AGE_BANDS,
  dropAddOns,
  effectiveGameAge,
  giftOrder,
  giftPlatforms,
  groupByBand,
  homonymTitles,
  needsYear,
  onCurrentConsole,
  weightedRating,
  type BandGroup,
} from "./selection"

// Server fetchers for the /noel pages. Everything a parent reads (age, title,
// poster) comes from the catalogue at request time; the rules that decide
// what is listed live in ./selection.ts.
//
// Both lists are expert-only: `isEnriched: true`, like every curated surface
// (a provisional age is a genre guess and can't be a family recommendation).

const OLDEST = NOEL_AGE_BANDS[NOEL_AGE_BANDS.length - 1].max

export interface NoelCard {
  id: string
  type: "MOVIE" | "GAME"
  title: string
  /** Release year, printed only when another card carries the same title. */
  disambiguationYear: number | null
  posterUrl: string | null
  expertAgeRec: number
  officialRating: string | null
  platforms: string[]
  /** Parents' guide key, only when the guides are public. */
  guideKey: string | null
}

// Accent variants: Postgres ILIKE does not fold « ë ». The prefilter only
// narrows the read — the exact rule is `isChristmasThemed` below.
const CHRISTMAS_TITLE_TOKENS = [
  "noël",
  "noel",
  "christmas",
  "xmas",
  "giftmas",
  "santa",
  "jingle",
  "nutcracker",
  "réveillon",
  "reveillon",
  "scrooge",
  "grinch",
]

export const NOEL_FILMS_PER_BAND = 12
export const NOEL_GAMES_PER_BAND = 10

/** Films de Noël, enrichis, rangés par tranche d'âge. */
export async function fetchChristmasFilmsByBand(now: Date = new Date()): Promise<BandGroup<NoelCard>[]> {
  const rows = await withPrismaRetry(() =>
    prisma.mediaItem.findMany({
      where: {
        type: "MOVIE",
        isEnriched: true,
        posterUrl: { not: null, notIn: [...NON_POSTER_URLS] },
        expertAgeRec: { not: null, lte: OLDEST },
        releaseDate: { lte: now },
        // A Christmas horror film is not a « film de Noël en famille ».
        NOT: { genres: { hasSome: ["Horreur"] } },
        // Vote floor: keeps a 3-vote TV movie from outranking the classics.
        tmdbVoteCount: { gte: 50 },
        OR: [
          { topics: { hasSome: ["Noël", "noel"] } },
          ...CHRISTMAS_TITLE_TOKENS.map((t) => ({ title: { contains: t, mode: "insensitive" as const } })),
        ],
      },
      select: {
        id: true,
        title: true,
        posterUrl: true,
        releaseDate: true,
        expertAgeRec: true,
        officialRating: true,
        genres: true,
        topics: true,
        tmdbRating: true,
        tmdbVoteCount: true,
      },
      take: 600,
    }),
  )

  const ranked = rows
    .filter((r) => isChristmasThemed(r))
    .map((r) => ({ ...r, score: weightedRating(r.tmdbRating, r.tmdbVoteCount, 200, 6.5) }))
    .sort((a, b) => b.score - a.score)

  const groups = groupByBand(ranked, (r) => r.expertAgeRec, NOEL_FILMS_PER_BAND)
  const shown = groups.flatMap((g) => g.items)
  const homonyms = homonymTitles(shown)

  return groups.map(({ band, items }) => ({
    band,
    items: items.map(
      (r): NoelCard => ({
        id: r.id,
        type: "MOVIE",
        title: r.title,
        disambiguationYear: needsYear(r.title, homonyms) ? (r.releaseDate?.getFullYear() ?? null) : null,
        posterUrl: r.posterUrl,
        expertAgeRec: r.expertAgeRec!,
        officialRating: r.officialRating,
        platforms: [],
        guideKey: null,
      }),
    ),
  }))
}

/** Jeux vidéo à offrir : jeux enrichis, classés PEGI, sur une console actuelle. */
export async function fetchGiftGamesByBand(now: Date = new Date()): Promise<BandGroup<NoelCard>[]> {
  const rows = await withPrismaRetry(() =>
    prisma.mediaItem.findMany({
      where: {
        type: "GAME",
        isEnriched: true,
        posterUrl: { not: null, notIn: [...NON_POSTER_URLS] },
        expertAgeRec: { not: null, lte: OLDEST },
        // A PEGI on the box: something a parent can check in the shop.
        officialRating: { startsWith: "PEGI_" },
        releaseDate: { lte: now },
        platforms: { hasSome: ["Switch 2", "Switch", "PS5", "Xbox Series"] },
        dataQualityScore: { gte: 80 },
        tmdbVoteCount: { gte: 20 },
      },
      select: {
        id: true,
        title: true,
        posterUrl: true,
        releaseDate: true,
        expertAgeRec: true,
        officialRating: true,
        platforms: true,
        tmdbRating: true,
        tmdbVoteCount: true,
      },
      take: 1500,
    }),
  )

  const guidesPublic = isGameGuidePublic()
  const pool = dropAddOns(
    rows
      .filter((r) => onCurrentConsole(r.platforms))
      .map((r) => ({
        ...r,
        effectiveAge: effectiveGameAge(r.expertAgeRec, r.officialRating),
        score: weightedRating(r.tmdbRating, r.tmdbVoteCount, 50, 7),
      })),
  )

  const all = groupByBand(pool, (r) => r.effectiveAge, Number.POSITIVE_INFINITY)
  const groups = all.map(({ band, items }) => ({
    band,
    items: giftOrder(items, now, 18, 4).slice(0, NOEL_GAMES_PER_BAND),
  }))
  const homonyms = homonymTitles(groups.flatMap((g) => g.items))

  return groups.map(({ band, items }) => ({
    band,
    items: items.map(
      (r): NoelCard => ({
        id: r.id,
        type: "GAME",
        title: r.title,
        disambiguationYear: needsYear(r.title, homonyms) ? (r.releaseDate?.getFullYear() ?? null) : null,
        posterUrl: r.posterUrl,
        // The card prints our own age, as on the fiche; the band was chosen
        // from the stricter of that age and the PEGI (see effectiveGameAge).
        expertAgeRec: r.expertAgeRec!,
        officialRating: r.officialRating,
        platforms: giftPlatforms(r.platforms),
        guideKey: guidesPublic ? guideKeyForTitle(r.title) : null,
      }),
    ),
  }))
}
