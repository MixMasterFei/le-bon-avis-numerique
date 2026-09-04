// "Write-side" SEO agent. The striking-distance analysis (seo-striking-distance.ts)
// only *reports* on-page nudges; this module actually performs the safe ones and
// records exactly what it did so the weekly email becomes a closed loop instead of
// a to-do list.
//
// Three levers, all grounded in how /media/[id] pages actually render:
//   A. Maillage interne — there is no in-body internal-link system; the only
//      structured internal link on a fiche is the "Dans le même genre" rail, which
//      reads MediaSimilarity edges (symmetric: an edge (X, T) surfaces T on X's page).
//      We create high-score source:"EXPERT" edges toward the target: filling thin
//      pages up to LINK_TARGET, and guaranteeing MIN_EXPERT_LINKS top-of-rail
//      edges on popular pages (blockbusters stuck at pos 8-12 — the usual report
//      target). Reversible (delete the EXPERT rows). Protected from the Saturday
//      ALGORITHM recompute by a guard in similarity/compute/route.ts.
//   B. Synopsis copy — the chapô AND the meta description both derive from
//      synopsisFr (there is no separate SEO-copy field). When a striking query's
//      keyword is genuinely absent from title+synopsis, we re-write synopsisFr via
//      the same gpt-5-mini pattern enrichment already uses. Enriched fiches only.
//   C. SEO <title> — writes the separate `seoTitle` field (the Google <title>
//      override); the DISPLAY name (H1/cards, media.title) is NEVER auto-edited.
//      Also runs on provisional fiches that carry an age estimate.

import OpenAI from "openai"
import { MediaType } from "@prisma/client"
import { prisma } from "./prisma"
import { parseMediaRouteId } from "./media-route"
import { seoTitleMatchesAge, MAX_TITLE } from "./fiche-title"
import type { StrikingQuery } from "./seo-striking-distance"

// How many inbound similarity edges a target should have before we stop adding
// maillage. Below this it appears in too few rails to get internal-link juice.
const LINK_TARGET = 4
// Popular striking-distance pages (the usual case: a blockbuster stuck at pos
// 8-12) already have plenty of ALGORITHM edges — but those sit mid-rail on the
// neighbours' pages. What moves them is a handful of top-of-rail EXPERT edges
// from popular neighbours. So maillage now also ensures a minimum number of
// EXPERT edges, instead of skipping any page that merely has "enough" links
// (the old rule made Lever A a no-op on exactly the pages the report targets).
const MIN_EXPERT_LINKS = 3
// EXPERT edges sit at the top of the rail (sorted by score desc) so the target is
// the first thing surfaced on each neighbour's page.
const EXPERT_SCORE = 0.95
// Editorial credibility floor for a maillage neighbour. A single shared genre
// (1.5 + rating bonus ≲ 2.5) is NOT enough to justify a top-of-rail EXPERT
// edge — it must combine at least two real signals (e.g. 2 genres, or genre +
// age proximity, or genre + shared topics). The SEO gain must never cost rail
// quality on the target's own page.
const MIN_NEIGHBOR_SCORE = 3.5
// Hard cap on AI synopsis rewrites per run. Raised 3 -> 12 once the deep query
// pool (MAX_ACTIONABLE) started surfacing real work: the 03/09 run deferred 30
// eligible synopses AND 30 titles at 3 apiece, so the cap — not the funnel —
// had become the bottleneck, and the queue was growing faster than it drained.
// The "~35s per call" figure the old comment budgeted for is the TIMEOUT, not
// the observed latency: six calls (3 synopses + 3 titles) took 16s end to end
// on 03/09 and 16s on 06/08, i.e. ~2-3s each. Twelve of each is ~60s of the
// route's 300s. AI_DEADLINE_MS below makes that safe even if latency degrades.
const MAX_REWRITES = 12
const SYNOPSIS_MAX = 400
const MIN_QUALITY = 50
// Lever C — SEO meta <title> override. Same cost discipline as synopsis.
const MAX_TITLE_REWRITES = 12
// Wall-clock guard, and the reason the caps above can be raised safely: a run
// stops issuing NEW AI calls past this point and defers the rest to next week,
// so a slow OpenAI day degrades into less work rather than a 300s timeout that
// loses the whole run — including the links and the email. Sized to leave ~90s
// of the route's maxDuration for the remaining DB writes and the send.
const AI_DEADLINE_MS = 210_000
// The real page-specific budget is MAX_TITLE (52): the root layout appends
// " | Totem Avisé" (14 chars) and Google shows ~60. The old local 65 ignored
// the suffix, so 9 of the first 14 overrides clipped in the SERP.
const SEO_TITLE_MAX = MAX_TITLE
// The agent is now fed a deep pool of striking queries (see MAX_ACTIONABLE in
// seo-striking-distance.ts) instead of just the 25 shown in the email. Most of
// the head of that pool is already saturated, so we walk it until we find fresh
// work — but each target still costs 2-3 DB round-trips, so cap the walk to
// stay well inside the route's 180s budget.
const MAX_TARGETS = 60

