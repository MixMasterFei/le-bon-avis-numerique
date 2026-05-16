import * as cheerio from "cheerio"
import {
  imageHostFromUrl,
  isBlockedHotlinkImageUrl,
  isLowQualityImagePublisher,
} from "@/lib/news-image-policy"
import { findContextualStockPhoto } from "@/lib/stock-photo"

// Image resolution — Perplexity-inspired, but conservative. We keep the
// persisted Prisma enum values stable (AGENCY/STOCK/PUBLISHER_RSS/
// FALLBACK) while the resolver applies a stricter logical hierarchy:
// official/agency RSS, allowlisted institutional RSS, contextual stock,
// then a generated editorial fallback. Generic publisher RSS is no
// longer the default path because attribution alone is not a license.

export type ImageSourceType = "AGENCY" | "STOCK" | "PUBLISHER_RSS" | "PUBLISHER_OG" | "FALLBACK"

export interface ResolvedImage {
  url: string
  sourceType: ImageSourceType
  credit: string             // human-readable, used in the card overlay
  licenseUrl?: string        // STOCK only — back-link required by Pexels/Unsplash
  auditLabel?: string
}

// Origin the generated fallback card is served from. Absolute so the
// moderation vision model and the Supabase mirror guard can resolve it,
// and so it's still valid when stored in news_stories. Mirrors the
// SITE_URL fallback chain used by cron-supervisor.ts.
const APP_ORIGIN =
  process.env.NEXT_PUBLIC_APP_URL || process.env.SITE_URL || "https://totemavise.com"

const FALLBACK_CARD_PATH = "/api/news/fallback-card"
const CONTEXTUAL_STOCK_ENABLED = process.env.NEWS_CONTEXTUAL_STOCK_IMAGES === "true"

/**
 * Branded "zen card" fallback image for a news story. `category` is a
 * NewsCategory enum value (PARENTHOOD | FILM_TV | GAMES | READING | TECH);
 * anything else gets a generic "Actualités" card. The card is rendered by
 * the /api/news/fallback-card route and is family-safe by construction —
 * so, unlike a real photo, it never needs the dimension gate or pass-2
 * moderation, and it's exempt from the cross-story image-dedup (the same
 * card SHOULD be reusable across image-less stories).
 */
export function fallbackCard(category: string | null | undefined, seed?: string | null): ResolvedImage {
  const cat = typeof category === "string" ? category : ""
  const stableSeed = typeof seed === "string" && seed.trim() ? seed.trim() : cat
  return {
    url: `${APP_ORIGIN}${FALLBACK_CARD_PATH}?cat=${encodeURIComponent(cat)}&seed=${encodeURIComponent(stableSeed)}`,
    sourceType: "FALLBACK",
    credit: "Totem Avise",
    auditLabel: "EDITORIAL_FALLBACK",
  }
}

