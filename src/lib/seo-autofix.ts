// "Write-side" SEO agent. The striking-distance analysis (seo-striking-distance.ts)
// only *reports* on-page nudges; this module actually performs the safe ones and
// records exactly what it did so the weekly email becomes a closed loop instead of
// a to-do list.
//
// Two levers, both grounded in how /media/[id] pages actually render:
//   A. Maillage interne — there is no in-body internal-link system; the only
//      structured internal link on a fiche is the "Dans le même genre" rail, which
//      reads MediaSimilarity edges (symmetric: an edge (X, T) surfaces T on X's page).
//      So we create high-score source:"EXPERT" edges toward under-linked target
//      pages. Reversible (delete the EXPERT rows). Protected from the Saturday
//      ALGORITHM recompute by a guard in similarity/compute/route.ts.
//   B. Synopsis copy — the chapô AND the meta description both derive from
//      synopsisFr (there is no separate SEO-copy field). When a striking query's
//      keyword is genuinely absent from title+synopsis, we re-write synopsisFr via
//      the same gpt-5-mini pattern enrichment already uses.
//
// The page <title>/H1 is media.title (used site-wide) and is NEVER auto-edited —
// only flagged for a human.

import OpenAI from "openai"
import { MediaType } from "@prisma/client"
import { prisma } from "./prisma"
import { parseMediaRouteId } from "./media-route"
import type { StrikingQuery } from "./seo-striking-distance"

// How many inbound similarity edges a target should have before we stop adding
// maillage. Below this it appears in too few rails to get internal-link juice.
const LINK_TARGET = 4
// EXPERT edges sit at the top of the rail (sorted by score desc) so the target is
// the first thing surfaced on each neighbour's page.
const EXPERT_SCORE = 0.95
// Hard cap on AI synopsis rewrites per run. Keeps cost bounded and the run under
// the route's maxDuration (each gpt-5-mini call can take ~35s).
const MAX_REWRITES = 3
const SYNOPSIS_MAX = 400
const MIN_QUALITY = 50
// Lever C — SEO meta <title> override. Same cost discipline as synopsis.
const MAX_TITLE_REWRITES = 3
const SEO_TITLE_MAX = 65 // Google truncates ~60 chars; keep a small margin.

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

/**
 * True when every significant token of the query already appears in the page
 * copy. Token-based (not raw-string) so "roméo + juliette âge conseillé" is
 * matched against ["romeo","juliette","age","conseille"] individually.
 */
export function keywordPresent(query: string, ...texts: (string | null | undefined)[]): boolean {
  const tokens = significantTokens(query)
  if (tokens.length === 0) return true // nothing meaningful to add
  const haystack = normalize(texts.filter(Boolean).join(" "))
  return tokens.every((t) => haystack.includes(t))
}

// Navigational / piracy / streaming-intent queries: never the right trigger for a
// copy rewrite (we'd just be stuffing a junk phrase). Flagged, not actioned.
const JUNK_MARKERS = [
  "streaming", "regarder", "telecharger", "torrent", "vostfr", "vf", "gratuit",
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
  synopsis: "rewritten" | "would-rewrite" | "covered" | "flagged-junk" | "deferred-cap" | "not-enriched" | "ai-failed" | "no-keyword"
  synopsisBefore?: string
  synopsisAfter?: string
  titleNeedsKeyword: boolean // query term missing from the display title
  // Lever C — meta <title> override action (display title is never changed).
  seoTitle: "set" | "would-set" | "covered" | "flagged-junk" | "deferred-cap" | "not-enriched" | "ai-failed" | "n/a"
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
  section: string // markdown to append to the email
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
    select: { mediaIdA: true, mediaIdB: true },
  })
  if (existing.length >= LINK_TARGET) {
    return { created: [], skippedReason: `déjà ${existing.length} liens` }
  }
  const linkedIds = new Set(
    existing.map((e) => (e.mediaIdA === target.id ? e.mediaIdB : e.mediaIdA)),
  )
  const need = LINK_TARGET - existing.length

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
    take: 80,
  })

  const ranked = candidates
    .filter((c) => !linkedIds.has(c.id))
    .map((c) => ({ c, score: scoreNeighbor(target, c) }))
    .filter((x) => x.score > 0)
    .sort((a, b) => b.score - a.score)
    .slice(0, need)

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
    "en intégrant les mots-clés pertinents là où ils ont du sens.",
    "Contraintes STRICTES :",
    "- Français, 2 à 3 phrases, 400 caractères MAXIMUM.",
    "- N'invente AUCUN fait : reste fidèle au synopsis actuel et au titre.",
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