// ---------------------------------------------------------------------------
// Pure helpers (exported for unit tests)
// ---------------------------------------------------------------------------

/** Lowercase, strip accents, collapse non-alphanumerics to single spaces. */
export function normalize(s: string): string {
  return s
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "") // combining diacritics
    .replace(/[^a-z0-9]+/g, " ")
    .trim()
}

// Small FR (+ a few EN) stopword set — enough to drop the noise words that make
// token matching miss ("de", "le", "the", "en"...).
const STOPWORDS = new Set([
  "le", "la", "les", "un", "une", "des", "de", "du", "d", "l", "a", "au", "aux",
  "et", "ou", "en", "pour", "par", "sur", "dans", "avec", "sans", "ce", "cet",
  "cette", "ces", "son", "sa", "ses", "est", "il", "elle", "on", "nous", "vous",
  "ils", "elles", "que", "qui", "quoi", "se", "ne", "pas", "plus", "the", "of",
  "to", "and", "for", "is", "avis",
])

/** Meaningful query tokens (normalized, stopwords + 1-char tokens removed). */
export function significantTokens(query: string): string[] {
  return normalize(query)
    .split(" ")
    .filter((t) => t.length > 1 && !STOPWORDS.has(t))
}

// Media-format words. They describe what the page *is*, not information to cram
// into the copy: a fiche needn't write "film" in its synopsis to rank for
// "<titre> film age". Required-token matching ignores them, so a natural
// description isn't rejected just for omitting the format noun.
const GENERIC_TOKENS = new Set([
  "film", "films", "serie", "series", "saison", "saisons", "episode", "episodes",
  "jeu", "jeux", "video", "videos", "manga", "mangas", "livre", "livres",
  "anime", "animes", "bd", "emission", "emissions",
])

// Age/rating-intent MODIFIERS ("âge *minimum*", "à *partir* de *quel* âge",
// "âge *conseillé*", "*interdit* au *moins* de"). These phrase the question —
// they are not information the copy must literally contain. Requiring them made
// most age queries permanently unsatisfiable (natural copy says "dès 12 ans",
// never "l'âge minimum est"), which is why the write-side agent no-op'd for
// months. The AGE intent itself is still required via AGE_EQUIV below.
const INTENT_TOKENS = new Set([
  "minimum", "maximum", "quel", "quelle", "quels", "quelles", "partir",
  "conseille", "conseillee", "deconseille", "deconseillee", "recommande",
  "recommandee", "limite", "interdit", "interdite", "moins", "combien",
  "faut", "voir", "regarder", "adapte", "adaptee",
])

// Age-intent is the single most common striking-query shape ("<titre> à partir
// de quel âge", "âge minimum"). A natural answer reads "dès 14 ans" — which
// carries no literal "âge" token — so the "age" requirement is satisfied by any
// of these equivalents. Matched on whole words to avoid "dans"/"sans" → "ans".
const AGE_EQUIV = new Set(["age", "ages", "ans"])

function tokenCovered(token: string, haystack: string, haystackWords: Set<string>): boolean {
  if (AGE_EQUIV.has(token)) return [...AGE_EQUIV].some((w) => haystackWords.has(w))
  return haystack.includes(token)
}

/**
 * True when the query's *informative* tokens are already covered by the page
 * copy. Token-based (not raw-string) so "roméo + juliette âge conseillé" is
 * matched against ["romeo","juliette","age","conseille"] individually. Two
 * relaxations keep natural copy from being falsely rejected: media-format words
 * ("film", "série", "jeu"…) are not required, and the age intent ("age") is
 * satisfied by an explicit age phrasing ("dès 14 ans").
 */
export function keywordPresent(query: string, ...texts: (string | null | undefined)[]): boolean {
  const tokens = significantTokens(query).filter(
    (t) => !GENERIC_TOKENS.has(t) && !INTENT_TOKENS.has(t),
  )
  if (tokens.length === 0) return true // nothing meaningful to add
  const haystack = normalize(texts.filter(Boolean).join(" "))
  const haystackWords = new Set(haystack.split(" ").filter(Boolean))
  return tokens.every((t) => tokenCovered(t, haystack, haystackWords))
}

// Navigational / piracy / streaming-intent queries: never the right trigger for a
// copy rewrite (we'd just be stuffing a junk phrase). Flagged, not actioned.
// "regarder en" (not bare "regarder") — "<titre> âge pour regarder" is a
// legitimate age query, while "regarder en streaming/ligne" is navigational.
const JUNK_MARKERS = [
  "streaming", "regarder en", "telecharger", "torrent", "vostfr", "vf", "gratuit",
  "complet", "voir en", "en ligne", "ddl", "uptobox",
]

export function isJunkQuery(query: string): boolean {
  const n = normalize(query)
  return JUNK_MARKERS.some((m) => n.includes(m))
}

