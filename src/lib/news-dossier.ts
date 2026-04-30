import { prisma } from "@/lib/prisma"
import { getDeepSeek, DEFAULT_DEEPSEEK_MODEL, isDeepSeekAvailable } from "@/lib/deepseek"
import { getAnthropic, DEFAULT_MODEL as DEFAULT_ANTHROPIC_MODEL } from "@/lib/anthropic"
import { slugify } from "@/lib/news-slug"
import { uploadNewsImage, isStorageEnabled } from "@/lib/supabase-storage"
import { moderateStory } from "@/lib/news-moderate"
import { judgeStory } from "@/lib/news-quality-judge"
import { loadCatalogIndex, extractCatalogMatches } from "@/lib/news-linkify"
import type { NewsCategory, Prisma } from "@prisma/client"

/**
 * Twice-weekly long-read agent ("Dossier de la semaine").
 *
 * Tuesday + Friday at 05:00 UTC, looks at the past 7 days of
 * PUBLISHED BRIEF stories, picks the topic with the most multi-
 * source coverage, and synthesizes a 1000-1500 word dossier that
 * crosses the angles of multiple publications — the format only
 * makes sense when ≥ 5 distinct publishers cover the theme; if not,
 * the agent skips. The Tue/Fri cadence (3-4 day intervals) was
 * Xavier's call (April 2026): weekly felt thin, daily would be
 * mechanical.
 *
 * Persists as a NewsStory with story_type = "DOSSIER" so the UI can
 * surface it with featured treatment at the top of /actualites.
 *
 * Cost: ~one larger LLM call per dossier (~$0.50-1.00 on DeepSeek
 * for 1500-word output) — twice a week ~ $4-8/month.
 */

const DOSSIER_LOOKBACK_DAYS = 7
// Bumped from 4 → 6 with the Tue/Fri cadence: more agent runs per
// week means we should be choosier about which weeks warrant a
// dossier. 6 cited briefs ≈ a real cluster, not a stretch.
const MIN_BRIEFS_FOR_DOSSIER = 6
// Bumped from 25 → 35 to give the synthesis agent more material to
// pick from when looking for multi-source convergence. The agent
// still selects only the briefs it actually cites; a wider input
// pool just improves the chance of finding 5+ distinct publishers
// on a single theme.
const MAX_BRIEFS_TO_INCLUDE = 35

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