/** Gate a candidate rewrite before it ever touches the DB. */
function rewritePasses(query: string, before: string | null, after: string): boolean {
  if (!after || after.length > SYNOPSIS_MAX) return false
  if (isJunkQuery(after)) return false
  // Must now cover the keyword it was supposed to add.
  if (!keywordPresent(query, after)) return false
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
    "- N'invente aucun fait. N'ajoute PAS « | Totem Avisé » (ajouté automatiquement).",
    'Réponds en JSON valide uniquement : {"title": "..."}',
  ].filter(Boolean).join("\n")
}

/** Gate a candidate meta title before it touches the DB. */
export function seoTitlePasses(query: string, realTitle: string, candidate: string): boolean {
  if (!candidate || candidate.length > SEO_TITLE_MAX) return false
  if (isJunkQuery(candidate)) return false
  // Stay faithful — the real work title must still be present (no rename).
  if (!normalize(candidate).includes(normalize(realTitle))) return false
  // Must now cover the ranking keyword it was meant to add.
  if (!keywordPresent(query, candidate)) return false
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

  for (const t of byTarget.values()) {
    const item = await prisma.mediaItem.findUnique({
      where: { id: t.id },
      select: {
        id: true, title: true, type: true, genres: true, topics: true,
        director: true, expertAgeRec: true, synopsisFr: true, seoTitle: true, isEnriched: true,
      },
    })
    if (!item) continue

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
    } else if (!openai) {
      synopsis = "ai-failed"
    } else {
      rewritesUsed++
      const draft = await callJsonField(openai, buildRewritePrompt(item, t.query), "synopsis")
      if (draft && rewritePasses(t.query, item.synopsisFr, draft)) {
        await prisma.mediaItem.update({ where: { id: item.id }, data: { synopsisFr: draft } })
        synopsis = "rewritten"
        synopsisBefore = item.synopsisFr ?? ""
        synopsisAfter = draft
      } else {
        synopsis = "ai-failed"
      }
    }

    // Lever C — SEO meta title. Only when the keyword is missing from the
    // DISPLAY title; writes the separate `seoTitle` field, never `title`.
    let seoTitle: SeoActionTarget["seoTitle"]
    let seoTitleAfter: string | undefined
    if (!titleNeedsKeyword) {
      seoTitle = "n/a"
    } else if (!item.isEnriched) {
      seoTitle = "not-enriched"
    } else if (isJunkQuery(t.query)) {
      seoTitle = "flagged-junk"
    } else if (item.seoTitle && keywordPresent(t.query, item.seoTitle)) {
      seoTitle = "covered"
    } else if (dryRun) {
      seoTitle = "would-set"
    } else if (titleRewritesUsed >= MAX_TITLE_REWRITES) {
      seoTitle = "deferred-cap"
    } else if (!openai) {
      seoTitle = "ai-failed"
    } else {
      titleRewritesUsed++
      const draft = await callJsonField(openai, buildTitlePrompt(item, t.query), "title")
      if (draft && seoTitlePasses(t.query, item.title, draft)) {
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
  const blocked = new Set(["flagged-junk", "deferred-cap", "ai-failed"])
  const flagged = targets.filter(
    (t) => blocked.has(t.synopsis) || blocked.has(t.seoTitle),
  ).length

  return {
    ran: true,
    dryRun,
    targets,
    linksCreated,
    synopsesRewritten,
    titlesSet,
    flagged,
    skippedNonMedia,
    section: buildActionsSection({ dryRun, targets, linksCreated, synopsesRewritten, titlesSet, skippedNonMedia }),
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
}): string {
  const { dryRun, targets, linksCreated, synopsesRewritten, titlesSet, skippedNonMedia } = input
  const verb = dryRun ? "à faire (simulation)" : "fait"
  const lines: string[] = [
    "",
    "## Actions de l'agent (write-side)",
    "",
    dryRun
      ? "_Mode simulation (`dryRun`) : aucune écriture en base._"
      : "_Écritures appliquées automatiquement. Le titre SEO modifie UNIQUEMENT la balise <title> (résultat Google) — jamais le nom affiché (H1/cartes)._",
    "",
    `- Liens internes ${verb} : **${linksCreated}**`,
    `- Synopsis ${dryRun ? "à réécrire" : "réécrits"} : **${dryRun ? targets.filter((t) => t.synopsis === "would-rewrite").length : synopsesRewritten}**`,
    `- Titres SEO ${dryRun ? "à réécrire" : "réécrits"} : **${dryRun ? targets.filter((t) => t.seoTitle === "would-set").length : titlesSet}**`,
    `- URLs hors fiche ignorées : ${skippedNonMedia}`,
    "",
  ]

  if (targets.length === 0) {
    lines.push("Aucune fiche actionnable sur cette période.")
    return lines.join("\n")
  }

  lines.push("### Détail par fiche", "")
  targets.forEach((t) => {
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