export interface NeighborSignals {
  genres: string[]
  topics: string[]
  director: string | null
  expertAgeRec: number | null
  tmdbRating?: number | null
}

/**
 * Editorial relevance score between a target and a candidate neighbour. Mirrors
 * the fallback heuristic the rail itself uses (ApercuSimilarMedia) so the links
 * we create rank the way an organic similar item would.
 */
export function scoreNeighbor(target: NeighborSignals, cand: NeighborSignals): number {
  let score = 0
  const genreSet = new Set(target.genres.map((g) => g.toLowerCase()))
  score += cand.genres.filter((g) => genreSet.has(g.toLowerCase())).length * 1.5
  if (target.director && cand.director && target.director === cand.director) score += 4
  if (target.expertAgeRec != null && cand.expertAgeRec != null && Math.abs(target.expertAgeRec - cand.expertAgeRec) <= 2) {
    score += 2
  }
  const topicSet = new Set(target.topics.map((t) => t.toLowerCase()))
  score += cand.topics.filter((t) => topicSet.has(t.toLowerCase())).length
  if (cand.tmdbRating) score += cand.tmdbRating / 10
  return score
}

// ---------------------------------------------------------------------------
// Result shapes
// ---------------------------------------------------------------------------

export interface SeoActionTarget {
  routeId: string
  title: string
  type: string
  query: string
  position: number
  linksCreated: string[] // neighbour titles linked toward this page
  linksSkippedReason?: string
  synopsis: "rewritten" | "would-rewrite" | "covered" | "flagged-junk" | "deferred-cap" | "deferred-time" | "not-enriched" | "ai-failed" | "no-keyword"
  synopsisBefore?: string
  synopsisAfter?: string
  titleNeedsKeyword: boolean // query term missing from the display title
  // Lever C — meta <title> override action (display title is never changed).
  seoTitle: "set" | "would-set" | "covered" | "flagged-junk" | "deferred-cap" | "deferred-time" | "not-enriched" | "ai-failed" | "n/a"
  seoTitleAfter?: string
}

export interface SeoAutofixResult {
  ran: boolean
  dryRun: boolean
  targets: SeoActionTarget[]
  linksCreated: number
  synopsesRewritten: number
  titlesSet: number
  flagged: number
  skippedNonMedia: number
  /** Distinct fiches the actionable pool resolved to, BEFORE the MAX_TARGETS cap. */
  distinctTargets: number
  /** Distinct fiches dropped by the MAX_TARGETS cap this run. */
  droppedByCap: number
  /** Fiche ids parsed from GSC URLs but absent from the DB. */
  missingItems: number
  /** Distinct fiches examined this run (after dedup + MAX_TARGETS). */
  targetsExamined: number
  /** Fiches with nothing left to do on any lever — already fully optimised. */
  saturated: number
  /**
   * Per-lever outcome tallies. Without these, a run that found nothing left to
   * do and a run whose every write was rejected both reported "0 lien · 0
   * synopsis · 0 titre", which is why a healthy saturated agent looked broken.
   */
  outcomes: {
    synopsis: Record<string, number>
    seoTitle: Record<string, number>
    links: Record<string, number>
  }
  section: string // markdown to append to the email
}

/** True when no lever had anything left to do on this fiche. */
export function isSaturated(t: SeoActionTarget): boolean {
  const doneSynopsis = t.synopsis === "covered" || t.synopsis === "no-keyword"
  const doneTitle = t.seoTitle === "n/a" || t.seoTitle === "covered"
  return t.linksCreated.length === 0 && Boolean(t.linksSkippedReason) && doneSynopsis && doneTitle
}

function tally(values: string[]): Record<string, number> {
  return values.reduce<Record<string, number>>((acc, v) => {
    acc[v] = (acc[v] ?? 0) + 1
    return acc
  }, {})
}

// ---------------------------------------------------------------------------
// Lever A — maillage interne
// ---------------------------------------------------------------------------

type TargetItem = {
  id: string
  title: string
  type: MediaType
  genres: string[]
  topics: string[]
  director: string | null
  expertAgeRec: number | null
  synopsisFr: string | null
  seoTitle: string | null
  isEnriched: boolean
}

