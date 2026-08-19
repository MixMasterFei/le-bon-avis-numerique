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

/** Aliases that identify this guide's game in the catalogue. */
function aliasesFor(guideKey: string): string[] {
  const seed = TOP_GAMES.find((s) => s.key === guideKey)
  return seed?.aliases?.length ? seed.aliases : [guideKey]
}

export async function getGuideGameMedia(guideKey: string): Promise<GuideGameMedia | null> {
  if (!GAME_GUIDES.some((g) => g.key === guideKey)) return null

  const aliases = aliasesFor(guideKey)

  // A title match can hit spin-offs ("Minecraft Legends", "Minecraft Dungeons")
  // as well as the game itself. Order by the signals that identify the main
  // entry — most audience votes, then best-populated row — and take the top.
  const candidates = await prisma.mediaItem.findMany({
    where: {
      type: "GAME",
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
  const row = exact ?? candidates[0]

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
