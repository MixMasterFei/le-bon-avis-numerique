import * as cheerio from "cheerio"
import { findStockPhoto, type StockImage } from "@/lib/stock-photo"

// Image resolution — Perplexity-style hierarchy. Tiers are tried in
// order; the first hit wins. We track which tier produced the chosen
// image (`sourceType`) so the card can display a photo credit pill
// and so we can audit the legal posture of the image pool over time.
//
// Tier order (most-to-least defensible):
//   1. AGENCY        — RSS image from a wire-service publisher (Reuters,
//                      AP, AFP…). They produce these for syndication, so
//                      reusing them with a credit is on solid ground.
//   2. PUBLISHER_RSS — RSS media:content / enclosure from any other
//                      publisher. They're putting it in the feed, which
//                      is itself a syndication signal.
//   3. STOCK         — Pexels or Unsplash search on the story keywords.
//                      Royalty-free, must link back. Great fallback for
//                      "abstract" stories (screen time, parenting policy)
//                      where we don't need a specific event photo.
//   4. PUBLISHER_OG  — Scraped from <meta og:image>. Highest legal risk
//                      because we're pulling from the article page, not
//                      a feed the publisher offered. Last resort, always
//                      credited visibly with the source domain.
//   5. null          — no image found, caller drops the story.

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

function hostFromUrl(url: string | undefined): string | null {
  if (!url) return null
  try {
    return new URL(url).hostname.toLowerCase()
  } catch {
    return null
  }
}

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

export async function extractFromOgTags(url: string, timeoutMs = 2000): Promise<string | null> {
  try {
    const controller = new AbortController()
    const timer = setTimeout(() => controller.abort(), timeoutMs)
    const res = await fetch(url, {
      signal: controller.signal,
      headers: { "user-agent": "Mozilla/5.0 (compatible; TotemAviseBot/1.0)" },
    })
    clearTimeout(timer)
    if (!res.ok) return null

    const html = await res.text()
    const $ = cheerio.load(html)
    const og =
      $('meta[property="og:image"]').attr("content") ??
      $('meta[name="og:image"]').attr("content") ??
      $('meta[name="twitter:image"]').attr("content") ??
      $('meta[property="twitter:image"]').attr("content")
    return og ?? null
  } catch {
    return null
  }
}

function stockImageToResolved(stock: StockImage): ResolvedImage {
  return {
    url: stock.url,
    sourceType: "STOCK",
    credit: stock.credit,
    licenseUrl: stock.licenseUrl,
  }
}

/**
 * Walks the 5-tier hierarchy and returns the first usable image with
 * provenance metadata. Returns null only when every tier has failed
 * (caller drops the story).
 *
 * The agency check examines the publisher of the RSS item's link
 * (article URL), not the image URL — most agency syndication republishes
 * from the wire under the publisher's CDN, but we can still tag those
 * cases as AGENCY when the agency is the source of record. Direct image
 * URLs hosted on agency CDNs are also tagged AGENCY.
 */
export async function resolveImage(item: RssLikeItem): Promise<ResolvedImage | null> {
  const articleHost = hostFromUrl(item.link)
  const rssImage = extractFromRss(item)

  // Tier 1: AGENCY — RSS image AND the source publisher is an agency.
  // Either the article URL itself is on an agency domain (Reuters
  // syndication) or the embedded image URL is on an agency CDN.
  if (rssImage) {
    const imageHost = hostFromUrl(rssImage)
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

  // Tier 3 + 4: STOCK — Pexels first, Unsplash fallback. Only attempted
  // when we have a title to derive search keywords from.
  if (item.title) {
    const stock = await findStockPhoto(item.title)
    if (stock) return stockImageToResolved(stock)
  }

  // Tier 5: PUBLISHER_OG — scrape the article page. Last resort, gets
  // the most prominent visible credit on the card (the source domain).
  if (item.link) {
    const og = await extractFromOgTags(item.link)
    if (og) {
      return {
        url: og,
        sourceType: "PUBLISHER_OG",
        credit: articleHost ?? "Source",
      }
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
