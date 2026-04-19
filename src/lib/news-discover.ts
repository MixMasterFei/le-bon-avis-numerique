import Parser from "rss-parser"
import { prisma } from "@/lib/prisma"
import { getAnthropic, DEFAULT_MODEL } from "@/lib/anthropic"
import { NEWS_SOURCES, type NewsSource } from "@/lib/news-sources"
import { resolveImage, type RssLikeItem } from "@/lib/news-image"
import { slugify, faviconFor } from "@/lib/news-slug"
import type { NewsCategory } from "@prisma/client"

interface HydratedItem {
  sourceName: string
  sourceCategory: NewsCategory
  title: string
  link: string
  summary: string
  imageUrl: string
  publishedAt: Date
}

interface SynthesizedStory {
  slug: string
  title: string
  summary: string
  body: string
  category: NewsCategory
  relevanceScore: number
  imageUrl: string
  sourceIndexes: number[]
}

type RssParser = Parser<Record<string, unknown>, RssLikeItem & Record<string, unknown>>

function makeParser(): RssParser {
  return new Parser({
    timeout: 8000,
    customFields: {
      item: [
        ["media:content", "media:content", { keepArray: false }],
        ["media:thumbnail", "media:thumbnail", { keepArray: false }],
        ["content:encoded", "content:encoded"],
      ],
    },
    headers: { "user-agent": "Mozilla/5.0 (compatible; TotemAviseBot/1.0)" },
  }) as RssParser
}

async function fetchOne(parser: RssParser, source: NewsSource, since: Date) {
  try {
    const feed = await parser.parseURL(source.url)
    const items = (feed.items ?? []).filter((it) => {
      const t = it.isoDate ? new Date(it.isoDate) : it.pubDate ? new Date(it.pubDate) : null
      return t !== null && t > since && !!it.link && !!it.title
    })
    return items.map((it) => ({ source, item: it }))
  } catch (err) {
    console.warn(`[news-discover] Skipping ${source.name}: ${(err as Error).message}`)
    return []
  }
}

async function parallelMap<T, R>(items: T[], concurrency: number, fn: (item: T) => Promise<R>): Promise<R[]> {
  const out: R[] = new Array(items.length)
  let i = 0
  const workers = Array.from({ length: Math.min(concurrency, items.length) }, async () => {
    while (i < items.length) {
      const idx = i++
      out[idx] = await fn(items[idx])
    }
  })
  await Promise.all(workers)
  return out
}

function buildPrompt(items: HydratedItem[]): string {
  const list = items
    .map((it, idx) => {
      const summary = (it.summary ?? "").slice(0, 400).replace(/\s+/g, " ")
      return `[${idx}] (${it.sourceName} · ${it.sourceCategory}) ${it.title}\n  URL: ${it.link}\n  IMG: ${it.imageUrl}\n  ${summary}`
    })
    .join("\n\n")

  return `Tu es l'éditeur de Totem Avisé, un guide pour familles françaises.

Voici ${items.length} articles publiés ces 48 dernières heures. Chaque article a un index, une source, une catégorie, un titre, une URL, une image, et un résumé.

Regroupe-les en HISTOIRES (un cluster d'articles couvrant le même sujet = une histoire). Pour chaque histoire, renvoie un objet JSON avec :
- "title": titre éditorial accrocheur (en français, sans clickbait grossier)
- "summary": résumé d'1 à 2 phrases (< 200 caractères)
- "body": corps de 150 à 250 mots en markdown (synthèse neutre, paragraphes courts, jamais mentionner d'IA)
- "category": une valeur parmi PARENTHOOD, FILM_TV, GAMES, READING
- "relevanceScore": pertinence familiale, nombre entre 0 et 1
- "imageUrl": l'URL exacte d'UNE des images des articles du cluster (jamais inventer)
- "sourceIndexes": tableau des indexes des articles sources du cluster

Règles :
- Maximum 12 histoires, classées par pertinence décroissante
- Chaque histoire DOIT regrouper au moins 1 article (sources vides = à supprimer)
- Ignore politique pure, sport, faits divers sans angle familial
- Chaque "imageUrl" DOIT correspondre exactement à l'IMG d'un des articles cités
- Français uniquement

Réponds UNIQUEMENT avec un objet JSON au format :
{"stories": [ ... ]}

Articles :

${list}`
}

