import { prisma } from "@/lib/prisma"
import { GAME_GUIDES } from "@/lib/game-guides"
import { TOP_GAMES } from "@/app/jeux/quel-age/topGames.data"

/**
 * Connects a Parents' Guide to its catalogue entry so the page can show real
 * imagery — cover, stills, platforms — instead of being a wall of text.
 *
 * The guide's editorial content stays hand-written in game-guides.ts; this
 * only supplies the visual and factual furniture that already exists in the
 * DB and is maintained by the normal import/enrichment crons. That split
 * matters: imagery going stale is cosmetic, whereas the "état du jeu" facts
 * going stale is the thing we gate the whole feature on.
 *
 * Returns null when the game is not in the catalogue yet — the guide must
 * still render, just without the gallery. A guide that 500s because an
 * import has not run would be a worse failure than a guide with no photos.
 */

export interface GuideGameMedia {
  id: string
  title: string
  posterUrl: string | null
  backdropUrl: string | null
  expertAgeRec: number | null
  platforms: string[]
  screenshots: { id: string; url: string; width: number | null; height: number | null; order: number }[]
}

const MEDIA_SELECT = {
  id: true,
  title: true,
  posterUrl: true,
  backdropUrl: true,
  expertAgeRec: true,
  platforms: true,
  screenshots: { orderBy: { order: "asc" as const }, take: 12 },
} as const

/** Aliases that identify this guide's game in the catalogue. */
function aliasesFor(guideKey: string): string[] {
  const seed = TOP_GAMES.find((s) => s.key === guideKey)
  return seed?.aliases?.length ? seed.aliases : [guideKey]
}

export async function getGuideGameMedia(guideKey: string): Promise<GuideGameMedia | null> {
  const guide = GAME_GUIDES.find((g) => g.key === guideKey)
  if (!guide) return null

  // A guide written about one release (GTA VI, not the most-voted GTA) pins
  // its fiche. If that row is gone, fall through to alias matching rather
  // than render without furniture.
  if (guide.catalogueId) {
    const pinned = await prisma.mediaItem.findFirst({
      where: { id: guide.catalogueId, type: "GAME" },
      select: MEDIA_SELECT,
    })
    if (pinned) return toGuideMedia(pinned)
  }

  const aliases = aliasesFor(guideKey)
  // A remake sold under its original's exact name: only rows released inside
  // the seed's window can stand for it (see TopGameSeed.releasedFrom).
  const releasedFrom = TOP_GAMES.find((s) => s.key === guideKey)?.releasedFrom

  // A title match can hit spin-offs ("Minecraft Legends", "Minecraft Dungeons")
  // as well as the game itself. Order by the signals that identify the main
  // entry — most audience votes, then best-populated row — and take the top.
  const candidates = await prisma.mediaItem.findMany({
    where: {
      type: "GAME",
      ...(releasedFrom ? { releaseDate: { gte: new Date(`${releasedFrom}T00:00:00.000Z`) } } : {}),
      OR: aliases.map((a) => ({ title: { contains: a, mode: "insensitive" as const } })),
    },
    select: {
      id: true,
      title: true,
      posterUrl: true,
      backdropUrl: true,
      expertAgeRec: true,
      platforms: true,
      tmdbVoteCount: true,
      dataQualityScore: true,
      screenshots: { orderBy: { order: "asc" as const }, take: 12 },
    },
    orderBy: [{ tmdbVoteCount: "desc" }, { dataQualityScore: "desc" }],
    take: 5,
  })

  if (candidates.length === 0) return null

  // Prefer an exact-ish title (the bare game name) over a spin-off, then fall
  // back to the best-ranked candidate.
  const exact = candidates.find((c) => aliases.includes(c.title.trim().toLowerCase()))
  return toGuideMedia(exact ?? candidates[0])
}

function toGuideMedia(row: {
  id: string
  title: string
  posterUrl: string | null
  backdropUrl: string | null
  expertAgeRec: number | null
  platforms: string[] | null
  screenshots: { id: string; url: string; width: number | null; height: number | null; order: number }[] | null
}): GuideGameMedia {
  return {
    id: row.id,
    title: row.title,
    posterUrl: row.posterUrl,
    backdropUrl: row.backdropUrl,
    expertAgeRec: row.expertAgeRec,
    platforms: row.platforms ?? [],
    screenshots: (row.screenshots ?? []).map((s) => ({
      id: s.id,
      url: s.url,
      width: s.width,
      height: s.height,
      order: s.order,
    })),
  }
}
