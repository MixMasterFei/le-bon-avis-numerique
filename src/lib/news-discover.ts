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

const MAX_ITEMS_PER_SOURCE = 5
const MAX_TOTAL_ITEMS = 60

function makeParser(): RssParser {
  return new Parser({
    timeout: 6000,
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
    const items = (feed.items ?? [])
      .filter((it) => {
        const t = it.isoDate ? new Date(it.isoDate) : it.pubDate ? new Date(it.pubDate) : null
        return t !== null && t > since && !!it.link && !!it.title
      })
      .sort((a, b) => {
        const ta = new Date(a.isoDate ?? a.pubDate ?? 0).getTime()
        const tb = new Date(b.isoDate ?? b.pubDate ?? 0).getTime()
        return tb - ta
      })
      .slice(0, MAX_ITEMS_PER_SOURCE)
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

function buildPrompt(items: HydratedItem[], existingTitles: string[]): string {
  const list = items
    .map((it, idx) => {
      const summary = (it.summary ?? "").slice(0, 400).replace(/\s+/g, " ")
      return `[${idx}] (${it.sourceName} · ${it.sourceCategory}) ${it.title}\n  URL: ${it.link}\n  IMG: ${it.imageUrl}\n  ${summary}`
    })
    .join("\n\n")

  const alreadyPublished =
    existingTitles.length > 0
      ? `\n\n## Histoires DÉJÀ publiées (à ÉCARTER absolument)\n\nCes événements sont déjà couverts ces 72 dernières heures. N'émets AUCUNE histoire les concernant, même si de nouveaux articles les évoquent :\n${existingTitles.map((t) => `- "${t}"`).join("\n")}\n`
      : ""

  return `Tu es l'éditeur de Totem Avisé, un guide pour familles françaises. Ta mission : repérer les ACTUALITÉS qui concernent directement les familles, les enfants, ou la parentalité numérique. Pas les essais, pas les opinions — de vraies nouvelles avec un angle famille clair.

Voici ${items.length} articles publiés ces 48 dernières heures. Chaque article a un index, une source, une catégorie, un titre, une URL, une image, et un résumé.

## Règle de clustering — la plus importante

Deux chemins pour créer une histoire :

**Chemin A (prioritaire) — événement multi-sources** : un événement précis couvert par **au moins 2 publications DIFFÉRENTES** (noms de sources distincts). C'est le signal le plus fort : la convergence de plusieurs rédactions = vraie actualité. Relevance ≥ 0.5 suffit.

**Chemin B — single-source à forte pertinence** : un article isolé d'une seule source, mais avec un **angle famille très fort** (étude sérieuse, annonce institutionnelle, guide parental, recommandation d'âge concrète). Relevance **≥ 0.7 obligatoire** pour ce chemin — sinon écarte.

**Événement précis** = une sortie de film/série/jeu, une annonce officielle, une étude publiée, une décision institutionnelle, une polémique spécifique nommable, une recommandation experte, un guide pratique daté.
**Pas un thème** = "les livres", "les jeux vidéo en avril", "la philosophie", "les adaptations cinéma" — ce sont des catégories, pas des événements.

N'invente JAMAIS de narratif qui relie deux sujets différents (ex : lier un article sur Tolkien et un article sur Saint Augustin en une seule histoire "univers littéraires" — INTERDIT, ce sont deux sujets). Le clustering ne regroupe que des articles couvrant **exactement le même événement**.

## Règle d'angle famille

Chaque histoire doit avoir un **angle famille explicite** : impact sur les enfants, les parents, la vie de famille, les écrans à la maison, l'éducation, l'âge recommandé d'un contenu, la santé des jeunes, etc. Si l'angle famille n'est pas évident, **écarte l'histoire**.

Le corps de l'histoire doit COMMENCER par une phrase qui énonce clairement l'angle famille ("Pour les parents qui…", "Les familles concernées par…", "À retenir pour les enfants de X ans :", etc.).

## À écarter absolument

- Politique pure (élections, gouvernement, sauf impact direct école/famille)
- Sport
- Faits divers sans implication parentale
- Essais/opinions sans événement précis ni angle famille
- Polémiques industrie/culture sans angle enfant ou parent

## Format de sortie

Pour chaque histoire retenue, renvoie un objet JSON avec :
- "title": titre éditorial clair (français, sobre, pas de clickbait)
- "summary": 1-2 phrases (<200 caractères) résumant l'événement et son angle famille
- "body": 120-180 mots en markdown, 1er paragraphe = angle famille explicite, 2e paragraphe = les faits rapportés par les sources. Synthèse neutre. Ne jamais mentionner l'IA ni inventer de faits hors sources.
- "category": PARENTHOOD | FILM_TV | GAMES | READING
- "relevanceScore": 0 à 1, pertinence FAMILIALE (pas d'intérêt général). ≥ 0.5 pour multi-sources, ≥ 0.7 pour single-source
- "imageUrl": URL exacte de l'IMG d'un des articles du cluster (jamais inventer)
- "sourceIndexes": tableau des indexes des articles sources du cluster

## Contraintes dures

- Maximum 10 histoires, triées par pertinence décroissante
- Multi-sources : relevance ≥ 0.5. Single-source : relevance ≥ 0.7 obligatoire
- Chaque imageUrl correspond exactement à l'IMG d'un article cité
- Si tu ne trouves que 0, 1 ou 2 histoires solides, renvoie seulement celles-là
- Français uniquement

Réponds UNIQUEMENT avec du JSON :
{"stories": [ ... ]}
${alreadyPublished}
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
  storiesUpdated: number
  archivedCount: number
  durationMs: number
  timings: {
    fetchRssMs: number
    resolveImagesMs: number
    synthesizeMs: number
    persistMs: number
  }
}

export async function runNewsDiscover(): Promise<DiscoverStats> {
  const started = Date.now()
  const parser = makeParser()
  const since = new Date(Date.now() - 72 * 60 * 60 * 1000)

  // 1. Fetch all feeds in parallel
  const fetchStart = Date.now()
  const fetchBatches = await Promise.all(NEWS_SOURCES.map((s) => fetchOne(parser, s, since)))
  const pairs = fetchBatches.flat()
  const fetchRssMs = Date.now() - fetchStart

  // 2. Resolve image per item (drops anything without one)
  const imageStart = Date.now()
  const hydrated: HydratedItem[] = []
  let droppedNoImage = 0
  await parallelMap(pairs, 6, async ({ source, item }) => {
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

  // 3. Dedup by URL, then cap to MAX_TOTAL_ITEMS by recency (keeps Claude under timeout)
  const seen = new Set<string>()
  const unique = hydrated
    .filter((h) => {
      if (seen.has(h.link)) return false
      seen.add(h.link)
      return true
    })
    .sort((a, b) => b.publishedAt.getTime() - a.publishedAt.getTime())
    .slice(0, MAX_TOTAL_ITEMS)
  const resolveImagesMs = Date.now() - imageStart

  if (unique.length === 0) {
    return {
      sourcesFetched: NEWS_SOURCES.length,
      itemsCollected: 0,
      itemsDroppedNoImage: droppedNoImage,
      storiesSynthesized: 0,
      storiesDroppedInvalid: 0,
      storiesPersisted: 0,
      storiesUpdated: 0,
      archivedCount: 0,
      durationMs: Date.now() - started,
      timings: {
        fetchRssMs,
        resolveImagesMs,
        synthesizeMs: 0,
        persistMs: 0,
      },
    }
  }

  // 4. Load existing PUBLISHED stories from the same 72h window so we
  //    can both (a) tell Claude to skip them and (b) dedup at persist
  //    time by source-URL overlap, even if Claude paraphrases the title.
  const existingStories = await prisma.newsStory.findMany({
    where: { status: "PUBLISHED", publishedAt: { gte: since } },
    select: { id: true, slug: true, title: true, sources: true },
  })

  // Map every previously-published source URL to its existing story id.
  // First-seen wins on collisions (a single URL ideally appears once).
  const urlToExistingId = new Map<string, string>()
  for (const story of existingStories) {
    if (!Array.isArray(story.sources)) continue
    for (const src of story.sources) {
      if (typeof src !== "object" || src === null) continue
      const url = (src as { url?: unknown }).url
      if (typeof url === "string" && !urlToExistingId.has(url)) {
        urlToExistingId.set(url, story.id)
      }
    }
  }

  // 5. Cluster + synthesize in one Claude call
  const synthStart = Date.now()
  const anthropic = getAnthropic()
  const prompt = buildPrompt(
    unique,
    existingStories.map((s) => s.title),
  )
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
    // Two paths accepted:
    //   A) multi-source (>=2 distinct publishers) + relevance >= 0.5
    //   B) single-source + relevance >= 0.7 (strong family angle required)
    // Anything else is dropped — keeps weak single-outlet essays out while
    // still letting standout institutional studies or expert guides through.
    const distinctNames = new Set(story.sourceIndexes.map((i) => unique[i].sourceName))
    const isMultiSource = distinctNames.size >= 2
    const minRelevance = isMultiSource ? 0.5 : 0.7
    if (story.relevanceScore < minRelevance) {
      droppedInvalid++
      continue
    }
    validStories.push(story)
  }
  const synthesizeMs = Date.now() - synthStart

  // 6. Persist — dedup by source-URL overlap before insert, fall back to
  //    slug collision handling otherwise.
  const persistStart = Date.now()
  const now = new Date()
  let persisted = 0
  let updated = 0
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

    // Dedup: if any source URL is already owned by a previously-persisted
    // story (either from earlier runs OR earlier in this same loop),
    // update that row in place instead of creating a duplicate.
    let matchedExistingId: string | null = null
    for (const src of sources) {
      const id = urlToExistingId.get(src.url)
      if (id) {
        matchedExistingId = id
        break
      }
    }

    const data = {
      title: s.title,
      summary: s.summary,
      body: s.body,
      category: s.category,
      sources,
      imageUrl: s.imageUrl,
      publishedAt,
      relevanceScore: s.relevanceScore,
      status: "PUBLISHED" as const,
    }

    if (matchedExistingId) {
      await prisma.newsStory.update({
        where: { id: matchedExistingId },
        data,
      })
      // Refresh URL map with this story's full source set so subsequent
      // stories in the same run also see them.
      for (const src of sources) urlToExistingId.set(src.url, matchedExistingId)
      updated++
      continue
    }

    let slug = s.slug || slugify(s.title) || `story-${now.getTime()}`
    let suffix = 1
    // Slug-collision protection: append -2, -3, ... if another (non-overlapping)
    // story already owns the slug. By construction we know it's not the same
    // event because the URL-overlap check above didn't match.
    while (true) {
      const existing = await prisma.newsStory.findUnique({ where: { slug } })
      if (!existing) break
      suffix++
      slug = `${s.slug}-${suffix}`
    }

    const created = await prisma.newsStory.create({
      data: { slug, ...data },
    })
    for (const src of sources) urlToExistingId.set(src.url, created.id)
    persisted++
  }

  // 6. Archive anything older than 14 days
  const cutoff = new Date(Date.now() - 14 * 24 * 60 * 60 * 1000)
  const archived = await prisma.newsStory.updateMany({
    where: { status: "PUBLISHED", publishedAt: { lt: cutoff } },
    data: { status: "ARCHIVED" },
  })
  const persistMs = Date.now() - persistStart

  return {
    sourcesFetched: NEWS_SOURCES.length,
    itemsCollected: unique.length,
    itemsDroppedNoImage: droppedNoImage,
    storiesSynthesized: rawStories.length,
    storiesDroppedInvalid: droppedInvalid,
    storiesPersisted: persisted,
    storiesUpdated: updated,
    archivedCount: archived.count,
    durationMs: Date.now() - started,
    timings: {
      fetchRssMs,
      resolveImagesMs,
      synthesizeMs,
      persistMs,
    },
  }
}
