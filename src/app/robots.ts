import type { MetadataRoute } from "next"
import { PRIVATE_PATHS } from "@/lib/private-paths"

// Private/auth-only or legacy surfaces no crawler should index.
// Shared with the middleware, which ENFORCES this list against crawlers that
// ignore robots.txt (see src/lib/private-paths.ts).

// AI bots we explicitly allow. This now includes the INDEX/TRAINING crawlers
// (GPTBot, ClaudeBot, CCBot, Google-Extended) on top of the live "answer"
// bots — so the models actually KNOW the catalog exists and can recommend it
// unprompted, not only when a user makes them browse. A discovery-stage guide
// benefits far more from being indexable than from withholding content.
const AI_BOTS = [
  // Live answer/search bots
  "OAI-SearchBot",
  "ChatGPT-User",
  "PerplexityBot",
  "Claude-SearchBot",
  // Index / training crawlers (previously blocked)
  "GPTBot",
  "ClaudeBot",
  "CCBot",
  "Google-Extended",
]

/**
 * The `/md/` markdown layer is a CITATION source for answer engines, not a
 * crawl target — every response already carries `X-Robots-Tag: noindex, follow`
 * and none of it is in the sitemap. But noindex only takes effect AFTER a
 * fetch, so Googlebot was crawling the whole layer and filing each URL under
 * "Excluded by 'noindex' tag": 1 175 pages and climbing, measured at ~49
 * requests per 6 h. There is one `/md/media/<id>` twin per fiche, so the
 * ceiling is the catalogue itself (11 311 URLs) — crawl budget spent on pages
 * that can never be indexed, on a site that already has 385 URLs sitting in
 * "Crawled - currently not indexed".
 *
 * Blocking it for `*` (i.e. Googlebot) while leaving every AI bot group
 * untouched is exactly the layer's stated intent: answer engines read it,
 * search crawlers skip it.
 */
const CRAWLER_ONLY_DISALLOW = ["/md/"]

export default function robots(): MetadataRoute.Robots {
  const baseUrl = process.env.NEXT_PUBLIC_APP_URL || "https://totemavise.com"

  return {
    rules: [
      { userAgent: "*", allow: "/", disallow: [...PRIVATE_PATHS, ...CRAWLER_ONLY_DISALLOW] },
      ...AI_BOTS.map((userAgent) => ({
        userAgent,
        allow: "/",
        disallow: [...PRIVATE_PATHS],
      })),
    ],
    sitemap: `${baseUrl}/sitemap.xml`,
  }
}
