import { prisma } from "@/lib/prisma"
import { getDeepSeek, DEFAULT_DEEPSEEK_MODEL, isDeepSeekAvailable } from "@/lib/deepseek"
import { getAnthropic, DEFAULT_MODEL as DEFAULT_ANTHROPIC_MODEL } from "@/lib/anthropic"
import { slugify } from "@/lib/news-slug"
import { uploadNewsImage, isStorageEnabled } from "@/lib/supabase-storage"
import { moderateStory } from "@/lib/news-moderate"
import type { NewsCategory, Prisma } from "@prisma/client"

/**
 * Weekly long-read agent ("Dossier de la semaine").
 *
 * Once a week (Sunday), looks at the past 7 days of PUBLISHED BRIEF
 * stories, picks the topic with the most multi-source coverage, and
 * synthesizes an 800-1200 word dossier that gives a fuller view of
 * the week than any single brief could.
 *
 * Persists as a NewsStory with story_type = "DOSSIER" so the UI can
 * surface it with featured treatment at the top of /actualites.
 *
 * Cost: ~one larger LLM call per week (~$0.50 on DeepSeek).
 */

const DOSSIER_LOOKBACK_DAYS = 7
const MIN_BRIEFS_FOR_DOSSIER = 4
const MAX_BRIEFS_TO_INCLUDE = 25

interface BriefForDossier {
  id: string
  title: string
  summary: string
  body: string
  category: NewsCategory
  imageUrl: string
  publishedAt: Date
  region: string
  sources: Prisma.JsonValue
}

interface DossierResult {
  topic: string                  // The clustering theme the agent identified
  category: NewsCategory
  title: string
  summary: string
  body: string
  imageUrl: string
  briefIds: string[]              // Source briefs cited
}

