import { unstable_cache } from "next/cache"
import { fetchGiftGamesByBand } from "./queries"

// « Is this game on the gift page? » — asked by every game fiche in season.
// The answer comes from the gift page's own fetcher (fetchGiftGamesByBand),
// never a copy of its rules, and is cached for an hour like the page itself:
// one catalogue read per hour for the whole site, not one per fiche.

export const NOEL_GIFT_GAMES_TAG = "noel-gift-games"

const cachedGiftGameIds = unstable_cache(
  async (): Promise<string[]> => {
    const groups = await fetchGiftGamesByBand()
    return groups.flatMap((g) => g.items.map((i) => i.id))
  },
  ["noel-gift-game-ids-v1"],
  // A failed refresh throws, so the previous list is kept, not replaced by [].
  { revalidate: 3600, tags: [NOEL_GIFT_GAMES_TAG] },
)

/** True when the game is listed on /noel/jeux-video-a-offrir. Never throws. */
export async function isNoelGiftGame(mediaId: string): Promise<boolean> {
  try {
    return (await cachedGiftGameIds()).includes(mediaId)
  } catch (error) {
    console.error("[noel] gift list unavailable:", error instanceof Error ? error.message : error)
    return false
  }
}