async function ensureInternalLinks(
  target: TargetItem,
  dryRun: boolean,
): Promise<{ created: string[]; skippedReason?: string }> {
  const existing = await prisma.mediaSimilarity.findMany({
    where: { OR: [{ mediaIdA: target.id }, { mediaIdB: target.id }] },
    select: { mediaIdA: true, mediaIdB: true, source: true },
  })
  const expertCount = existing.filter((e) => e.source === "EXPERT").length
  if (existing.length >= LINK_TARGET && expertCount >= MIN_EXPERT_LINKS) {
    return {
      created: [],
      skippedReason: `déjà ${existing.length} liens dont ${expertCount} SEO`,
    }
  }
  const linkedIds = new Set(
    existing.map((e) => (e.mediaIdA === target.id ? e.mediaIdB : e.mediaIdA)),
  )
  // Fill whichever floor is unmet: overall coverage (thin pages) or
  // top-of-rail EXPERT presence (popular pages). Capped per run.
  const need = Math.min(
    MIN_EXPERT_LINKS,
    Math.max(LINK_TARGET - existing.length, MIN_EXPERT_LINKS - expertCount),
  )

  if (target.genres.length === 0) {
    return { created: [], skippedReason: "aucun genre" }
  }

  const candidates = await prisma.mediaItem.findMany({
    where: {
      id: { not: target.id },
      type: target.type,
      isEnriched: true,
      posterUrl: { not: null, startsWith: "http" },
      dataQualityScore: { gte: MIN_QUALITY },
      genres: { hasSome: target.genres },
    },
    select: {
      id: true, title: true, genres: true, topics: true,
      director: true, expertAgeRec: true, tmdbRating: true,
    },
    // Popular neighbours first: an EXPERT edge only passes internal-link value
    // if the neighbour's page itself gets seen/crawled.
    orderBy: { tmdbVoteCount: { sort: "desc", nulls: "last" } },
    take: 80,
  })

  const ranked = candidates
    .filter((c) => !linkedIds.has(c.id))
    .map((c) => ({ c, score: scoreNeighbor(target, c) }))
    .filter((x) => x.score >= MIN_NEIGHBOR_SCORE)
    .sort((a, b) => b.score - a.score)
    .slice(0, need)

  if (ranked.length === 0) {
    return { created: [], skippedReason: "aucun voisin assez pertinent" }
  }

  const created: string[] = []
  for (const { c } of ranked) {
    if (!dryRun) {
      const [first, second] = target.id < c.id ? [target.id, c.id] : [c.id, target.id]
      try {
        await prisma.mediaSimilarity.create({
          data: {
            mediaIdA: first,
            mediaIdB: second,
            similarityScore: EXPERT_SCORE,
            reasons: ["seo_internal_link"],
            source: "EXPERT",
          },
        })
      } catch {
        continue // pair already exists (race / reverse) — never overwrite it
      }
    }
    created.push(c.title)
  }
  return { created }
}

// ---------------------------------------------------------------------------
// Lever B — synopsis rewrite
// ---------------------------------------------------------------------------

function buildRewritePrompt(target: TargetItem, query: string): string {
  const typeLabel = target.type.toLowerCase()
  return [
    `Tu réécris le synopsis FR d'un ${typeLabel} pour notre guide média familial.`,
    `Titre : « ${target.title} »`,
    target.expertAgeRec ? `Âge conseillé : dès ${target.expertAgeRec} ans.` : "",
    `Synopsis actuel : ${target.synopsisFr || "(aucun)"}`,
    "",
    `Des familles cherchent ce contenu via la requête : « ${query} ».`,
    "Réécris le synopsis pour qu'il réponde NATURELLEMENT à cette intention,",
    "en intégrant les mots-clés pertinents là où ils ont du sens, et donne envie",
    "de lire la fiche (pas juste de répondre puis partir).",
    "Contraintes STRICTES :",
    "- Français, 2 à 3 phrases, 400 caractères MAXIMUM.",
    "- N'invente AUCUN fait : reste fidèle au synopsis actuel et au titre.",
    "- Si la requête porte sur l'âge, réponds avec une formulation naturelle",
    "  (« dès 12 ans », « déconseillé avant 14 ans ») — le mot « âge » n'est pas obligatoire.",
    "- PLACEMENT de l'âge : en tête de phrase (« Dès 12 ans, ... »), en fin de phrase",
    "  (« ... une aventure à partager dès 6 ans. ») ou après un mot qui l'introduit",
    "  (« conseillé dès 12 ans »). JAMAIS au milieu d'une proposition narrative :",
    "  « sa vie de super-héros dès 12 ans, quand... » décrit le personnage, pas le public.",
    "- Inutile de répéter le format (« film », « série », « jeu ») : la page l'indique déjà.",
    "- Pas de bourrage de mots-clés, pas de la requête recopiée telle quelle.",
    "- Ton informatif et sobre, destiné aux parents.",
    'Réponds en JSON valide uniquement : {"synopsis": "..."}',
  ].filter(Boolean).join("\n")
}

/** Single gpt-5-mini call that returns one string field from a JSON reply.
 *  Shared by the synopsis (field "synopsis") and meta-title (field "title")
 *  rewriters. */
async function callJsonField(openai: OpenAI, prompt: string, field: string): Promise<string | null> {
  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), 35_000)
  try {
    const params = {
      model: "gpt-5-mini",
      messages: [
        { role: "system" as const, content: "Tu es un rédacteur SEO francophone spécialisé dans les contenus médias familiaux. Réponds toujours en JSON valide, concis, sans texte superflu." },
        { role: "user" as const, content: prompt },
      ],
      max_completion_tokens: 2000,
      reasoning_effort: "minimal",
    }
    const response = await openai.chat.completions.create(
      params as unknown as Parameters<typeof openai.chat.completions.create>[0] & { stream?: false },
      { signal: controller.signal },
    )
    const content = response.choices[0]?.message?.content
    if (!content) return null
    const match = content.replace(/```json\n?/g, "").replace(/```\n?/g, "").trim().match(/\{[\s\S]*\}/)
    if (!match) return null
    const parsed = JSON.parse(match[0]) as Record<string, unknown>
    const value = parsed[field]
    return typeof value === "string" ? value.trim() : null
  } catch {
    return null
  } finally {
    clearTimeout(timer)
  }
}