const DOSSIER_PROMPT_HEADER = `Tu es journaliste pour Totem Avisé, un guide pour familles françaises. Une fois par semaine, tu rédiges un DOSSIER : une mise en perspective de l'actualité de la semaine, **fondée sur ce que les sources rapportent** — jamais sur ton opinion.

Voici les actualités publiées ces 7 derniers jours, déjà filtrées et catégorisées. Ton travail :

1. **Identifie LE thème de la semaine** : le sujet où il y a le plus de matière (plusieurs articles convergents, plusieurs angles complémentaires, une tendance qui émerge). Pas un sujet qui apparaît dans un seul article — un sujet qui revient.

2. **Choisis la catégorie** la plus pertinente pour ce thème : PARENTHOOD | FILM_TV | GAMES | READING.

3. **Voix éditoriale — RELAYER, pas commenter** (règle critique) :

   **INTERDIT** :
   - Titres avec qualificatif ou prise de position ("la semaine où la France a dit assez", "un signal alarmant", "un tournant", "enfin une réaction", "des promesses encore floues")
   - Questions rhétoriques ("Pour combien de temps ?", "Mais à quel prix ?")
   - Conclusions Totem ("on ne peut que saluer", "il est temps que…", "voilà qui change la donne")
   - Vocabulaire éditorial : *enfin, malheureusement, fort heureusement, étonnamment, sans surprise, à juste titre, courageux, lucide, alarmant, inquiétant, prometteur*
   - Formules qui prennent position implicite ("comme l'avait prédit", "rare lucidité de…", "preuve supplémentaire que…")

   **EXIGÉ** :
   - Titre purement descriptif : "Cette semaine : trois initiatives sur l'âge minimum du smartphone" plutôt que "La semaine où la France a dit assez"
   - **Chaque affirmation forte est attribuée nommément** : "Selon Le Monde, …", "Pew Research observe que…", "L'étude de l'INSERM publiée mardi rapporte que…"
   - Tu peux comparer les sources entre elles ("Là où Le Monde insiste sur X, Numerama souligne Y") — c'est du journalisme, pas de l'opinion
   - Si tu veux relayer une position forte, mets-la entre guillemets et attribue-la à la source citée
   - Le dossier peut soulever des questions, mais en les attribuant : "Plusieurs experts cités par Le Monde s'interrogent sur…"

4. **Écris le dossier** en 4-5 paragraphes, **800 à 1200 mots** :
   - **Para 1** (~100 mots) : présentation factuelle du thème — quels événements / quels articles / quelle convergence. Pas d'éditorial.
   - **Para 2-3** (~250-350 mots chacun) : les éléments clés, **chaque fait attribué à sa source par son nom**. Compare les angles ("Le Monde insiste sur X, tandis que Numerama observe Y"). Mets les chiffres entre guillemets explicitement avec leur source.
   - **Para 4** (~150-200 mots) : ce que les sources disent des **implications pour les familles**. Pas "voilà ce que ça change" (Totem) mais "Selon les chercheurs cités…", "Le rapport souligne que les familles concernées…".
   - **Para 5 optionnel** (~100 mots) : "Ce qui reste à observer" — questions ouvertes que les sources elles-mêmes posent (pas Totem).

5. **Choisis l'image** : prends l'imageUrl d'un des briefs cités (jamais inventer). Privilégie une image neutre et grand public ; **évite les images d'horreur, de gore, ou de visages déformés**, même si le thème les contient (un dossier sur l'écran évite les photos d'enfants en gros plan dans le noir, par exemple). Préfère les images d'ensemble lumineuses.

6. **Cite seulement les briefs réellement utilisés**. Renvoie leurs ids dans \`briefIds\`. Si tu cites moins de 3 briefs distincts, c'est que le thème n'est pas assez mûr — renvoie \`{ "skip": true, "reason": "..." }\`.

Format de sortie (JSON sans markdown) :
{
  "topic": "phrase courte décrivant le thème (descriptive, pas éditoriale)",
  "category": "PARENTHOOD" | "FILM_TV" | "GAMES" | "READING",
  "title": "titre factuel et descriptif du dossier",
  "summary": "1-2 phrases (<200 caractères) — descriptives, pas évaluatives",
  "body": "le dossier complet en markdown, 800-1200 mots, **avec une ligne vide entre chaque paragraphe**",
  "imageUrl": "URL exacte d'un brief cité",
  "briefIds": ["id1", "id2", ...]
}

Ou si aucun thème n'est mûr :
{ "skip": true, "reason": "phrase courte expliquant pourquoi" }`

function buildDossierPrompt(briefs: BriefForDossier[]): string {
  const list = briefs
    .map(
      (b, idx) =>
        `[${idx}] (id: ${b.id}, ${b.category}, ${b.region}, ${b.publishedAt.toISOString().split("T")[0]})\n  Titre : ${b.title}\n  Résumé : ${b.summary}\n  Image : ${b.imageUrl}`,
    )
    .join("\n\n")
  return `${DOSSIER_PROMPT_HEADER}\n\nBriefs de la semaine :\n\n${list}`
}

async function callDossierAgent(prompt: string): Promise<string> {
  // Larger output budget than briefs (8K tokens for the long body).
  const MAX_TOKENS = 8000
  if (isDeepSeekAvailable()) {
    const ds = getDeepSeek()
    const r = await ds.chat.completions.create({
      model: DEFAULT_DEEPSEEK_MODEL,
      max_tokens: MAX_TOKENS,
      messages: [{ role: "user", content: prompt }],
    })
    return r.choices[0]?.message?.content ?? ""
  }
  const anthropic = getAnthropic()
  const r = await anthropic.messages.create({
    model: DEFAULT_ANTHROPIC_MODEL,
    max_tokens: MAX_TOKENS,
    messages: [{ role: "user", content: prompt }],
  })
  const block = r.content.find((c) => c.type === "text")
  return block && "text" in block ? (block as { text: string }).text : ""
}

