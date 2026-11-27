/**
 * Human reviews of the Parents' Guides — the ONLY thing that releases a guide.
 *
 * A guide goes public (and indexable) when BOTH hold:
 *   1. `GAME_GUIDES_PUBLIC=true` (the global switch / kill switch), and
 *   2. its key is listed here, i.e. a person read every claim of
 *      docs/guides-verification.md for that guide against the official pages.
 *
 * Until 22 Nov 2026 the switch was all-or-nothing: nine guides, ~8 h of
 * checking, nothing could go live before the last one was read. Listing guides
 * one by one lets Fortnite and Roblox ship first. (The GTA VI guide was
 * withdrawn on 27 Nov 2026: an 18+ game gets a blog article instead.)
 *
 * When adding an entry: also set that guide's `stateOfPlay.verifiedOn` to the
 * same date in src/lib/game-guides.ts, so the freshness audit and the
 * « vérifié le » line on the page agree. A test enforces it.
 *
 * Kept dependency-free: the middleware imports it on every /jeux/guide/ request.
 */
export interface GuideHumanReview {
  /** ISO date the checklist was completed. */
  reviewedOn: string
  /** Who read it (first name is enough). */
  by: string
}

export const GUIDE_HUMAN_REVIEWS: Readonly<Record<string, GuideHumanReview>> = {
  // "fortnite": { reviewedOn: "2026-11-28", by: "Xavier" },
}
