import { prisma } from "@/lib/prisma"
import { conceptKeywords, deriveNewsImageConcept, type NewsImageConcept } from "@/lib/news-image-concepts"

// Stock photo lookup: Pexels primary, Unsplash fallback. Both are
// royalty-free under "do whatever you want with attribution back to
// the source page" licenses — exactly what we need to fill in for
// stories where the publisher's image carries copyright risk.
//
// Free-tier rate limits:
//   Pexels    — 200 req/h, 20k req/month
//   Unsplash  — 50 req/h (demo app)
//
// Cache: every successful lookup is persisted to stock_image_cache
// keyed by (provider, normalized keyword set). Re-runs of the news
// cron on the same theme reuse the cached image instead of burning
// quota and end up with a stable image when stories get merged via
// the title-fingerprint dedup layer in news-discover.ts.

export interface StockImage {
  url: string
  credit: string       // "Marc Dupont / Pexels"
  licenseUrl: string   // back-link to source page (required by both APIs)
  provider: "pexels" | "unsplash"
  query?: string
  conceptLabel?: string
}

const STOCK_CACHE_TTL_MS = 30 * 24 * 60 * 60 * 1000 // 30 days

// French + English stopwords — short list, just enough to keep
// keyword extraction from passing junk like "le", "the", "à" to the
// search APIs. We keep proper nouns (capitalized in the source title)
// because they're usually the most search-effective tokens.
const STOPWORDS = new Set([
  // FR articles + common
  "le", "la", "les", "un", "une", "des", "de", "du", "et", "ou", "où", "à", "au", "aux",
  "ce", "cette", "ces", "cet", "son", "sa", "ses", "leur", "leurs", "mon", "ma", "mes",
  "ton", "ta", "tes", "notre", "votre", "nos", "vos", "qui", "que", "quoi", "dont",
  "pour", "par", "avec", "sans", "sur", "sous", "dans", "entre", "vers", "chez",
  "est", "sont", "était", "été", "être", "avoir", "fait", "faire", "plus", "moins",
  "très", "tout", "tous", "toute", "toutes", "comme", "mais", "donc", "puis",
  // EN
  "the", "a", "an", "and", "or", "of", "in", "on", "at", "to", "for", "with",
  "is", "are", "was", "were", "be", "been", "by", "from", "as", "that", "this",
  "it", "its", "their", "his", "her", "they", "them",
])

/**
 * Reduces a story title to up to `max` search-worthy tokens. Strips
 * accents, lowercases, drops stopwords, prefers longer tokens (more
 * specific). The result is also used as the cache key — same input
 * always produces the same tokens, so cache lookups are stable.
 */
export function extractKeywords(title: string, max = 3): string[] {
  const normalized = title
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "") // strip combining accent marks
    .replace(/[^a-z0-9\s]/g, " ")
    .split(/\s+/)
    .filter(Boolean)
    .filter((t) => t.length >= 3 && !STOPWORDS.has(t))

  // Dedup, prefer longer tokens (more specific signal). Stable sort
  // keeps insertion order for ties so the cache key stays deterministic.
  const seen = new Set<string>()
  const ordered = normalized.filter((t) => {
    if (seen.has(t)) return false
    seen.add(t)
    return true
  })
  return ordered.sort((a, b) => b.length - a.length).slice(0, max)
}

function cacheKey(keywords: string[]): string {
  // Re-sort alphabetically for the cache key — order-of-extraction
  // shouldn't matter for cache hits ("ecrans enfants" = "enfants ecrans").
  return [...keywords].sort().join(" ")
}

async function readCache(provider: StockImage["provider"], keywords: string[]): Promise<StockImage | null> {
  if (keywords.length === 0) return null
  try {
    const row = await prisma.stockImageCache.findUnique({
      where: { provider_keywordsKey: { provider, keywordsKey: cacheKey(keywords) } },
    })
    if (!row) return null
    if (Date.now() - row.createdAt.getTime() > STOCK_CACHE_TTL_MS) return null
    return {
      url: row.imageUrl,
      credit: row.credit,
      licenseUrl: row.licenseUrl,
      provider,
    }
  } catch (err) {
    // Table may not exist yet during the migration window — fail open.
    console.warn("[stock-photo] cache read failed:", err)
    return null
  }
}

async function writeCache(image: StockImage, keywords: string[]): Promise<void> {
  if (keywords.length === 0) return
  try {
    await prisma.stockImageCache.upsert({
      where: { provider_keywordsKey: { provider: image.provider, keywordsKey: cacheKey(keywords) } },
      create: {
        provider: image.provider,
        keywordsKey: cacheKey(keywords),
        imageUrl: image.url,
        credit: image.credit,
        licenseUrl: image.licenseUrl,
      },
      update: {
        imageUrl: image.url,
        credit: image.credit,
        licenseUrl: image.licenseUrl,
        createdAt: new Date(),
      },
    })
  } catch (err) {
    console.warn("[stock-photo] cache write failed:", err)
  }
}