function parseDossierResponse(raw: string): DossierResult | { skip: true; reason: string } | null {
  const m = raw.match(/\{[\s\S]*\}/)
  if (!m) return null
  try {
    const parsed = JSON.parse(m[0]) as Record<string, unknown>
    if (parsed.skip === true) {
      return { skip: true, reason: String(parsed.reason ?? "no reason given") }
    }
    const briefIds = Array.isArray(parsed.briefIds) ? parsed.briefIds.filter((x): x is string => typeof x === "string") : []
    if (
      typeof parsed.topic !== "string" ||
      typeof parsed.category !== "string" ||
      typeof parsed.title !== "string" ||
      typeof parsed.summary !== "string" ||
      typeof parsed.body !== "string" ||
      typeof parsed.imageUrl !== "string" ||
      briefIds.length < 3
    ) {
      return null
    }
    if (!["PARENTHOOD", "FILM_TV", "GAMES", "READING"].includes(parsed.category)) return null
    return {
      topic: parsed.topic,
      category: parsed.category as NewsCategory,
      title: parsed.title.trim(),
      summary: parsed.summary.trim(),
      body: parsed.body.trim(),
      imageUrl: parsed.imageUrl.trim(),
      briefIds,
    }
  } catch {
    return null
  }
}

export interface DossierStats {
  briefsConsidered: number
  result: "skipped" | "persisted" | "error" | "no-material"
  reason?: string
  dossierId?: string
  durationMs: number
}