/**
 * Words that can legitimately introduce an age phrase — either a recommendation
 * ("conseillé dès 12 ans") or a verb of consumption ("à partager dès 6 ans") or
 * the audience itself ("un film familial dès 8 ans"). Accent-free because the
 * lookup runs through `normalize`.
 */
const AGE_PHRASE_LEAD_INS = new Set([
  // recommendation
  "conseille", "conseillee", "conseilles", "recommande", "recommandee", "recommandes",
  "deconseille", "deconseillee", "adapte", "adaptee", "adaptes", "accessible", "accessibles",
  "destine", "destinee", "destines", "reserve", "reservee", "interdit", "interdite",
  "convient", "classe", "classee", "autorise", "autorisee", "indique", "indiquee", "approprie",
  // consumption
  "partager", "voir", "revoir", "regarder", "lire", "jouer", "apprecier", "decouvrir",
  "savourer", "suivre", "visionner", "aborder",
  // audience
  "famille", "familles", "familial", "familiale", "public", "publics", "spectateurs",
  "enfants", "ados", "adolescents", "jeunes", "lecteurs", "joueurs",
])

const AGE_PHRASE_RE =
  /(?:\bdès\s+\d{1,2}\s+ans|\bà\s+partir\s+de\s+\d{1,2}\s+ans|\bavant\s+\d{1,2}\s+ans)/gi

/**
 * Does every age mention sit somewhere a French reader would accept?
 *
 * Lever B asks the model to work the ranking keyword into the synopsis, and
 * when the query is an age query the keyword IS the age. Nothing checked WHERE
 * it landed, so a run on "spider man brand new day age" produced:
 *
 *   « Peter Parker jongle entre ses devoirs de lycéen et sa vie de super-héros
 *     dès 12 ans, quand de nouveaux ennemis menacent New York. »
 *
 * — which reads as "Peter Parker has been a superhero since he was 12", a
 * statement about the character rather than the audience. It shipped to the
 * meta description of the site's second-biggest page, where `generateMetadata`
 * also prefixes "Dès 12 ans · Notre avis famille", so the SERP snippet said
 * "dès 12 ans" twice, the second time nonsensically.
 *
 * An age phrase is fine when it opens a sentence, closes one, or follows a word
 * that naturally governs it. Anything else is mid-clause and rejected. Failing
 * closed only costs us the rewrite (the existing synopsis stays), so this leans
 * deliberately strict.
 */
