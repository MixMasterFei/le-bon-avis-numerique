/**
 * Gate for the per-game Parents' Guide (/jeux/guide/[key]).
 *
 * Two layers, both required for a guide to be public:
 *   - `GAME_GUIDES_PUBLIC=true` — one env switch, instant rollback, default OFF
 *     (mirrors `HOMEPAGE_V2_PUBLIC` / `TOTEM_PUBLIC`);
 *   - a human review recorded per guide in `game-guide-reviews.ts`.
 *
 * The default matters more than usual here. A guide that tells a parent a
 * control is in place when it is not does real harm, so a guide stays behind
 * the gate until it has been read end to end by a human. Admins always see
 * every guide.
 *
 * Pure + synchronous so server pages that already resolved `isAdmin` can call
 * it without an extra await, and the middleware can import it cheaply.
 */
import { GUIDE_HUMAN_REVIEWS } from "@/lib/game-guide-reviews"

/** The global switch alone. */
export function isGameGuidePublic(): boolean {
  return process.env.GAME_GUIDES_PUBLIC === "true"
}

/** Public AND indexable: switch on and this guide human-reviewed. */
export function isGuideReleased(key: string): boolean {
  return isGameGuidePublic() && Object.prototype.hasOwnProperty.call(GUIDE_HUMAN_REVIEWS, key)
}

/** Whether this viewer may see this guide (admins see every guide). */
export function guideVisible(key: string, isAdmin: boolean): boolean {
  return isAdmin || isGuideReleased(key)
}

/** Keys of the released guides (sitemap, public links). */
export function releasedGuideKeys(): string[] {
  return isGameGuidePublic() ? Object.keys(GUIDE_HUMAN_REVIEWS) : []
}