interface PexelsPhoto {
  src?: { landscape?: string; large2x?: string; large?: string; original?: string }
  photographer?: string
  photographer_url?: string
  url?: string
}

interface PexelsResponse {
  photos?: PexelsPhoto[]
}

export async function searchPexels(keywords: string[]): Promise<StockImage | null> {
  const apiKey = process.env.PEXELS_API_KEY
  if (!apiKey || keywords.length === 0) return null

  const cached = await readCache("pexels", keywords)
  if (cached) return cached

  const query = encodeURIComponent(keywords.join(" "))
  const url = `https://api.pexels.com/v1/search?query=${query}&per_page=5&orientation=landscape`

  try {
    const res = await fetch(url, {
      headers: { Authorization: apiKey },
      signal: AbortSignal.timeout(4000),
    })
    if (!res.ok) {
      console.warn(`[stock-photo] Pexels HTTP ${res.status} for "${keywords.join(" ")}"`)
      return null
    }
    const data = (await res.json()) as PexelsResponse
    const photo = data.photos?.[0]
    if (!photo?.src) return null

    const image: StockImage = {
      url: photo.src.landscape ?? photo.src.large2x ?? photo.src.large ?? photo.src.original ?? "",
      credit: `${photo.photographer ?? "Photographer"} / Pexels`,
      licenseUrl: photo.url ?? "https://www.pexels.com/",
      provider: "pexels",
    }
    if (!image.url) return null
    await writeCache(image, keywords)
    return image
  } catch (err) {
    console.warn("[stock-photo] Pexels search failed:", err)
    return null
  }
}

interface UnsplashResult {
  urls?: { regular?: string; full?: string }
  user?: { name?: string; links?: { html?: string } }
  links?: { html?: string }
}

interface UnsplashResponse {
  results?: UnsplashResult[]
}

export async function searchUnsplash(keywords: string[]): Promise<StockImage | null> {
  const apiKey = process.env.UNSPLASH_ACCESS_KEY
  // Unsplash API terms require hotlinking the returned photo.urls.*
  // assets and explicit attribution links. The news pipeline currently
  // mirrors non-fallback images into Supabase, so keep Unsplash behind
  // an opt-in until that path has provider-aware storage behavior.
  if (process.env.UNSPLASH_ENABLE_NEWS_IMAGES !== "1") return null
  if (!apiKey || keywords.length === 0) return null

  const cached = await readCache("unsplash", keywords)
  if (cached) return cached

  const query = encodeURIComponent(keywords.join(" "))
  const url = `https://api.unsplash.com/search/photos?query=${query}&per_page=5&orientation=landscape`

  try {
    const res = await fetch(url, {
      headers: { Authorization: `Client-ID ${apiKey}` },
      signal: AbortSignal.timeout(4000),
    })
    if (!res.ok) {
      console.warn(`[stock-photo] Unsplash HTTP ${res.status} for "${keywords.join(" ")}"`)
      return null
    }
    const data = (await res.json()) as UnsplashResponse
    const photo = data.results?.[0]
    if (!photo?.urls) return null

    // Unsplash attribution requires linking to the photo page AND the
    // photographer's profile. We fold both into the displayed credit:
    // "{name} / Unsplash" linking to the photo page (closest single-link
    // option that satisfies their license terms — see
    // https://unsplash.com/license).
    const image: StockImage = {
      url: photo.urls.regular ?? photo.urls.full ?? "",
      credit: `${photo.user?.name ?? "Photographer"} / Unsplash`,
      licenseUrl: photo.links?.html ?? photo.user?.links?.html ?? "https://unsplash.com/",
      provider: "unsplash",
    }
    if (!image.url) return null
    await writeCache(image, keywords)
    return image
  } catch (err) {
    console.warn("[stock-photo] Unsplash search failed:", err)
    return null
  }
}

/**
 * Top-level helper used by news-image.ts. Pexels first (more generous
 * quota), Unsplash as fallback. Returns null if neither has a hit or
 * if the API keys aren't configured (graceful degradation — the news
 * pipeline will fall through to PUBLISHER_OG instead).
 */
export async function findStockPhoto(title: string): Promise<StockImage | null> {
  const keywords = extractKeywords(title, 3)
  if (keywords.length === 0) return null
  return (await searchPexels(keywords)) ?? (await searchUnsplash(keywords))
}

export async function findContextualStockPhoto(input: {
  title: string
  summary?: string | null
  category?: string | null
}): Promise<(StockImage & { concept: NewsImageConcept }) | null> {
  const concept = deriveNewsImageConcept(input)
  const keywords = conceptKeywords(concept)
  if (keywords.length === 0) return null
  const image = (await searchPexels(keywords)) ?? (await searchUnsplash(keywords))
  if (!image) return null
  return {
    ...image,
    query: concept.query,
    conceptLabel: concept.label,
    concept,
  }
}