const DOSSIER_PROMPT_HEADER = `Tu es journaliste pour Totem Avisé, un guide pour familles françaises. Deux fois par semaine (mardi et vendredi), tu rédiges un DOSSIER : une mise en perspective approfondie de l'actualité famille des derniers jours, **fondée sur ce que les sources rapportent** — jamais sur ton opinion. C'est un long-read multi-sources, pas un brief allongé : il pèse plus lourd qu'une brève précisément parce qu'il croise les angles.

Voici les actualités publiées ces 7 derniers jours, déjà filtrées et catégorisées. Ton travail :

1. **Identifie LE thème dominant** : le sujet où il y a le plus de matière (plusieurs articles convergents, plusieurs angles complémentaires, une tendance qui émerge). Pas un sujet qui apparaît dans un seul article — un sujet qui revient. **Idéalement il rassemble des briefs de 5 publications différentes ou plus** ; c'est ce qui en fait un dossier plutôt qu'un brief allongé.

2. **Choisis la catégorie** la plus pertinente pour ce thème : PARENTHOOD | FILM_TV | GAMES | READING.

3. **Voix éditoriale — RELAYER, pas commenter** (règle critique) :

   **INTERDIT** :
   - Titres avec qualificatif ou prise de position ("la semaine où la France a dit assez", "un signal alarmant", "un tournant", "enfin une réaction", "des promesses encore floues")
   - Questions rhétoriques ("Pour combien de temps ?", "Mais à quel prix ?")
   - Conclusions Totem ("on ne peut que saluer", "il est temps que…", "voilà qui change la donne")
   - Vocabulaire éditorial : *enfin, malheureusement, fort heureusement, étonnamment, sans surprise, à juste titre, courageux, lucide, alarmant, inquiétant, prometteur*
   - Formules qui prennent position implicite ("comme l'avait prédit", "rare lucidité de…", "preuve supplémentaire que…")
   - **Numéros d'articles** : ne mentionne JAMAIS "(article 3)", "[2]", "article numéro 5", etc. Les crochets que tu vois dans la liste ci-dessous sont à usage interne uniquement. Réfère-toi aux publications **par leur nom uniquement** ("Selon Le Monde", "Numerama rapporte", "AlloCiné précise"), jamais par leur position dans la liste.

   **EXIGÉ** :
   - Titre purement descriptif : "Cette semaine : trois initiatives sur l'âge minimum du smartphone" plutôt que "La semaine où la France a dit assez"
   - **Chaque affirmation forte est attribuée nommément** : "Selon Le Monde, …", "Pew Research observe que…", "L'étude de l'INSERM publiée mardi rapporte que…"
   - **Au moins un paragraphe doit explicitement croiser deux publications ou plus** : "Là où Le Monde insiste sur X, Numerama souligne Y", "Si la Croix met en avant le volet santé, Le Monde s'attache plutôt au volet législatif". Cette comparaison nominative est ce qui distingue un vrai dossier d'une longue brève — n'élude pas cette section.
   - **Inclus au moins 2 citations directes** au format français « … » lorsque les briefs sources les fournissent. Format : « Cette mesure s'appliquera dès la rentrée 2026 », a déclaré la ministre Élisabeth Borne (Le Monde, 23 avril). N'invente JAMAIS une citation : si la formule littérale ne figure pas dans le résumé d'un brief, paraphrase en attribution indirecte ("Selon X, …").
   - Si tu veux relayer une position forte, mets-la entre guillemets « » et attribue-la à la personne nommée puis à la source.
   - Le dossier peut soulever des questions, mais en les attribuant : "Plusieurs experts cités par Le Monde s'interrogent sur…"

4. **Écris le dossier** en 5-6 paragraphes, **1000 à 1500 mots**. Tu peux insérer des sous-titres H3 ("### Titre court") au-dessus de paragraphes-pivot pour aérer la lecture (par exemple au-dessus du paragraphe de croisement multi-sources et du paragraphe d'implications famille). Ce n'est pas obligatoire mais ça donne du rythme à un long-read.

   - **Para 1** (~150-200 mots) : présentation factuelle du thème — quels événements, quelles publications, quelle convergence. Une phrase d'attaque qui pose les noms et les dates ; une phrase qui dit pourquoi ça remonte cette semaine. Pas d'éditorial.
   - **Para 2** (~250 mots) : les éléments factuels les plus solides, chaque fait attribué nommément ("Selon Le Monde, …" / "Numerama rapporte que…"). Si une citation directe figure dans une source, c'est ici qu'elle a sa place naturelle.
   - **Para 3** (~250-300 mots) : **paragraphe de croisement** — où les publications divergent, se complètent, ou se contredisent. C'est le cœur du dossier : "Le Monde met l'accent sur X. Numerama, en revanche, insiste sur Y. La Croix éclaire le volet Z, peu traité ailleurs." Au moins deux publications nominales doivent dialoguer ici.
   - **Para 4** (~200 mots) : implications famille relayées depuis les sources — "Selon les chercheurs cités…", "Le rapport souligne pour les familles…". Une 2ᵉ citation directe peut intervenir ici si une source en fournit une (témoignage parent, déclaration officielle, conclusion d'étude).
   - **Para 5** (~150-200 mots) : "Ce qui reste à observer" — questions ouvertes que les sources elles-mêmes posent (pas Totem). Échéances annoncées, prochaines étapes attendues, débats encore en cours.
   - **Para 6 optionnel** (~100-150 mots) : un détail pratique solidement attribué (date, recommandation officielle, ressource à consulter).

5. **Choisis l'image** : prends l'imageUrl d'un des briefs cités (jamais inventer). Privilégie une image neutre et grand public ; **évite les images d'horreur, de gore, ou de visages déformés**, même si le thème les contient. Préfère les images d'ensemble lumineuses.

6. **Cite seulement les briefs réellement utilisés**. Renvoie leurs ids dans \`briefIds\`. **Vise au moins 5 publications distinctes** parmi les briefs cités — c'est ce qui justifie le format dossier. Si tu ne peux assembler que 2-3 publications sur le thème, soit le sujet n'est pas mûr (renvoie \`{ "skip": true, "reason": "..." }\`), soit il vaut mieux écrire un brief que de gonfler un dossier sur trop peu de matière.

7. **Échappement JSON — CRITIQUE** : à l'intérieur des champs string, n'utilise **JAMAIS** de double-quote ASCII " — utilise UNIQUEMENT les guillemets français « » pour les citations directes, et l'apostrophe typographique '. Une " non-échappée à l'intérieur du body casse le parseur JSON et le dossier est perdu.

Format de sortie (JSON sans markdown) :
{
  "topic": "phrase courte décrivant le thème (descriptive, pas éditoriale)",
  "category": "PARENTHOOD" | "FILM_TV" | "GAMES" | "READING",
  "title": "titre factuel et descriptif du dossier",
  "summary": "1-2 phrases (<200 caractères) — descriptives, pas évaluatives",
  "body": "le dossier complet en markdown, 1000-1500 mots, avec une ligne vide entre chaque paragraphe ; sous-titres ### autorisés et bienvenus pour les longs dossiers",
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
  // the past 48 hours. Sized for the Tue/Fri cadence — the two
  // scheduled runs are 72h+ apart so both fire normally, but a same-
  // day re-trigger (workflow rerun, manual refresh) hits the guard
  // and stays a no-op.
  // Bypass with opts.force = true (e.g. after archiving stale dossiers).
  if (!opts.force) {
    const recentDossier = await prisma.newsStory.findFirst({
      where: {
        status: "PUBLISHED",
        storyType: "DOSSIER",
        publishedAt: { gte: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000) },
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

  // Build the sources list from cited briefs' sources. Dedup by
  // NAME (not URL): if 3 different La Croix Enfants & ados articles
  // get cited across the dossier's briefs, we want ONE La Croix pill,
  // not three. The first URL we see for a given publisher wins (links
  // to the first cited article from that source).
  const seenNames = new Set<string>()
  const sources: Array<{ name: string; url: string; favicon?: string; headline?: string; country?: string }> = []
  for (const b of citedBriefs) {
    if (!Array.isArray(b.sources)) continue
    for (const raw of b.sources) {
      if (typeof raw !== "object" || raw === null) continue
      const src = raw as Record<string, unknown>
      const url = typeof src.url === "string" ? src.url : ""
      const name = typeof src.name === "string" ? src.name : ""
      if (!url || !name || seenNames.has(name)) continue
      seenNames.add(name)
      sources.push({
        name,
        url,
        favicon: typeof src.favicon === "string" ? src.favicon : undefined,
        headline: typeof src.headline === "string" ? src.headline : undefined,
        // Carry the country tag from the upstream brief into the
        // dossier's flat source list — drives the flag emoji in the
        // Vu d'ailleurs source pills.
        country: typeof src.country === "string" ? src.country : undefined,
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

  // Pass-3 quality gate. Source-fidelity / neutrality / structural
  // cleanliness / length-fit. Below threshold → PENDING_REVIEW so a
  // human can decide rather than dropping the work entirely. Fails
  // open if the judge LLM is unavailable.
  const qualityVerdict = await judgeStory({
    title: parsed.title,
    summary: parsed.summary,
    body: parsed.body,
    category: parsed.category,
    format: "DOSSIER",
    sourceNames: sources.map((s) => s.name),
  })
  const finalStatus = qualityVerdict.passes ? "PUBLISHED" : "PENDING_REVIEW"

  // Find catalog matches in the body. Body stays unchanged — related
  // items render as mini-cards at the bottom of the story page.
  let matchedIds: string[] = []
  try {
    const catalogIndex = await loadCatalogIndex()
    matchedIds = extractCatalogMatches(parsed.body, catalogIndex, 3)
  } catch (err) {
    console.warn("[news-dossier] catalog match failed:", err)
  }
  const primaryMediaId = matchedIds[0] ?? null

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
      status: finalStatus,
      region,
      storyType: "DOSSIER",
      audience: verdict.audience,
      relatedMediaId: primaryMediaId,
      relatedMediaIds: matchedIds,
    },
  })

  if (!qualityVerdict.passes) {
    console.warn(
      `[news-dossier] dossier ${created.id} flagged PENDING_REVIEW — ` +
        `overall=${qualityVerdict.overall} reason="${qualityVerdict.reason}"`,
    )
  }

  return {
    briefsConsidered: briefs.length,
    result: "persisted",
    reason: `topic: ${parsed.topic}`,
    dossierId: created.id,
    durationMs: Date.now() - started,
  }
}
