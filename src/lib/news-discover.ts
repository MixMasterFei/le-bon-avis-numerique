import Parser from "rss-parser"
import { prisma } from "@/lib/prisma"
import { getAnthropic, DEFAULT_MODEL } from "@/lib/anthropic"
import { getDeepSeek, DEFAULT_DEEPSEEK_MODEL, isDeepSeekAvailable } from "@/lib/deepseek"
import { moderateStory, type Audience } from "@/lib/news-moderate"
import { NEWS_SOURCES, type NewsSource } from "@/lib/news-sources"
import { resolveImage, type RssLikeItem } from "@/lib/news-image"
import { slugify, faviconFor } from "@/lib/news-slug"
import { uploadNewsImage, isStorageEnabled } from "@/lib/supabase-storage"
import type { NewsCategory } from "@prisma/client"

// ── Title-fingerprint dedup ───────────────────────────────────────────
// Catches paraphrased duplicates that the URL-overlap check misses
// (Claude rewriting the same event with different wording on different
// runs). Tokens are 4+ chars, accent-stripped, lowercased; Jaccard
// similarity ≥ 0.5 = same story.

function titleTokens(title: string): Set<string> {
  return new Set(
    title
      .toLowerCase()
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .split(/[^a-z0-9]+/)
      .filter((t) => t.length >= 4),
  )
}

function jaccard(a: Set<string>, b: Set<string>): number {
  if (a.size === 0 || b.size === 0) return 0
  let intersect = 0
  for (const t of a) if (b.has(t)) intersect++
  return intersect / (a.size + b.size - intersect)
}

const TITLE_DEDUP_THRESHOLD = 0.5

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
  // Filled in by the pass-2 moderation step. Defaults to "parent_only"
  // if moderation fails (fail-open) — story still ships, just doesn't
  // get the kid-safe badge.
  audience?: Audience
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

## Choix de l'image — règle famille

L'image accompagne chaque histoire sur la page d'accueil et le site est destiné aux **familles avec enfants**. Tu DOIS choisir une image appropriée :

- **À écarter** : visages déformés, maquillages d'horreur, créatures monstrueuses gros plan, scènes sanglantes, poses violentes, atmosphères d'horreur (clair-obscur menaçant, expressions terrifiées en gros plan), images d'âge clairement 16+/18+.
- **À privilégier** : posters officiels, photos promotionnelles, captures d'écran d'action ou d'ambiance, portraits neutres, photos institutionnelles, illustrations éditoriales.

Si aucune image acceptable n'est disponible parmi les articles du cluster, **écarte l'histoire entièrement** plutôt que d'utiliser une image effrayante. Mieux vaut moins d'histoires qu'une image qui choque un enfant qui passe devant l'écran.

## Format de sortie

Pour chaque histoire retenue, renvoie un objet JSON avec :
- "title": titre éditorial clair (français, sobre, pas de clickbait)
- "summary": 1-2 phrases (<200 caractères) résumant l'événement et son angle famille
- "body": **300-450 mots** en markdown, structuré en 3-4 paragraphes :
  - **Para 1** (~80 mots) : angle famille explicite — qui est concerné, pourquoi maintenant. Hook qui donne envie de lire la suite.
  - **Para 2** (~100-130 mots) : les faits rapportés. Si plusieurs sources sont disponibles, attribue chaque fait à sa source ("Selon Le Monde, ...", "Numerama rapporte que...", "L'étude publiée dans X indique..."). Une voix par paragraphe quand possible.
  - **Para 3** (~80-120 mots) : contexte ou implications pour les familles — ce que ça change concrètement, à quel âge, dans quelles circonstances. C'est ici qu'on aide les parents à décider.
  - **Para 4 optionnel** (~50-80 mots) : "À retenir" ou conseil pratique court (à mettre seulement si pertinent — sinon arrête à 3 paragraphes).

  Synthèse neutre, jamais d'opinion personnelle, jamais "selon moi/nous". N'invente AUCUN fait absent des articles fournis. Pas de mention de l'IA. Cite les sources par leur nom de publication, pas par "source 1" ou "[2]".

