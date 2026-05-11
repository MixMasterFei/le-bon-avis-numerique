import * as cheerio from "cheerio"
import {
  imageHostFromUrl,
  isBlockedHotlinkImageUrl,
  isLowQualityImagePublisher,
} from "@/lib/news-image-policy"

// Image resolution — simplified to 2 tiers (May 2026 redesign). The
// previous 5-tier cascade (AGENCY → PUBLISHER_RSS → Pexels → Unsplash
// → OG-scrape) silently dropped stories at every layer with no per-
// tier visibility, and the stock-photo + OG-scrape paths were the
// source of recurring fragility (quota exhaustion, sortiraparis-style
// hotlink 403s, legally questionable scraping).
//
// New tier order:
//   1. AGENCY        — RSS image from a wire-service publisher (Reuters,
//                      AP, AFP…). They produce these for syndication, so
//                      reusing them with a credit is on solid ground.
//   2. PUBLISHER_RSS — RSS media:content / enclosure from any other
//                      publisher. They're putting it in the feed, which
//                      is itself a syndication signal.
//   3. null          — no image found, caller drops the story. The
//                      droppedNoImage counter on DiscoverStats surfaces
//                      this in cron logs so we can see which run is
//                      starved by image-less feeds.
//
// The legacy STOCK and PUBLISHER_OG variants stay in ImageSourceType so
// historical rows in news_stories don't fail to deserialize, but no new
// image will be assigned those types until we re-introduce a tier.

export type ImageSourceType = "AGENCY" | "STOCK" | "PUBLISHER_RSS" | "PUBLISHER_OG"

export interface ResolvedImage {
  url: string
  sourceType: ImageSourceType
  credit: string             // human-readable, used in the card overlay
  licenseUrl?: string        // STOCK only — back-link required by Pexels/Unsplash
}

export interface RssLikeItem {
  link?: string
  enclosure?: { url?: string; type?: string } | undefined
  "media:content"?: { $?: { url?: string } } | unknown
  "media:thumbnail"?: { $?: { url?: string } } | unknown
  content?: string
  contentSnippet?: string
  "content:encoded"?: string
  // Optional fields the caller can pass to feed the tier classifier
  // and the credit-text builder. Both are already known by news-discover
  // when it constructs the RssLikeItem.
  title?: string
  sourceName?: string        // e.g. "Reuters" — used for the AGENCY/RSS credit string
}

// Wire-service / agency domains. RSS images from these get tagged as
// AGENCY because the publisher's whole business model is syndication
// — reusing their image with a credit aligns with how their feed is
// meant to be consumed. Bare hostnames; subdomains (www., feeds., …)
// match via endsWith.
const AGENCY_DOMAINS = [
  "reuters.com",
  "apnews.com",
  "ap.org",
  "afp.com",
  "gettyimages.com",
  "epa.eu",
  "shutterstock.com",
  "belga.be",
  "sipa.com",
  "aa.com.tr",   // Anadolu Agency
  "efe.com",
  "ansa.it",
  "dpa.com",
]

function isAgencyDomain(host: string | null): boolean {
  if (!host) return false
  return AGENCY_DOMAINS.some((d) => host === d || host.endsWith(`.${d}`))
}

function pickMediaUrl(field: unknown): string | null {
  if (!field) return null
  if (typeof field === "string") return field
  if (typeof field === "object" && field !== null) {
    const f = field as { $?: { url?: string }; url?: string }
    return f.$?.url ?? f.url ?? null
  }
  return null
}

/**
 * Picks the best RSS-embedded image URL: media:content, media:thumbnail,
 * enclosure, or the first <img> in the HTML body. Returns null if none
 * exists. Pure extraction — no classification.
 */
export function extractFromRss(item: RssLikeItem): string | null {
  const media = pickMediaUrl(item["media:content"]) ?? pickMediaUrl(item["media:thumbnail"])
  if (media) return media

  if (item.enclosure?.url && (item.enclosure.type?.startsWith("image/") ?? true)) {
    return item.enclosure.url
  }

  const html = item["content:encoded"] ?? item.content ?? ""
  if (html) {
    const $ = cheerio.load(html)
    const src = $("img").first().attr("src")
    if (src) return src
  }

  return null
}

/**
 * Walks the (now 2-tier) hierarchy and returns the first usable image
 * with provenance metadata. Returns null when neither AGENCY nor
 * PUBLISHER_RSS yields a usable image — caller increments
 * droppedNoImage and skips the item.
 *
 * The agency check examines the publisher of the RSS item's link
 * (article URL), not the image URL — most agency syndication republishes
 * from the wire under the publisher's CDN, but we can still tag those
 * cases as AGENCY when the agency is the source of record. Direct image
 * URLs hosted on agency CDNs are also tagged AGENCY.
 *
 * Stock photos (Pexels/Unsplash) and OG-tag scraping were removed in
 * the May 2026 simplification — they were the source of cascading
 * silent failures (quota exhaustion, hotlink 403s, legally fragile
 * scraping). If we want a stock-photo fallback later we'll add it
 * back behind a feature flag with explicit quota tracking.
 */
export function resolveImage(item: RssLikeItem): ResolvedImage | null {
  // Publisher-level curation: some sources ship generic mascot art
  // that looks out of place in the news grid. Returning null drops
  // the story entirely via the caller's "no image → skip" rule.
  if (isLowQualityImagePublisher(item.sourceName)) return null

  const articleHost = imageHostFromUrl(item.link)
  const rssImage = extractFromRss(item)
  if (isBlockedHotlinkImageUrl(rssImage)) return null

  // Tier 1: AGENCY — RSS image AND the source publisher is an agency.
  // Either the article URL itself is on an agency domain (Reuters
  // syndication) or the embedded image URL is on an agency CDN.
  if (rssImage) {
    const imageHost = imageHostFromUrl(rssImage)
    if (isAgencyDomain(articleHost) || isAgencyDomain(imageHost)) {
      return {
        url: rssImage,
        sourceType: "AGENCY",
        credit: item.sourceName ?? articleHost ?? imageHost ?? "Agence",
      }
    }
  }

  // Tier 2: PUBLISHER_RSS — RSS image from any non-agency publisher.
  // Publisher chose to put it in the feed, which is the strongest
  // syndication signal short of being an agency.
  if (rssImage) {
    return {
      url: rssImage,
      sourceType: "PUBLISHER_RSS",
      credit: item.sourceName ?? articleHost ?? "Source",
    }
  }

  return null
}

/**
 * HEAD-checks an image URL: returns true only if the response is 2xx
 * AND the Content-Type starts with "image/". Used at persist time to
 * guarantee that what gets stored will actually render in the browser.
 * Falls back to false on any error or timeout — better to drop the
 * story than show a broken-image card.
 */
export async function isImageReachable(url: string, timeoutMs = 3500): Promise<boolean> {
  try {
    const controller = new AbortController()
    const timer = setTimeout(() => controller.abort(), timeoutMs)
    const res = await fetch(url, {
      method: "HEAD",
      signal: controller.signal,
      headers: { "user-agent": "Mozilla/5.0 (compatible; TotemAviseBot/1.0)" },
      redirect: "follow",
    })
    clearTimeout(timer)
    if (!res.ok) return false
    const ct = (res.headers.get("content-type") ?? "").toLowerCase()
    return ct.startsWith("image/")
  } catch {
    return false
  }
}