function isStringArray(x: unknown): x is string[] {
  return Array.isArray(x) && x.every((v) => typeof v === "string")
}

function coerceStory(raw: unknown, itemCount: number): SynthesizedStory | null {
  if (typeof raw !== "object" || raw === null) return null
  const r = raw as Record<string, unknown>
  const title = typeof r.title === "string" ? r.title.trim() : ""
  const summary = typeof r.summary === "string" ? r.summary.trim() : ""
  const body = typeof r.body === "string" ? r.body.trim() : ""
  const category = typeof r.category === "string" ? r.category : ""
  const imageUrl = typeof r.imageUrl === "string" ? r.imageUrl.trim() : ""
  const relevanceScore = typeof r.relevanceScore === "number" ? r.relevanceScore : 0

  const rawIdx = Array.isArray(r.sourceIndexes)
    ? r.sourceIndexes
    : isStringArray(r.sourceIndexes)
    ? (r.sourceIndexes as string[]).map((s) => Number(s))
    : []
  const sourceIndexes = rawIdx
    .map((n) => Number(n))
    .filter((n) => Number.isInteger(n) && n >= 0 && n < itemCount)

  if (!title || !summary || !body || !imageUrl) return null
  if (!["PARENTHOOD", "FILM_TV", "GAMES", "READING"].includes(category)) return null
  if (sourceIndexes.length === 0) return null

  return {
    slug: slugify(title),
    title,
    summary,
    body,
    category: category as NewsCategory,
    relevanceScore: Math.max(0, Math.min(1, relevanceScore)),
    imageUrl,
    sourceIndexes,
  }
}

export interface DiscoverStats {
  sourcesFetched: number
  itemsCollected: number
  itemsDroppedNoImage: number
  storiesSynthesized: number
  storiesDroppedInvalid: number
  storiesPersisted: number
  archivedCount: number
  durationMs: number
}

