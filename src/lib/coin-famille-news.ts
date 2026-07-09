import { prisma } from "@/lib/prisma"
import type { Prisma } from "@prisma/client"
import { fallbackCard } from "@/lib/news-image"
import { isBlockedHotlinkImageUrl } from "@/lib/news-image-policy"
import { balanceNewsForFeed } from "@/lib/news-feed-balancer"
import type { NewsSourceRef } from "@/components/home-v2/ApercuNewsSourcePills"
import type { NewsCategoryKey } from "@/components/home-v2/apercuNewsLabels"

/**
 * "Le Coin Famille" curated news — the legal-safe strand.
 *
 * Unlike the aperçu feed (which links to an internal AI-synthesized brief),
 * a Coin Famille card NEVER republishes a summary of the article. It shows:
 *   - the publisher's factual headline (`sources[0].headline ?? title`),
 *   - an inline expand revealing Totem Avisé's own editorial angle
 *     (`familyTakeaway` — original opinion, "pourquoi c'est intéressant
 *     pour les familles"),
 *   - a "Lire l'article" link straight to the original publisher.
 *
 * i.e. facts + our opinion + an outbound link. No `summary`/`body` is ever
 * rendered. `status:"PUBLISHED"` is already family-screened (news-discover
 * demotes any story whose primary catalog match is 14+ to PENDING_REVIEW).
 */

// The reader is the parent, so we keep parent_only items (screen-time
// studies, policy) — the safety levers are the PUBLISHED screen + the
// grave-tone exclusion inside balanceNewsForFeed, not an audience filter.
const FAMILY_CATEGORIES = ["PARENTHOOD", "FILM_TV", "GAMES", "READING", "TECH"] as const

export interface CoinFamilleNewsItem {
  slug: string
  /** Publisher headline (facts, not copyrightable) shown on the card. */
  headline: string
  /** AI-synthesized title — kept only as a fallback when no source headline. */
  title: string
  imageUrl: string
  /** Branded category card to swap in if a hotlinked photo 403s on the client. */
  fallbackImageUrl: string | null
  imageCredit: string | null
  imageLicenseUrl: string | null
  category: NewsCategoryKey
  publishedAt: string // ISO — serializable across the server→client boundary
  sources: NewsSourceRef[]
  /** Totem Avisé's original editorial angle (the expand target). */
  familyTakeaway: string
  /** Outbound link to the original publisher (sources[0].url). */
  articleUrl: string | null
}

const CARD_SELECT = {
  id: true,
  slug: true,
  title: true,
  imageUrl: true,
  sourceImageUrl: true,
  imageCredit: true,
  imageLicenseUrl: true,
  category: true,
  publishedAt: true,
  relevanceScore: true,
  sources: true,
  familyTakeaway: true,
  // Editorial supervision tags → balanceNewsForFeed (hero never grave, no
  // stacked topicCluster).
  editorialTone: true,
  topicCluster: true,
} as const

type NewsRow = Prisma.NewsStoryGetPayload<{ select: typeof CARD_SELECT }>

function toSources(raw: Prisma.JsonValue | null): NewsSourceRef[] {
  if (!Array.isArray(raw)) return []
  const seen = new Set<string>()
  return raw.flatMap((entry): NewsSourceRef[] => {
    if (typeof entry !== "object" || entry === null) return []
    const e = entry as Record<string, unknown>
    const name = typeof e.name === "string" ? e.name : ""
    const url = typeof e.url === "string" ? e.url : ""
    if (!name || !url || seen.has(name)) return []
    seen.add(name)
    return [
      {
        name,
        url,
        favicon: typeof e.favicon === "string" ? e.favicon : undefined,
        headline: typeof e.headline === "string" ? e.headline : undefined,
        country: typeof e.country === "string" ? e.country : undefined,
      },
    ]
  })
}

function rowToItem(row: NewsRow): CoinFamilleNewsItem {
  // directSource image policy (like V4/V5): prefer the real publisher photo,
  // branded category card only when there's none.
  const fb = fallbackCard(row.category, row.title)
  const hasPhoto = Boolean(row.sourceImageUrl && !isBlockedHotlinkImageUrl(row.sourceImageUrl))
  const sources = toSources(row.sources)
  return {
    slug: row.slug,
    headline: sources[0]?.headline ?? row.title,
    title: row.title,
    imageUrl: hasPhoto ? row.sourceImageUrl! : fb.url,
    fallbackImageUrl: fb.url,
    imageCredit: hasPhoto ? row.imageCredit : fb.credit,
    imageLicenseUrl: hasPhoto ? row.imageLicenseUrl : (fb.licenseUrl ?? null),
    category: row.category,
    publishedAt: row.publishedAt.toISOString(),
    sources,
    familyTakeaway: row.familyTakeaway ?? "",
    articleUrl: sources[0]?.url ?? null,
  }
}

async function fetchPool(sinceDays: number): Promise<NewsRow[]> {
  const since = new Date(Date.now() - sinceDays * 24 * 60 * 60 * 1000)
  return prisma.newsStory.findMany({
    where: {
      status: "PUBLISHED",
      storyType: "BRIEF",
      category: { in: [...FAMILY_CATEGORIES] },
      familyTakeaway: { not: null },
      publishedAt: { gte: since },
    },
    orderBy: { publishedAt: "desc" },
    take: 24,
    select: CARD_SELECT,
  })
}

/**
 * Returns the curated Coin Famille news items (default 6: 1 hero + 5). Pulls a
 * recency pool, balances tone/cluster, then takes the top N. Widens the recency
 * window if the 5-day pool is thin so the strand never starves.
 */
export async function getCoinFamilleNews(take = 6): Promise<CoinFamilleNewsItem[]> {
  let pool = await fetchPool(5)
  if (pool.length < take + 2) pool = await fetchPool(10)
  const balanced = balanceNewsForFeed(pool, take)
  return balanced.slice(0, take).map(rowToItem)
}
