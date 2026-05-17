// Runtime size rewriter for TMDB image URLs.
//
// Why this exists
//   The catalog stores posters at /t/p/w500/... because that's a clean default
//   for the media-detail hero. But the homepage and search rails display
//   posters at ~200x300, so shipping w500 wastes ~600 KiB across a single
//   above-the-fold pageview (PageSpeed mobile report flagged this as the
//   largest first-party savings).
//
//   Rather than re-importing the entire catalog, we rewrite the size segment
//   on render. TMDB's image CDN serves any of its named sizes from the same
//   path — only the segment between `/t/p/` and the file changes.
//
// Available poster widths (TMDB):
//   w92, w154, w185, w342, w500, w780, original
//
// Pick the smallest width ≥ the displayed CSS width × 2 (for HiDPI screens),
// rounded up to a TMDB-supported tier.

export type TmdbPosterSize = "w92" | "w154" | "w185" | "w342" | "w500" | "w780" | "original"

const TMDB_HOST = "image.tmdb.org"

// Match `/t/p/<size>/<path>`. Captures the segment so we can swap it.
// Tolerant to leading/trailing slashes around the size.
const TMDB_PATH_REGEX = /(\/t\/p\/)w\d+(\/)/i

/**
 * Returns a rewritten TMDB URL targeting the given size. Inputs that aren't
 * TMDB URLs (placeholder paths, IGDB covers, etc.) pass through unchanged so
 * callers can use this universally without sniffing the source.
 */
export function tmdbPosterAtSize(url: string | null | undefined, size: TmdbPosterSize): string {
  if (!url) return ""
  if (!url.includes(TMDB_HOST)) return url
  return url.replace(TMDB_PATH_REGEX, `$1${size}$2`)
}

/**
 * Picks the smallest TMDB poster size adequate for a given displayed CSS
 * width. Uses a 2× factor for HiDPI then snaps up to the nearest TMDB tier.
 *
 *   displayCssWidth ≤ 92  → w185   (small thumb)
 *   displayCssWidth ≤ 171 → w342   (card rail)
 *   displayCssWidth ≤ 250 → w500   (full media detail)
 *   displayCssWidth > 250 → w780   (hero)
 */
export function tmdbPosterSizeForWidth(displayCssWidth: number): TmdbPosterSize {
  if (displayCssWidth <= 92) return "w185"
  if (displayCssWidth <= 171) return "w342"
  if (displayCssWidth <= 250) return "w500"
  return "w780"
}