export async function runNewsDiscover(): Promise<DiscoverStats> {
  const started = Date.now()
  const parser = makeParser()
  const since = new Date(Date.now() - 48 * 60 * 60 * 1000)

  // 1. Fetch all feeds in parallel
  const fetchBatches = await Promise.all(NEWS_SOURCES.map((s) => fetchOne(parser, s, since)))
  const pairs = fetchBatches.flat()

  // 2. Resolve image per item (drops anything without one)
  const hydrated: HydratedItem[] = []
  let droppedNoImage = 0
  await parallelMap(pairs, 8, async ({ source, item }) => {
    const imageUrl = await resolveImage(item as RssLikeItem)
    if (!imageUrl) {
      droppedNoImage++
      return
    }
    const iso = item.isoDate ?? item.pubDate
    if (!iso || !item.link || !item.title) {
      droppedNoImage++
      return
    }
    hydrated.push({
      sourceName: source.name,
      sourceCategory: source.category,
      title: item.title.trim(),
      link: item.link.trim(),
      summary: (item.contentSnippet ?? "").trim(),
      imageUrl,
      publishedAt: new Date(iso),
    })
  })

  // 3. Dedup by URL
  const seen = new Set<string>()
  const unique = hydrated.filter((h) => {
    if (seen.has(h.link)) return false
    seen.add(h.link)
    return true
  })

  if (unique.length === 0) {
    return {
      sourcesFetched: NEWS_SOURCES.length,
      itemsCollected: 0,
      itemsDroppedNoImage: droppedNoImage,
      storiesSynthesized: 0,
      storiesDroppedInvalid: 0,
      storiesPersisted: 0,
      archivedCount: 0,
      durationMs: Date.now() - started,
    }
  }

  // 4. Cluster + synthesize in one Claude call
  const anthropic = getAnthropic()
  const prompt = buildPrompt(unique)
  const response = await anthropic.messages.create({
    model: DEFAULT_MODEL,
    max_tokens: 8000,
    messages: [{ role: "user", content: prompt }],
  })

  const textBlock = response.content.find((c) => c.type === "text")
  const rawText = textBlock && "text" in textBlock ? (textBlock as { text: string }).text : ""
  const jsonMatch = rawText.match(/\{[\s\S]*\}/)
  if (!jsonMatch) throw new Error("Claude did not return JSON")

  let parsed: unknown
  try {
    parsed = JSON.parse(jsonMatch[0])
  } catch {
    throw new Error("Claude returned malformed JSON")
  }
  const rawStories = (parsed as { stories?: unknown[] })?.stories ?? []
  if (!Array.isArray(rawStories)) throw new Error("Claude returned no stories array")

  const allowedImages = new Set(unique.map((u) => u.imageUrl))
  const validStories: SynthesizedStory[] = []
  let droppedInvalid = 0
  for (const raw of rawStories) {
    const story = coerceStory(raw, unique.length)
    if (!story) {
      droppedInvalid++
      continue
    }
    // Anti-hallucination: imageUrl must match one of the source images
    if (!allowedImages.has(story.imageUrl)) {
      droppedInvalid++
      continue
    }
    validStories.push(story)
  }

  // 5. Persist — upsert by slug (with numeric suffix on collision)
  const now = new Date()
  let persisted = 0
  for (const s of validStories) {
    const sources = s.sourceIndexes.map((i) => ({
      name: unique[i].sourceName,
      url: unique[i].link,
      favicon: faviconFor(unique[i].link),
      headline: unique[i].title,
      publishedAt: unique[i].publishedAt.toISOString(),
    }))
    const publishedAt = new Date(
      Math.min(...s.sourceIndexes.map((i) => unique[i].publishedAt.getTime())),
    )

    let slug = s.slug || slugify(s.title) || `story-${now.getTime()}`
    let suffix = 1
    // Collision protection: append -2, -3, ... if another non-matching story already owns the slug
    while (true) {
      const existing = await prisma.newsStory.findUnique({ where: { slug } })
      if (!existing) break
      // If the existing row is from an older fetch (different title), nudge the slug
      if (existing.title !== s.title) {
        suffix++
        slug = `${s.slug}-${suffix}`
        continue
      }
      break
    }

    await prisma.newsStory.upsert({
      where: { slug },
      create: {
        slug,
        title: s.title,
        summary: s.summary,
        body: s.body,
        category: s.category,
        sources,
        imageUrl: s.imageUrl,
        publishedAt,
        relevanceScore: s.relevanceScore,
        status: "PUBLISHED",
      },
      update: {
        title: s.title,
        summary: s.summary,
        body: s.body,
        category: s.category,
        sources,
        imageUrl: s.imageUrl,
        publishedAt,
        relevanceScore: s.relevanceScore,
        status: "PUBLISHED",
      },
    })
    persisted++
  }

  // 6. Archive anything older than 14 days
  const cutoff = new Date(Date.now() - 14 * 24 * 60 * 60 * 1000)
  const archived = await prisma.newsStory.updateMany({
    where: { status: "PUBLISHED", publishedAt: { lt: cutoff } },
    data: { status: "ARCHIVED" },
  })

  return {
    sourcesFetched: NEWS_SOURCES.length,
    itemsCollected: unique.length,
    itemsDroppedNoImage: droppedNoImage,
    storiesSynthesized: rawStories.length,
    storiesDroppedInvalid: droppedInvalid,
    storiesPersisted: persisted,
    archivedCount: archived.count,
    durationMs: Date.now() - started,
  }
}