/** True when an image URL points at our own generated fallback card. */
export function isFallbackCardUrl(url: string | null | undefined): boolean {
  return typeof url === "string" && url.includes(FALLBACK_CARD_PATH)
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
  summary?: string
  sourceName?: string        // e.g. "Reuters" — used for the AGENCY/RSS credit string
  category?: string
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

const OFFICIAL_PRESS_DOMAINS = [
  "about.netflix.com",
  "media.netflix.com",
  "press.aboutamazon.com",
  "aboutamazon.com",
  "blog.google",
  "openai.com",
  "nintendo.com",
  "news.xbox.com",
  "playstation.com",
  "lego.com",
]

const SAFE_RSS_SOURCE_NAMES = new Set<string>([
  "CLEMI",
  "Fondation pour l'Enfance",
  "INSERM Actualites",
  "INSERM Actualités",
  "Sante publique France",
  "Santé publique France",
  "PedaGoJeux",
  "PédaGoJeux",
])

function isAgencyDomain(host: string | null): boolean {
  if (!host) return false
  return AGENCY_DOMAINS.some((d) => host === d || host.endsWith(`.${d}`))
}

function isOfficialPressDomain(host: string | null): boolean {
  if (!host) return false
  return OFFICIAL_PRESS_DOMAINS.some((d) => host === d || host.endsWith(`.${d}`))
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
export async function resolveImage(item: RssLikeItem): Promise<ResolvedImage | null> {
  // Publisher-level curation: some sources ship generic mascot art
  // that looks out of place in the news grid. Returning null drops
  // the story entirely via the caller's "no image → skip" rule.
  if (isLowQualityImagePublisher(item.sourceName)) return null

  const articleHost = imageHostFromUrl(item.link)
  const rssImage = extractFromRss(item)
  if (isBlockedHotlinkImageUrl(rssImage)) return null

  if (rssImage) {
    const imageHost = imageHostFromUrl(rssImage)
    if (isOfficialPressDomain(articleHost) || isOfficialPressDomain(imageHost)) {
      return {
        url: rssImage,
        sourceType: "AGENCY",
        credit: `${item.sourceName ?? articleHost ?? imageHost ?? "Source officielle"} (asset officiel)`,
        auditLabel: "OFFICIAL_PRESS",
      }
    }
  }

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
        auditLabel: "AGENCY_LICENSED",
      }
    }
  }

  if (rssImage && item.sourceName && SAFE_RSS_SOURCE_NAMES.has(item.sourceName)) {
    return {
      url: rssImage,
      sourceType: "PUBLISHER_RSS",
      credit: item.sourceName ?? articleHost ?? "Source",
      auditLabel: "PUBLISHER_RSS_ALLOWLIST",
    }
  }

  if (CONTEXTUAL_STOCK_ENABLED && item.title) {
    const stock = await findContextualStockPhoto({
      title: item.title,
      summary: item.summary,
      category: item.category,
    })
    if (stock) {
      return {
        url: stock.url,
        sourceType: "STOCK",
        credit: stock.credit,
        licenseUrl: stock.licenseUrl,
        auditLabel: `STOCK_CONTEXTUAL:${stock.concept.label}`,
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

// Minimum acceptable dimensions for a hero image. A 16:9 card rendered
// at ~720px on desktop needs at least ~500px of source width to avoid
// the visibly-upscaled portrait-stretched-to-landscape look that Xavier
// flagged on the Café Pédagogique brief. Anything smaller is a
// thumbnail / avatar, not an editorial image.
export const MIN_IMAGE_WIDTH = 500
export const MIN_IMAGE_HEIGHT = 280

/**
 * Parses JPEG / PNG / WebP headers from the first chunk of an image and
 * returns its intrinsic dimensions. Format coverage is intentionally
 * narrow — those three account for ~all publisher RSS imagery. Returns
 * null when the format isn't recognized (caller fails open, since "no
 * dimensions" is not the same as "small image").
 */
function parseImageDimensions(buf: Uint8Array): { width: number; height: number } | null {
  // PNG IHDR (chunks start after the 8-byte signature; IHDR length is fixed)
  if (
    buf.length >= 24 &&
    buf[0] === 0x89 && buf[1] === 0x50 && buf[2] === 0x4e && buf[3] === 0x47
  ) {
    const width = (buf[16] << 24) | (buf[17] << 16) | (buf[18] << 8) | buf[19]
    const height = (buf[20] << 24) | (buf[21] << 16) | (buf[22] << 8) | buf[23]
    return { width, height }
  }
  // JPEG: walk markers until a SOF segment is found
  if (buf.length >= 4 && buf[0] === 0xff && buf[1] === 0xd8) {
    let i = 2
    while (i < buf.length - 9) {
      while (i < buf.length && buf[i] === 0xff) i++
      if (i >= buf.length) break
      const marker = buf[i]
      i++
      if (marker === 0xd8 || marker === 0xd9 || marker === 0x01) continue
      if (marker >= 0xd0 && marker <= 0xd7) continue
      if (i + 1 >= buf.length) break
      const segLen = (buf[i] << 8) | buf[i + 1]
      const isSof =
        (marker >= 0xc0 && marker <= 0xc3) ||
        (marker >= 0xc5 && marker <= 0xc7) ||
        (marker >= 0xc9 && marker <= 0xcb) ||
        (marker >= 0xcd && marker <= 0xcf)
      if (isSof) {
        if (i + 6 >= buf.length) return null
        const height = (buf[i + 3] << 8) | buf[i + 4]
        const width = (buf[i + 5] << 8) | buf[i + 6]
        return { width, height }
      }
      i += segLen
    }
  }
  // WebP: RIFF .... WEBP (VP8 / VP8L / VP8X)
  if (
    buf.length >= 30 &&
    buf[0] === 0x52 && buf[1] === 0x49 && buf[2] === 0x46 && buf[3] === 0x46 &&
    buf[8] === 0x57 && buf[9] === 0x45 && buf[10] === 0x42 && buf[11] === 0x50
  ) {
    const fourcc = String.fromCharCode(buf[12], buf[13], buf[14], buf[15])
    if (fourcc === "VP8 ") {
      const width = ((buf[27] << 8) | buf[26]) & 0x3fff
      const height = ((buf[29] << 8) | buf[28]) & 0x3fff
      return { width, height }
    }
    if (fourcc === "VP8L") {
      const width = 1 + (((buf[22] & 0x3f) << 8) | buf[21])
      const height =
        1 + (((buf[25] & 0xf) << 10) | (buf[24] << 2) | ((buf[23] & 0xc0) >> 6))
      return { width, height }
    }
    if (fourcc === "VP8X") {
      const width = 1 + (buf[24] | (buf[25] << 8) | (buf[26] << 16))
      const height = 1 + (buf[27] | (buf[28] << 8) | (buf[29] << 16))
      return { width, height }
    }
  }
  return null
}

/**
 * Fetches the first 64 KB of an image and reads its intrinsic dimensions
 * from the file header. Returns null on any failure — caller decides
 * whether unknown dimensions are acceptable. Fast enough to call inline
 * during RSS ingestion (Range GET, ~5 KB JPEG header parse).
 */
export async function probeImageDimensions(
  url: string,
  timeoutMs = 3500,
): Promise<{ width: number; height: number } | null> {
  try {
    const controller = new AbortController()
    const timer = setTimeout(() => controller.abort(), timeoutMs)
    const res = await fetch(url, {
      headers: {
        "user-agent": "Mozilla/5.0 (compatible; TotemAviseBot/1.0)",
        Range: "bytes=0-65535",
      },
      signal: controller.signal,
      redirect: "follow",
    })
    clearTimeout(timer)
    if (!res.ok && res.status !== 206) return null
    const ct = (res.headers.get("content-type") ?? "").toLowerCase()
    if (ct && !ct.startsWith("image/")) return null
    const buf = new Uint8Array(await res.arrayBuffer())
    return parseImageDimensions(buf)
  } catch {
    return null
  }
}

/**
 * Validates that a resolved image is large enough to render as a hero
 * without visible upscaling. Returns true when the image meets
 * MIN_IMAGE_WIDTH / MIN_IMAGE_HEIGHT, or when probing failed entirely
 * (fail-open: a transient probe failure shouldn't drop a story whose
 * image might be fine). Returns false only when we can prove the image
 * is too small.
 */
export async function isImageLargeEnough(url: string): Promise<boolean> {
  const dims = await probeImageDimensions(url)
  if (!dims) return true
  return dims.width >= MIN_IMAGE_WIDTH && dims.height >= MIN_IMAGE_HEIGHT
}