export function ageMentionReadsNaturally(text: string): boolean {
  for (const m of text.matchAll(AGE_PHRASE_RE)) {
    const start = m.index ?? 0
    const before = text.slice(0, start)
    const after = text.slice(start + m[0].length)

    // Opens the synopsis, or a new sentence/clause after strong punctuation.
    if (before.trim() === "") continue
    if (/[.!?:;—–]\s*$/.test(before)) continue
    // Closes the sentence.
    if (after.trim() === "" || /^\s*[.!?]/.test(after)) continue
    // Governed by a recommendation / consumption / audience word.
    const lastWord = before.trim().split(/[\s'’]+/).pop() ?? ""
    if (AGE_PHRASE_LEAD_INS.has(normalize(lastWord))) continue

    return false
  }
  return true
}

/** Gate a candidate rewrite before it ever touches the DB. */
export function rewritePasses(query: string, title: string, before: string | null, after: string): boolean {
  if (!after || after.length > SYNOPSIS_MAX) return false
  if (isJunkQuery(after)) return false
  // An age keyword dropped mid-clause reads as a fact about the characters.
  if (!ageMentionReadsNaturally(after)) return false
  // Must now cover the keyword it was supposed to add. The TITLE counts toward
  // coverage (same haystack as the decision gate): a synopsis describes the
  // plot and never repeats its own title, so requiring "toy story" inside the
  // synopsis text rejected every legitimate draft — the second reason the
  // agent's rewrites always came back "échouée/refusée".
  if (!keywordPresent(query, title, after)) return false
  // Don't let the model gut the description.
  if (before && after.length < before.length * 0.5) return false
  return true
}

// ---------------------------------------------------------------------------
// Lever C — SEO meta <title> (separate `seoTitle` field; NEVER the display name)
// ---------------------------------------------------------------------------

function buildTitlePrompt(target: TargetItem, query: string): string {
  const typeLabel = target.type.toLowerCase()
  return [
    `Tu rédiges la balise <title> SEO d'une fiche ${typeLabel} de notre guide média familial.`,
    `Titre exact de l'œuvre (à placer au début, sans le modifier) : « ${target.title} »`,
    target.expertAgeRec ? `Âge conseillé : dès ${target.expertAgeRec} ans.` : "",
    `Des familles cherchent cette fiche via : « ${query} ».`,
    "Rédige un <title> Google qui COMMENCE par le titre exact de l'œuvre, puis répond à cette intention.",
    "Contraintes STRICTES :",
    `- Français, ${SEO_TITLE_MAX} caractères MAXIMUM.`,
    `- DOIT commencer par « ${target.title} ».`,
    "- Intègre naturellement le mot-clé de la requête (ex. « à partir de quel âge », « âge minimum »).",
    "  Pour une intention d'âge, le mot « âge » ou une tranche (« dès 12 ans ») suffit.",
    "- Inutile de répéter le format (« film », « série », « jeu ») : ça gaspille des caractères.",
    "- N'invente aucun fait. N'ajoute PAS « | Totem Avisé » (ajouté automatiquement).",
    'Réponds en JSON valide uniquement : {"title": "..."}',
  ].filter(Boolean).join("\n")
}

/** Gate a candidate meta title before it touches the DB. */
export function seoTitlePasses(
  query: string,
  realTitle: string,
  candidate: string,
  expertAgeRec?: number | null,
): boolean {
  if (!candidate || candidate.length > SEO_TITLE_MAX) return false
  if (isJunkQuery(candidate)) return false
  // Stay faithful — the real work title must still be present (no rename).
  if (!normalize(candidate).includes(normalize(realTitle))) return false
  // Must now cover the ranking keyword it was meant to add.
  if (!keywordPresent(query, candidate)) return false
  // Never assert an age the fiche disagrees with — a <title> saying
  // "dès 6 ans" over an 8-ans verdict is a family-trust bug, not SEO.
  if (expertAgeRec !== undefined && !seoTitleMatchesAge(candidate, expertAgeRec)) return false
  return true
}

// ---------------------------------------------------------------------------
// Orchestrator
// ---------------------------------------------------------------------------

function pageRouteId(pageUrl: string): string | null {
  let path: string
  try {
    path = new URL(pageUrl).pathname
  } catch {
    path = pageUrl
  }
  const m = path.match(/^\/media\/(.+)$/)
  return m ? m[1] : null
}

export async function runSeoAutofix(
  striking: StrikingQuery[],
  opts: { dryRun: boolean },
): Promise<SeoAutofixResult> {
  const { dryRun } = opts

  // 1. Resolve + dedup by target media id; keep the highest-opportunity query per page.
  let skippedNonMedia = 0
  const byTarget = new Map<string, { id: string; query: string; position: number; opportunity: number }>()
  for (const q of striking) {
    const routeId = pageRouteId(q.page)
    const parsed = routeId ? parseMediaRouteId(routeId) : { type: null, id: "" }
    if (!routeId || !parsed.type || !parsed.id) {
      skippedNonMedia++
      continue
    }
    const prev = byTarget.get(parsed.id)
    if (!prev || q.opportunity > prev.opportunity) {
      byTarget.set(parsed.id, { id: parsed.id, query: q.query, position: q.position, opportunity: q.opportunity })
    }
  }

  const openaiKey = process.env.OPENAI_API_KEY
  const openai = openaiKey ? new OpenAI({ apiKey: openaiKey }) : null

  const targets: SeoActionTarget[] = []
  let rewritesUsed = 0
  let titleRewritesUsed = 0
  const aiDeadline = Date.now() + AI_DEADLINE_MS

  // Best-opportunity fiches first (the striking list arrives sorted), capped so
  // a deep pool can't blow the route's time budget.
  const ordered = [...byTarget.values()]
    .sort((a, b) => b.opportunity - a.opportunity)
    .slice(0, MAX_TARGETS)
  // No silent caps: record what the fiche-level bound left on the table so
  // cron_logs can distinguish "pool exhausted" from "pool truncated".
  const droppedByCap = byTarget.size - ordered.length
  let missingItems = 0

  for (const t of ordered) {
    const item = await prisma.mediaItem.findUnique({
      where: { id: t.id },
      select: {
        id: true, title: true, type: true, genres: true, topics: true,
        director: true, expertAgeRec: true, synopsisFr: true, seoTitle: true, isEnriched: true,
      },
    })
    if (!item) {
      missingItems++
      continue
    }

    const links = await ensureInternalLinks(item, dryRun)

    const titleNeedsKeyword = !keywordPresent(t.query, item.title)

    // Decide the synopsis action.
    let synopsis: SeoActionTarget["synopsis"]
    let synopsisBefore: string | undefined
    let synopsisAfter: string | undefined

    if (!item.isEnriched) {
      synopsis = "not-enriched"
    } else if (isJunkQuery(t.query)) {
      synopsis = "flagged-junk"
    } else if (keywordPresent(t.query, item.title, item.synopsisFr)) {
      synopsis = "covered"
    } else if (dryRun) {
      synopsis = "would-rewrite"
    } else if (rewritesUsed >= MAX_REWRITES) {
      synopsis = "deferred-cap"
    } else if (Date.now() > aiDeadline) {
      synopsis = "deferred-time"
    } else if (!openai) {
      synopsis = "ai-failed"
    } else {
      rewritesUsed++
      const draft = await callJsonField(openai, buildRewritePrompt(item, t.query), "synopsis")
      if (draft && rewritePasses(t.query, item.title, item.synopsisFr, draft)) {
        // Un-mark the grammar/tone check too — this rewrite is fresh text the
        // synopsis-audit sweep hasn't seen yet.
        await prisma.mediaItem.update({
          where: { id: item.id },
          data: { synopsisFr: draft, synopsisFrCheckedAt: null },
        })
        synopsis = "rewritten"
        synopsisBefore = item.synopsisFr ?? ""
        synopsisAfter = draft
      } else {
        synopsis = "ai-failed"
      }
    }

    // Lever C — SEO meta title. Only when the keyword is missing from the
    // DISPLAY title; writes the separate `seoTitle` field, never `title`.
    // Unlike the synopsis lever, this one ALSO runs on provisional
    // (un-enriched) fiches as long as they carry an age estimate: the title
    // only uses title + age + query intent — nothing to confabulate — and
    // pre-release tentpoles (L'Odyssée, Spider-Man…) are precisely where the
    // striking-distance traffic concentrates.
    let seoTitle: SeoActionTarget["seoTitle"]
    let seoTitleAfter: string | undefined
    if (!titleNeedsKeyword) {
      seoTitle = "n/a"
    } else if (!item.isEnriched && item.expertAgeRec == null) {
      seoTitle = "not-enriched"
    } else if (isJunkQuery(t.query)) {
      seoTitle = "flagged-junk"
    } else if (item.seoTitle && keywordPresent(t.query, item.seoTitle)) {
      seoTitle = "covered"
    } else if (dryRun) {
      seoTitle = "would-set"
    } else if (titleRewritesUsed >= MAX_TITLE_REWRITES) {
      seoTitle = "deferred-cap"
    } else if (Date.now() > aiDeadline) {
      seoTitle = "deferred-time"
    } else if (!openai) {
      seoTitle = "ai-failed"
    } else {
      titleRewritesUsed++
      const draft = await callJsonField(openai, buildTitlePrompt(item, t.query), "title")
      if (draft && seoTitlePasses(t.query, item.title, draft, item.expertAgeRec)) {
        await prisma.mediaItem.update({ where: { id: item.id }, data: { seoTitle: draft } })
        seoTitle = "set"
        seoTitleAfter = draft
      } else {
        seoTitle = "ai-failed"
      }
    }

    targets.push({
      routeId: t.id,
      title: item.title,
      type: item.type,
      query: t.query,
      position: t.position,
      linksCreated: links.created,
      linksSkippedReason: links.skippedReason,
      synopsis,
      synopsisBefore,
      synopsisAfter,
      titleNeedsKeyword,
      seoTitle,
      seoTitleAfter,
    })
  }

  const linksCreated = targets.reduce((s, t) => s + t.linksCreated.length, 0)
  const synopsesRewritten = targets.filter((t) => t.synopsis === "rewritten").length
  const titlesSet = targets.filter((t) => t.seoTitle === "set").length
  // "Flagged" = couldn't be auto-handled and wants human eyes. Titles are no
  // longer auto-flagged just for missing a keyword — the agent sets seoTitle.
  const blocked = new Set(["flagged-junk", "deferred-cap", "deferred-time", "ai-failed"])
  const flagged = targets.filter(
    (t) => blocked.has(t.synopsis) || blocked.has(t.seoTitle),
  ).length
  const saturated = targets.filter(isSaturated).length

  const outcomes = {
    synopsis: tally(targets.map((t) => t.synopsis)),
    seoTitle: tally(targets.map((t) => t.seoTitle)),
    links: tally(
      targets.map((t) =>
        t.linksCreated.length > 0 ? "created" : t.linksSkippedReason ?? "aucun",
      ),
    ),
  }

  return {
    ran: true,
    dryRun,
    targets,
    linksCreated,
    synopsesRewritten,
    titlesSet,
    flagged,
    skippedNonMedia,
    distinctTargets: byTarget.size,
    droppedByCap,
    missingItems,
    targetsExamined: targets.length,
    saturated,
    outcomes,
    section: buildActionsSection({
      dryRun, targets, linksCreated, synopsesRewritten, titlesSet, skippedNonMedia, saturated,
    }),
  }
}

// ---------------------------------------------------------------------------
// Report
// ---------------------------------------------------------------------------

const SYNOPSIS_LABEL: Record<SeoActionTarget["synopsis"], string> = {
  "rewritten": "synopsis réécrit (chapô + meta)",
  "would-rewrite": "synopsis à réécrire (mot-clé absent)",
  "covered": "synopsis déjà pertinent",
  "flagged-junk": "requête navigationnelle — non touchée",
  "deferred-cap": "réécriture reportée (plafond atteint)",
  "deferred-time": "réécriture reportée (budget temps du run atteint)",
  "not-enriched": "fiche non enrichie — ignorée",
  "ai-failed": "réécriture échouée/refusée",
  "no-keyword": "rien à ajouter",
}

const SEO_TITLE_LABEL: Record<SeoActionTarget["seoTitle"], string> = {
  "set": "titre SEO (balise <title>) réécrit",
  "would-set": "titre SEO à réécrire (mot-clé absent du titre)",
  "covered": "titre SEO déjà pertinent",
  "flagged-junk": "requête navigationnelle — titre non touché",
  "deferred-cap": "titre SEO reporté (plafond atteint)",
  "deferred-time": "titre SEO reporté (budget temps du run atteint)",
  "not-enriched": "fiche non enrichie — titre ignoré",
  "ai-failed": "titre SEO échoué/refusé",
  "n/a": "",
}

function buildActionsSection(input: {
  dryRun: boolean
  targets: SeoActionTarget[]
  linksCreated: number
  synopsesRewritten: number
  titlesSet: number
  skippedNonMedia: number
  saturated: number
}): string {
  const { dryRun, targets, linksCreated, synopsesRewritten, titlesSet, skippedNonMedia, saturated } = input
  const verb = dryRun ? "à faire (simulation)" : "fait"
  const lines: string[] = [
    "",
    "## Actions de l'agent (write-side)",
    "",
    dryRun
      ? "_Mode simulation (`dryRun`) : aucune écriture en base._"
      : "_Écritures appliquées automatiquement. Le titre SEO modifie UNIQUEMENT la balise <title> (résultat Google) — jamais le nom affiché (H1/cartes)._",
    "",
    `- Fiches examinées : **${targets.length}**`,
    `- Liens internes ${verb} : **${linksCreated}**`,
    `- Synopsis ${dryRun ? "à réécrire" : "réécrits"} : **${dryRun ? targets.filter((t) => t.synopsis === "would-rewrite").length : synopsesRewritten}**`,
    `- Titres SEO ${dryRun ? "à réécrire" : "réécrits"} : **${dryRun ? targets.filter((t) => t.seoTitle === "would-set").length : titlesSet}**`,
    `- Fiches déjà entièrement optimisées : ${saturated}`,
    `- URLs hors fiche ignorées : ${skippedNonMedia}`,
    "",
  ]

  if (targets.length === 0) {
    lines.push("Aucune fiche actionnable sur cette période.")
    return lines.join("\n")
  }

  // Why nothing happened matters as much as what happened: a run with zero
  // writes because every fiche is already optimised is a healthy run, and used
  // to be indistinguishable from a run where every write was rejected.
  if (linksCreated === 0 && synopsesRewritten === 0 && titlesSet === 0 && !dryRun) {
    lines.push(
      saturated === targets.length
        ? `**Rien à faire : les ${targets.length} fiches concernées sont déjà entièrement optimisées** (maillage au plafond, mot-clé présent dans le synopsis et le titre SEO). C'est le résultat attendu, pas une panne.`
        : "**Aucune écriture ce run.** Voir le détail ci-dessous pour la raison fiche par fiche.",
      "",
    )
  }

  // Only detail fiches where something happened or where a human decision is
  // needed — the saturated tail would otherwise bury the signal.
  const noteworthy = targets.filter((t) => !isSaturated(t))
  if (noteworthy.length === 0) return lines.join("\n")

  lines.push("### Détail par fiche", "")
  noteworthy.forEach((t) => {
    lines.push(`**${t.title}** (${t.type.toLowerCase()}, pos. ${t.position.toFixed(0)}) — « ${t.query} »`)
    if (t.linksCreated.length > 0) {
      lines.push(`- Maillage : +${t.linksCreated.length} lien(s) depuis ${t.linksCreated.map((x) => `« ${x} »`).join(", ")}`)
    } else if (t.linksSkippedReason) {
      lines.push(`- Maillage : aucun (${t.linksSkippedReason})`)
    }
    lines.push(`- Copie : ${SYNOPSIS_LABEL[t.synopsis]}`)
    if (t.synopsis === "rewritten" && t.synopsisAfter) {
      lines.push(`  - Avant : ${t.synopsisBefore || "(vide)"}`)
      lines.push(`  - Après : ${t.synopsisAfter}`)
    }
    if (t.seoTitle !== "n/a") {
      lines.push(`- Titre SEO : ${SEO_TITLE_LABEL[t.seoTitle]}`)
      if ((t.seoTitle === "set") && t.seoTitleAfter) {
        lines.push(`  - Balise <title> : ${t.seoTitleAfter}`)
      }
    }
    lines.push("")
  })

  return lines.join("\n")
}