- "category": PARENTHOOD | FILM_TV | GAMES | READING
- "relevanceScore": 0 à 1, pertinence FAMILIALE (pas d'intérêt général). ≥ 0.5 pour multi-sources, ≥ 0.7 pour single-source
- "imageUrl": URL exacte de l'IMG d'un des articles du cluster (jamais inventer). Respecter la règle d'image famille ci-dessus.
- "sourceIndexes": tableau des indexes des articles sources du cluster

## Contraintes dures

- Maximum 10 histoires, triées par pertinence décroissante
- **Distribue à travers les 4 catégories** : vise 2-3 histoires par catégorie quand le matériel le permet. Évite de remplir 8 PARENTHOOD et 0 GAMES — la page Découverte affiche un onglet par catégorie et chaque onglet doit avoir du contenu.
- Multi-sources : relevance ≥ 0.5. Single-source : relevance ≥ 0.6 obligatoire
- Chaque imageUrl correspond exactement à l'IMG d'un article cité, ET respecte la règle famille
- **Body de 300 mots minimum** — un body court est un signe que l'histoire n'a pas assez de matière, écarte plutôt que de bâcler
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

  // Body must clear ~200 words. Anything shorter means the model didn't
  // follow the depth spec — better to drop than ship a 2-paragraph
  // article that looks like a Twitter post.
  const wordCount = body.split(/\s+/).filter(Boolean).length
  if (wordCount < 200) return null

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
  storiesDroppedUnsuitable: number  // Pass-2 moderation rejects
  storiesDroppedImageUnreachable: number
  storiesPersisted: number
  storiesUpdated: number
  archivedCount: number
  durationMs: number
  timings: {
    fetchRssMs: number
    resolveImagesMs: number
    synthesizeMs: number
    moderationMs: number
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
      storiesDroppedUnsuitable: 0,
      storiesDroppedImageUnreachable: 0,
      storiesPersisted: 0,
      storiesUpdated: 0,
      archivedCount: 0,
      durationMs: Date.now() - started,
      timings: {
        fetchRssMs,
        resolveImagesMs,
        synthesizeMs: 0,
        moderationMs: 0,
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
  // Parallel: title fingerprints for the second dedup layer (catches
  // paraphrased duplicates that share zero source URLs).
  const titleFingerprints: Array<{ id: string; tokens: Set<string> }> = []
  for (const story of existingStories) {
    titleFingerprints.push({ id: story.id, tokens: titleTokens(story.title) })
    if (!Array.isArray(story.sources)) continue
    for (const src of story.sources) {
      if (typeof src !== "object" || src === null) continue
      const url = (src as { url?: unknown }).url
      if (typeof url === "string" && !urlToExistingId.has(url)) {
        urlToExistingId.set(url, story.id)
      }
    }
  }

  // 5. Cluster + synthesize in one model call.
  //
  // Provider selection:
  //   - DeepSeek when DEEPSEEK_API_KEY is set (default — much cheaper
  //     for high-volume cron jobs). V4-Flash returns plenty for
  //     news clustering/summarization.
  //   - Anthropic Claude Haiku as fallback when DeepSeek isn't
  //     configured, or when NEWS_PROVIDER=anthropic is set explicitly.
  // Set NEWS_PROVIDER=anthropic to force Claude even with both keys.
  const synthStart = Date.now()
  const provider =
    process.env.NEWS_PROVIDER === "anthropic"
      ? "anthropic"
      : isDeepSeekAvailable()
        ? "deepseek"
        : "anthropic"
  const prompt = buildPrompt(
    unique,
    existingStories.map((s) => s.title),
  )

  // Bumped from 8000 → 14000 because body length spec went from 120-180
  // words to 300-450 words across up to 10 stories. Each story can now
  // run ~600 tokens of body text alone.
  const MAX_TOKENS = 14000
  let rawText = ""
  if (provider === "deepseek") {
    const ds = getDeepSeek()
    const response = await ds.chat.completions.create({
      model: DEFAULT_DEEPSEEK_MODEL,
      max_tokens: MAX_TOKENS,
      messages: [{ role: "user", content: prompt }],
    })
    rawText = response.choices[0]?.message?.content ?? ""
  } else {
    const anthropic = getAnthropic()
    const response = await anthropic.messages.create({
      model: DEFAULT_MODEL,
      max_tokens: MAX_TOKENS,
      messages: [{ role: "user", content: prompt }],
    })
    const textBlock = response.content.find((c) => c.type === "text")
    rawText = textBlock && "text" in textBlock ? (textBlock as { text: string }).text : ""
  }

  const jsonMatch = rawText.match(/\{[\s\S]*\}/)
  if (!jsonMatch) throw new Error(`${provider} did not return JSON`)

  let parsed: unknown
  try {
    parsed = JSON.parse(jsonMatch[0])
  } catch {
    throw new Error(`${provider} returned malformed JSON`)
  }
  const rawStories = (parsed as { stories?: unknown[] })?.stories ?? []
  if (!Array.isArray(rawStories)) throw new Error(`${provider} returned no stories array`)

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
    const minRelevance = isMultiSource ? 0.5 : 0.6
    if (story.relevanceScore < minRelevance) {
      droppedInvalid++
      continue
    }
    validStories.push(story)
  }

  // 5b. Pass-2 family-safety moderation (independent LLM call per story).
  //     Catches unsuitable subjects the synthesis prompt let through —
  //     horror movie releases, true-crime sensationalism, weird/disturbing
  //     content. Each story gets an `audience` tag (kid_safe | parent_only
  //     | unsuitable). Unsuitable rows are dropped before persistence.
  //     Fail-open: moderator errors → audience = "parent_only" (still ships).
  let droppedUnsuitable = 0
  const moderationStart = Date.now()
  await parallelMap(validStories, 4, async (s) => {
    const verdict = await moderateStory({
      title: s.title,
      summary: s.summary,
      body: s.body,
      category: s.category,
      // Pass the original (un-mirrored) image URL so the vision model
      // can fetch it directly. Mirroring happens after this step, so
      // we only have the source URL at this point.
      imageUrl: s.imageUrl,
    })
    s.audience = verdict.audience
  })
  const moderatedStories = validStories.filter((s) => {
    if (s.audience === "unsuitable") {
      droppedUnsuitable++
      return false
    }
    return true
  })
  const moderationMs = Date.now() - moderationStart

  // 6. Mirror every chosen image into Supabase Storage. Many news
  //    sites (Sortiraparis, Le Monde, etc.) block hotlinking via
  //    Referer headers — the image returns 200 to a server-side HEAD
  //    but 403 to the actual browser GET. By downloading and re-
  //    serving from our own storage, we sidestep that entirely. As a
  //    bonus: stories survive even if the source CDN goes down.
  //    If the upload fails (origin returns <1KB blob, network error,
  //    Supabase disabled in dev), we drop the story.
  const mirrored = await Promise.all(
    moderatedStories.map((s) =>
      isStorageEnabled() ? uploadNewsImage(s.imageUrl) : Promise.resolve(s.imageUrl),
    ),
  )
  let droppedImageUnreachable = 0
  const liveStories: SynthesizedStory[] = []
  moderatedStories.forEach((s, i) => {
    const mirroredUrl = mirrored[i]
    if (mirroredUrl) {
      liveStories.push({ ...s, imageUrl: mirroredUrl })
    } else {
      droppedImageUnreachable++
    }
  })

  const synthesizeMs = Date.now() - synthStart

  // 7. Persist with three dedup layers + source-name dedup.
  const persistStart = Date.now()
  const now = new Date()
  let persisted = 0
  let updated = 0
  for (const s of liveStories) {
    // Build the sources array, then collapse multiple entries from the
    // same publisher down to one (first-seen) — keeps the UI's source
    // pill row from showing "Sortiraparis · Sortiraparis · Sortiraparis…".
    const seenNames = new Set<string>()
    const sources = s.sourceIndexes
      .map((i) => ({
        name: unique[i].sourceName,
        url: unique[i].link,
        favicon: faviconFor(unique[i].link),
        headline: unique[i].title,
        publishedAt: unique[i].publishedAt.toISOString(),
      }))
      .filter((src) => {
        if (seenNames.has(src.name)) return false
        seenNames.add(src.name)
        return true
      })
    const publishedAt = new Date(
      Math.min(...s.sourceIndexes.map((i) => unique[i].publishedAt.getTime())),
    )

    // Dedup layer A: any source URL already owned by an existing story?
    let matchedExistingId: string | null = null
    for (const src of sources) {
      const id = urlToExistingId.get(src.url)
      if (id) {
        matchedExistingId = id
        break
      }
    }

    // Dedup layer B: title fingerprint Jaccard ≥ TITLE_DEDUP_THRESHOLD.
    // Catches paraphrased duplicates that share no source URLs (e.g.
    // "Miffy et Pokémon pour occuper les vacances" vs
    // "Miffy et Pokémon parfaits pour les vacances").
    if (!matchedExistingId) {
      const newTokens = titleTokens(s.title)
      for (const fp of titleFingerprints) {
        if (jaccard(newTokens, fp.tokens) >= TITLE_DEDUP_THRESHOLD) {
          matchedExistingId = fp.id
          break
        }
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
      for (const src of sources) urlToExistingId.set(src.url, matchedExistingId)
      // Refresh fingerprint so within-run subsequent stories see it too.
      const existingFp = titleFingerprints.find((fp) => fp.id === matchedExistingId)
      if (existingFp) existingFp.tokens = titleTokens(s.title)
      updated++
      continue
    }

    let slug = s.slug || slugify(s.title) || `story-${now.getTime()}`
    let suffix = 1
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
    titleFingerprints.push({ id: created.id, tokens: titleTokens(s.title) })
    persisted++
  }

  // 6. Archive anything older than 180 days. Synthesised stories are
  //    valuable on their own so we keep them browseable for ~6 months
  //    via /apercudecouverte/actualites pagination, then quietly age
  //    them out of the active feed.
  const cutoff = new Date(Date.now() - 180 * 24 * 60 * 60 * 1000)
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
    storiesDroppedUnsuitable: droppedUnsuitable,
    storiesDroppedImageUnreachable: droppedImageUnreachable,
    storiesPersisted: persisted,
    storiesUpdated: updated,
    archivedCount: archived.count,
    durationMs: Date.now() - started,
    timings: {
      fetchRssMs,
      resolveImagesMs,
      synthesizeMs,
      moderationMs,
      persistMs,
    },
  }
}
