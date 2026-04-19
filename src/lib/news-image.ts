import * as cheerio from "cheerio"

// Priority order for resolving an article's lead image:
// 1. media:content / media:thumbnail on the RSS item
// 2. <enclosure type="image/*">
// 3. First <img> in the RSS HTML blob (content:encoded / description)
// 4. Fetch the article URL and parse <meta property="og:image">
//
// If all four fail, return null — the caller must drop the item.

export interface RssLikeItem {
  link?: string
  enclosure?: { url?: string; type?: string } | undefined
  "media:content"?: { $?: { url?: string } } | unknown
  "media:thumbnail"?: { $?: { url?: string } } | unknown
  content?: string
  contentSnippet?: string
  "content:encoded"?: string
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

export async function resolveImage(item: RssLikeItem): Promise<string | null> {
  const fromRss = extractFromRss(item)
  if (fromRss) return fromRss
  if (item.link) {
    const og = await extractFromOgTags(item.link)
    if (og) return og
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