export async function runWeeklyDossier(opts: { force?: boolean } = {}): Promise<DossierStats> {
  const started = Date.now()
  const since = new Date(Date.now() - DOSSIER_LOOKBACK_DAYS * 24 * 60 * 60 * 1000)

  // Idempotency guard: skip if a dossier has already been written in
  // the past 6 days. Prevents runaway from a manually-triggered cron
  // (or a Sunday + Monday double-fire) producing near-duplicate
  // dossiers on the same theme. The Sunday cron is meant to be the
  // only producer; this just enforces it server-side.
  // Bypass with opts.force = true (e.g. after archiving stale dossiers).
  if (!opts.force) {
    const recentDossier = await prisma.newsStory.findFirst({
      where: {
        status: "PUBLISHED",
        storyType: "DOSSIER",
        publishedAt: { gte: new Date(Date.now() - 6 * 24 * 60 * 60 * 1000) },
      },
      select: { id: true, publishedAt: true, title: true },
    })
    if (recentDossier) {
      return {
        briefsConsidered: 0,
        result: "skipped",
        reason: `recent dossier exists (${recentDossier.publishedAt.toISOString().split("T")[0]}: "${recentDossier.title.slice(0, 60)}")`,
        durationMs: Date.now() - started,
      }
    }
  }

  const briefs = (await prisma.newsStory.findMany({
    where: {
      status: "PUBLISHED",
      storyType: "BRIEF",
      publishedAt: { gte: since },
    },
    orderBy: { publishedAt: "desc" },
    take: MAX_BRIEFS_TO_INCLUDE,
    select: {
      id: true,
      title: true,
      summary: true,
      body: true,
      category: true,
      imageUrl: true,
      publishedAt: true,
      region: true,
      sources: true,
    },
  })) as BriefForDossier[]

  if (briefs.length < MIN_BRIEFS_FOR_DOSSIER) {
    return {
      briefsConsidered: briefs.length,
      result: "no-material",
      reason: `only ${briefs.length} briefs in window (min ${MIN_BRIEFS_FOR_DOSSIER})`,
      durationMs: Date.now() - started,
    }
  }

  const prompt = buildDossierPrompt(briefs)
  let raw: string
  try {
    raw = await callDossierAgent(prompt)
  } catch (e) {
    return {
      briefsConsidered: briefs.length,
      result: "error",
      reason: e instanceof Error ? e.message : "agent call failed",
      durationMs: Date.now() - started,
    }
  }

  const parsed = parseDossierResponse(raw)
  if (!parsed) {
    return {
      briefsConsidered: briefs.length,
      result: "error",
      reason: "agent response unparseable",
      durationMs: Date.now() - started,
    }
  }
  if ("skip" in parsed) {
    return {
      briefsConsidered: briefs.length,
      result: "skipped",
      reason: parsed.reason,
      durationMs: Date.now() - started,
    }
  }

  // Verify imageUrl actually came from a cited brief (anti-hallucination).
  const briefById = new Map(briefs.map((b) => [b.id, b]))
  const citedBriefs = parsed.briefIds.map((id) => briefById.get(id)).filter((b): b is BriefForDossier => !!b)
  const allowedImages = new Set(citedBriefs.map((b) => b.imageUrl))
  if (!allowedImages.has(parsed.imageUrl)) {
    return {
      briefsConsidered: briefs.length,
      result: "error",
      reason: "agent picked an image not in the cited briefs",
      durationMs: Date.now() - started,
    }
  }

  // Pass-2 moderation (same as briefs). Skip if unsuitable.
  const verdict = await moderateStory({
    title: parsed.title,
    summary: parsed.summary,
    body: parsed.body,
    category: parsed.category,
    imageUrl: parsed.imageUrl,
  })
  if (verdict.audience === "unsuitable") {
    return {
      briefsConsidered: briefs.length,
      result: "skipped",
      reason: `moderator: ${verdict.reason}`,
      durationMs: Date.now() - started,
    }
  }

  // Mirror image into Supabase (same pipeline as briefs).
  const mirroredUrl = isStorageEnabled() ? await uploadNewsImage(parsed.imageUrl) : parsed.imageUrl
  if (!mirroredUrl) {
    return {
      briefsConsidered: briefs.length,
      result: "error",
      reason: "image mirror failed",
      durationMs: Date.now() - started,
    }
  }

  // Build the sources list from cited briefs' sources (flatten + dedupe).
  const seenUrls = new Set<string>()
  const sources: Array<{ name: string; url: string; favicon?: string; headline?: string }> = []
  for (const b of citedBriefs) {
    if (!Array.isArray(b.sources)) continue
    for (const raw of b.sources) {
      if (typeof raw !== "object" || raw === null) continue
      const src = raw as Record<string, unknown>
      const url = typeof src.url === "string" ? src.url : ""
      const name = typeof src.name === "string" ? src.name : ""
      if (!url || !name || seenUrls.has(url)) continue
      seenUrls.add(url)
      sources.push({
        name,
        url,
        favicon: typeof src.favicon === "string" ? src.favicon : undefined,
        headline: typeof src.headline === "string" ? src.headline : undefined,
      })
    }
  }

  // Region: INTL only if every cited brief is INTL.
  const region = citedBriefs.every((b) => b.region === "INTL") ? "INTL" : "FR"

  // Slug uniqueness — append numeric suffix if needed.
  let slug = slugify(parsed.title) || `dossier-${Date.now()}`
  let suffix = 1
  while (await prisma.newsStory.findUnique({ where: { slug } })) {
    suffix++
    slug = `${slugify(parsed.title)}-${suffix}`
  }

  const created = await prisma.newsStory.create({
    data: {
      slug,
      title: parsed.title,
      summary: parsed.summary,
      body: parsed.body,
      category: parsed.category,
      sources: sources as unknown as Prisma.InputJsonValue,
      imageUrl: mirroredUrl,
      publishedAt: new Date(),
      relevanceScore: 1, // dossiers always pinned
      status: "PUBLISHED",
      region,
      storyType: "DOSSIER",
      audience: verdict.audience,
    },
  })

  return {
    briefsConsidered: briefs.length,
    result: "persisted",
    reason: `topic: ${parsed.topic}`,
    dossierId: created.id,
    durationMs: Date.now() - started,
  }
}
