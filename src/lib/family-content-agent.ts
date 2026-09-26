import { Prisma } from "@prisma/client"
import { prisma } from "@/lib/prisma"
import { getAnthropic, DEFAULT_MODEL } from "@/lib/anthropic"
import { callClaudeWithTimeout } from "@/lib/anthropic-with-timeout"
import { sendEditorialAgentReport } from "@/lib/email"
import { toMediaRouteId } from "@/lib/media-route"
import { withVerdict } from "@/lib/agent-verdict"
import { COLLECTIONS } from "@/lib/collections-data"

type Candidate = {
  id: string
  title: string
  type: string
  url: string
  releaseDate: string | null
  expertAgeRec: number | null
  genres: string[]
  topics: string[]
  platforms: string[]
  synopsisFr: string | null
  tmdbRating: number | null
  tmdbVoteCount: number | null
  dataQualityScore: number
  isEnriched: boolean
  reviewCount: number
  metricsCompleteness: number
  priorityScore: number
  category: "family-mainstream" | "watchlist-sensitive" | "seo-aeo"
  reasons: string[]
  cautions: string[]
}

export type FamilyContentAgentResult = {
  /** Fiches retenues dans le rapport (plafonnées à MAX_SELECTED). */
  candidatesSelected: number
  /** Fiches éligibles AVANT plafonnement — la vraie taille de la file. */
  candidatesMatching: number
  /** Vrai quand la sélection a été coupée par le plafond. */
  capped: boolean
  /** Vrai quand le rapport a été tronqué par le plafond de tokens. */
  truncated: boolean
  /** "success" sauf rapport tronqué ou repli déterministe → "partial". */
  status: "success" | "partial"
  report: string
}

/**
 * Plafond de la sélection envoyée dans le rapport. C'est un plafond
 * d'affichage, PAS une mesure : le compte réel de la file voyage désormais
 * séparément dans `candidatesMatching`. Pendant six semaines (17 août →
 * 21 septembre 2026) l'e-mail et `cron_logs` ont affiché « 24 » à l'identique
 * chaque lundi, parce que ce plafond était rapporté comme s'il était le
 * résultat d'un comptage.
 */
const MAX_SELECTED = 24

const SITE_URL = process.env.NEXT_PUBLIC_APP_URL || "https://totemavise.com"
const FAMILY_GENRES = new Set(["animation", "famille", "family", "aventure", "comédie", "fantastique"])
const FAMILY_TOPICS = new Set([
  "disney",
  "pixar",
  "dreamworks",
  "illumination",
  "studio ghibli",
  "lego",
  "minecraft",
  "nintendo",
  "star wars",
  "super-héros",
  "animaux",
  "amitié",
  "magie",
  "aventure",
])
const SENSITIVE_GENRES = new Set(["thriller", "horreur", "horror", "crime", "épouvante", "drame", "romance"])

function daysBetween(a: Date, b: Date): number {
  return Math.round((a.getTime() - b.getTime()) / 86_400_000)
}

function scoreCandidate(item: {
  releaseDate: Date | null
  expertAgeRec: number | null
  synopsisFr: string | null
  genres: string[]
  topics: string[]
  platforms: string[]
  tmdbRating: number | null
  tmdbVoteCount: number | null
  dataQualityScore: number
  isEnriched: boolean
  contentMetrics: {
    whatParentsNeedToKnow: string[]
    toneTags: string[]
    pacing: string | null
  } | null
  _count: { reviews: number }
}): {
  score: number
  reasons: string[]
  cautions: string[]
  metricsCompleteness: number
  category: Candidate["category"]
} {
  const now = new Date()
  let score = 0
  const reasons: string[] = []
  const cautions: string[] = []
  const lowerGenres = item.genres.map((genre) => genre.toLowerCase())
  const lowerTopics = item.topics.map((topic) => topic.toLowerCase())
  const familySignals =
    lowerGenres.filter((genre) => FAMILY_GENRES.has(genre)).length +
    lowerTopics.filter((topic) => FAMILY_TOPICS.has(topic)).length
  const sensitiveSignals = lowerGenres.filter((genre) => SENSITIVE_GENRES.has(genre)).length
  const age = item.expertAgeRec
  const isFamilyAge = age != null && age <= 13
  const isTeenOrAdult = age == null || age >= 15

  if (item.releaseDate) {
    const delta = daysBetween(item.releaseDate, now)
    if (delta >= 0 && delta <= 35) {
      score += 35
      reasons.push("sortie à venir")
    } else if (delta >= -14 && delta < 0) {
      score += 20
      reasons.push("sortie récente")
    }
  }

  if (familySignals >= 2) {
    score += 30
    reasons.push("fort potentiel famille")
  } else if (familySignals === 1) {
    score += 16
    reasons.push("signal famille")
  }

  if (isFamilyAge) {
    score += 18
    reasons.push(`âge famille (${age}+)`)
  }

  const voteCount = item.tmdbVoteCount ?? 0
  if (voteCount >= 1000) {
    score += 18
    reasons.push("fort signal de popularité")
  } else if (voteCount >= 200) {
    score += 10
    reasons.push("popularité correcte")
  }

  if (sensitiveSignals > 0 && isTeenOrAdult) {
    score -= 24
    cautions.push("contenu plutôt ado/adulte à surveiller")
  } else if (sensitiveSignals > 0) {
    score -= 10
    cautions.push("signal sensible à vérifier")
  }

  if (age != null && age >= 16) {
    score -= 18
    cautions.push("16+ peu prioritaire pour acquisition famille")
  } else if (age != null && age >= 15) {
    score -= 10
    cautions.push("15+ à traiter en surveillance plutôt qu'en priorité")
  }

  if (item.expertAgeRec == null) {
    score += 10
    reasons.push("âge recommandé manquant")
  }
  if (!item.isEnriched || !item.contentMetrics) {
    score += 12
    reasons.push("fiche à enrichir")
  }
  if (item.dataQualityScore < 65) {
    score += 12
    reasons.push(`qualité de données ${item.dataQualityScore}/100`)
  }
  if (!item.synopsisFr || item.synopsisFr.length < 180) {
    score += 8
    reasons.push("synopsis à renforcer")
  }
  if (item.topics.length < 3) {
    score += 6
    reasons.push("thèmes peu détaillés")
  }
  if ((item.contentMetrics?.whatParentsNeedToKnow.length ?? 0) < 3) {
    score += 8
    reasons.push("points parents incomplets")
  }
  if (item._count.reviews === 0) {
    score += familySignals > 0 ? 4 : 0
    reasons.push("aucun avis parent")
  }

  const metricsCompleteness =
    (item.contentMetrics ? 30 : 0) +
    (item.expertAgeRec != null ? 20 : 0) +
    (item.synopsisFr && item.synopsisFr.length >= 180 ? 15 : 0) +
    (item.topics.length >= 3 ? 15 : 0) +
    ((item.contentMetrics?.whatParentsNeedToKnow.length ?? 0) >= 3 ? 20 : 0)

  const category: Candidate["category"] =
    familySignals > 0 && isFamilyAge
      ? "family-mainstream"
      : sensitiveSignals > 0 || (age != null && age >= 15)
        ? "watchlist-sensitive"
        : "seo-aeo"

  return { score, reasons, cautions, metricsCompleteness, category }
}

/**
 * Deux viviers, chacun avec sa propre borne, au lieu d'un seul `OR` suivi d'un
 * `take`.
 *
 * L'ancienne version listait six branches en `OR` dont `updatedAt >= -45j` —
 * qui ne filtrait rien du tout, puisque le job qualité nocturne touche chaque
 * ligne du catalogue. 11 544 lignes ressortaient, et ce qui choisissait
 * réellement les candidates était le `orderBy releaseDate desc` + `take 80`,
 * c'est-à-dire « les 80 dates de sortie les plus lointaines ». Le plafond
 * `futureCeiling` (+60 j) était contourné : au 25 septembre 2026 la fenêtre
 * allait jusqu'au 17 décembre **2031**, et le rapport proposait d'enrichir
 * Shrek 5 pendant que 58 des 66 fiches de qualité faible restaient invisibles.
 *
 * Désormais chaque vivier est borné pour ce qu'il est, et le budget de
 * l'arriéré ne peut plus être mangé par les sorties lointaines.
 */
const WINDOW_TAKE = 55
const BACKLOG_TAKE = 25

const CANDIDATE_INCLUDE = Prisma.validator<Prisma.MediaItemInclude>()({
  contentMetrics: {
    select: {
      whatParentsNeedToKnow: true,
      toneTags: true,
      pacing: true,
    },
  },
  _count: { select: { reviews: true } },
})

async function getCandidates(): Promise<{ selected: Candidate[]; matching: number }> {
  const now = new Date()
  const recentFloor = new Date(now)
  recentFloor.setDate(now.getDate() - 45)
  const futureCeiling = new Date(now)
  futureCeiling.setDate(now.getDate() + 60)

  // Vivier A — la fenêtre de sortie, le cœur du métier de cet agent.
  // Trié par date croissante : ce qui sort le plus tôt est ce sur quoi il
  // reste le moins de temps pour agir.
  const windowWhere: Prisma.MediaItemWhereInput = {
    type: { in: ["MOVIE", "TV", "GAME"] },
    posterUrl: { not: null },
    releaseDate: { gte: recentFloor, lte: futureCeiling },
  }

  // Vivier B — l'arriéré éditorial : fiches déjà sorties et incomplètes.
  // Réservé explicitement, sinon il ne remonte jamais.
  const backlogWhere: Prisma.MediaItemWhereInput = {
    type: { in: ["MOVIE", "TV", "GAME"] },
    posterUrl: { not: null },
    releaseDate: { lt: recentFloor },
    OR: [
      { dataQualityScore: { lt: 65 } },
      { expertAgeRec: null },
      { isEnriched: false },
    ],
  }

  const [windowItems, backlogItems, windowCount, backlogCount] = await Promise.all([
    prisma.mediaItem.findMany({
      where: windowWhere,
      include: CANDIDATE_INCLUDE,
      orderBy: [{ releaseDate: "asc" }, { updatedAt: "desc" }],
      take: WINDOW_TAKE,
    }),
    prisma.mediaItem.findMany({
      where: backlogWhere,
      include: CANDIDATE_INCLUDE,
      orderBy: [{ dataQualityScore: "asc" }, { updatedAt: "desc" }],
      take: BACKLOG_TAKE,
    }),
    prisma.mediaItem.count({ where: windowWhere }),
    prisma.mediaItem.count({ where: backlogWhere }),
  ])

  const seen = new Set<string>()
  const items = [...windowItems, ...backlogItems].filter((item) => {
    if (seen.has(item.id)) return false
    seen.add(item.id)
    return true
  })

  const scored = items
    .map((item) => {
      const scored = scoreCandidate(item)
      return {
        id: item.id,
        title: item.title,
        type: item.type,
        url: `${SITE_URL}/media/${toMediaRouteId(item.type, item.id)}`,
        releaseDate: item.releaseDate ? item.releaseDate.toISOString().slice(0, 10) : null,
        expertAgeRec: item.expertAgeRec,
        genres: item.genres,
        topics: item.topics,
        platforms: item.platforms,
        synopsisFr: item.synopsisFr,
        tmdbRating: item.tmdbRating,
        tmdbVoteCount: item.tmdbVoteCount,
        dataQualityScore: item.dataQualityScore,
        isEnriched: item.isEnriched,
        reviewCount: item._count.reviews,
        metricsCompleteness: scored.metricsCompleteness,
        priorityScore: scored.score,
        category: scored.category,
        reasons: scored.reasons,
        cautions: scored.cautions,
      }
    })
    .filter((candidate) => candidate.priorityScore >= 12)
    .sort((a, b) => {
      const categoryRank: Record<Candidate["category"], number> = {
        "family-mainstream": 0,
        "seo-aeo": 1,
        "watchlist-sensitive": 2,
      }
      return categoryRank[a.category] - categoryRank[b.category] || b.priorityScore - a.priorityScore
    })

  return { selected: scored.slice(0, MAX_SELECTED), matching: windowCount + backlogCount }
}

function buildFallbackReport(candidates: Candidate[]): string {
  const lines = [
    "# Agent sorties famille — propositions hebdomadaires",
    "",
    "Claude n'a pas répondu à temps. Voici la sélection déterministe à traiter en priorité :",
    "",
  ]

  for (const [index, candidate] of candidates.slice(0, 8).entries()) {
    lines.push(
      `## ${index + 1}. ${candidate.title}`,
      `- URL : ${candidate.url}`,
      `- Type : ${candidate.type}`,
      `- Priorité : ${candidate.priorityScore}`,
      `- Catégorie : ${candidate.category}`,
      `- Complétude : ${candidate.metricsCompleteness}/100`,
      `- Raisons : ${candidate.reasons.join(", ") || "signal éditorial"}`,
      candidate.cautions.length > 0 ? `- Vigilance : ${candidate.cautions.join(", ")}` : "",
      `- Action : vérifier la fiche, puis préparer un post “à partir de quel âge ?”`,
      "",
    )
  }

  return lines.join("\n")
}

/**
 * Plafond de sortie. 2600 tronquait systématiquement : le rapport du
 * 14 septembre 2026 s'arrêtait au milieu du mot « **Synthèse », celui du
 * 21 septembre au milieu du tableau SEO (« clarifier contenu sens »), perdant
 * la checklist finale que le prompt exige pourtant. `stop_reason` n'étant pas
 * lu, les deux runs se sont journalisés en `success`.
 */
const REPORT_MAX_TOKENS = 6000

/** Marge sous le `maxDuration = 120` de la route, sortie plus longue oblige. */
const REPORT_TIMEOUT_MS = 85_000

async function buildClaudeReport(
  candidates: Candidate[],
  matching: number,
): Promise<{ text: string; truncated: boolean } | null> {
  const anthropic = getAnthropic()
  const compactCandidates = candidates.map((candidate) => ({
    titre: candidate.title,
    type: candidate.type,
    url: candidate.url,
    sortie: candidate.releaseDate,
    age: candidate.expertAgeRec,
    genres: candidate.genres.slice(0, 5),
    themes: candidate.topics.slice(0, 8),
    plateformes: candidate.platforms.slice(0, 5),
    popularite: candidate.tmdbVoteCount,
    qualite: candidate.dataQualityScore,
    enrichi: candidate.isEnriched,
    avisParents: candidate.reviewCount,
    completude: candidate.metricsCompleteness,
    priorite: candidate.priorityScore,
    categorie: candidate.category,
    raisons: candidate.reasons,
    vigilances: candidate.cautions,
    synopsis: candidate.synopsisFr?.slice(0, 420) ?? null,
  }))

  const response = await callClaudeWithTimeout(
    (signal) =>
      anthropic.messages.create(
        {
          model: DEFAULT_MODEL,
          max_tokens: REPORT_MAX_TOKENS,
          temperature: 0.2,
          system:
            "Tu es l'agent éditorial de Totem Avisé. Tu aides un fondateur à prioriser les fiches média à vérifier et à promouvoir auprès de parents français. Tu privilégies les contenus vraiment utiles aux familles françaises, pas seulement les sorties adultes populaires. Tu dois être concret, prudent, orienté SEO/AEO et ne jamais proposer de publier automatiquement.",
          messages: [
            {
              role: "user",
              content: `Nous sommes le ${new Date().toLocaleDateString("fr-FR", { weekday: "long", day: "numeric", month: "long", year: "numeric" })}. Utilise cette date pour intituler la semaine — n'écris jamais un libellé générique du type « Semaine du [date] ».

Voici ${candidates.length} fiches candidates extraites de la base (sur ${matching} éligibles au total ; elles sont déjà triées par priorité, tu vois les plus urgentes). Produis un rapport hebdomadaire en 3 sections.

Sections obligatoires :
1. Priorités familles grand public : 3 à 5 contenus maximum, plutôt 3-13 ans, animation/famille/aventure/jeux connus/franchises famille. Ce sont les contenus à promouvoir en premier.
2. Contenus à surveiller : thrillers, horreur, crime, drame adulte, 15+/16+. Ils peuvent être importants mais ne doivent pas dominer la newsletter.
3. Opportunités SEO/AEO : requêtes simples et naturelles à cibler.

Contraintes :
- Réponds en français.
- Format markdown lisible par email.
- Pour chaque contenu : pourquoi maintenant, état de la fiche, action recommandée, requête SEO cible, angle social.
- N'invente jamais une plateforme, une date, un âge ou un niveau de violence absent du JSON.
- Si une fiche est déjà complète (complétude >= 90 ou qualité >= 85), l'action doit être "diffuser / vérifier indexation / demander avis", pas "enrichir".
- Les requêtes SEO doivent être courtes et naturelles, par exemple "[titre] à partir de quel âge", "[titre] avis parents", "[titre] enfant".
- Évite les emojis et hashtags dans les posts proposés. Donne un ton parent, sobre et utile.
- Ne recommande pas "solliciter des avis parents spécialisés" sauf si l'action est réaliste et précise.
- Termine par une checklist de 5 actions maximum pour Xavier.
- Ne recommande pas de publication automatique sans validation humaine.

Candidates JSON:
${JSON.stringify(compactCandidates, null, 2)}`,
            },
          ],
        },
        { signal },
      ),
    REPORT_TIMEOUT_MS,
    "family-content-agent",
  )

  const text = response?.content
    .map((block) => (block.type === "text" ? block.text : ""))
    .join("\n")
    .trim()

  if (!text) return null

  // Une coupe au plafond de tokens perd la fin du rapport — en pratique la
  // checklist d'actions, c'est-à-dire la seule partie directement actionnable.
  // Silencieux auparavant : on le remonte pour que le run se journalise en
  // `partial` et que le lecteur sache qu'il manque quelque chose.
  const truncated = response?.stop_reason === "max_tokens"
  return { text, truncated }
}

// ── Collections freshness (owner rule, July 2026) ─────────────────────
// Open-ended Top-X lists must always carry 1-2 titles under 12 months old,
// or they read as abandoned. Identity lists (timeless: true — Disney
// classiques, Ghibli, Noël…) are exempt. Deterministic (no LLM): appended
// to the Monday report so a stale list or a missed big release becomes a
// weekly nudge instead of something to remember.
const FRESHNESS_WINDOW_MONTHS = 12
// Les seuils de suggestion étaient calés sur 6 mois / 500 votes — hors
// d'atteinte pour une sortie récente : au 25 septembre 2026, le meilleur titre
// famille des six derniers mois plafonnait à 346 votes et AUCUN ne passait la
// barre. La section annonçait donc 7 listes à rafraîchir sans proposer un seul
// titre à y mettre. Un an / 100 votes rend 41 candidates sur le même
// catalogue, tout en écartant encore les sorties confidentielles.
const SUGGESTION_WINDOW_MONTHS = 12
const SUGGESTION_MIN_VOTES = 100

async function buildCollectionsFreshness(): Promise<string> {
  const now = new Date()
  const freshFloor = new Date(now)
  freshFloor.setMonth(now.getMonth() - FRESHNESS_WINDOW_MONTHS)
  const suggestFloor = new Date(now)
  suggestFloor.setMonth(now.getMonth() - SUGGESTION_WINDOW_MONTHS)

  const curated = COLLECTIONS.filter((c) => c.curatedIds?.length)
  const allCuratedIds = Array.from(new Set(curated.flatMap((c) => c.curatedIds!)))
  const items = await prisma.mediaItem.findMany({
    where: { id: { in: allCuratedIds } },
    select: { id: true, releaseDate: true },
  })
  const releaseById = new Map(items.map((i) => [i.id, i.releaseDate]))

  const stale: string[] = []
  for (const collection of curated) {
    if (collection.timeless) continue
    const freshCount = collection.curatedIds!.filter((id) => {
      const date = releaseById.get(id)
      return date != null && date >= freshFloor
    }).length
    if (freshCount === 0) {
      stale.push(
        `- « ${collection.title} » : aucun titre de moins de ${FRESHNESS_WINDOW_MONTHS} mois — ajouter 1-2 sorties récentes (src/lib/collections-data.ts).`,
      )
    }
  }

  // Big recent releases absent from EVERY curated list — candidates to slot in.
  const missing = await prisma.mediaItem.findMany({
    where: {
      type: { in: ["MOVIE", "GAME"] },
      releaseDate: { gte: suggestFloor, lte: now },
      expertAgeRec: { not: null, lte: 12 },
      tmdbVoteCount: { gte: SUGGESTION_MIN_VOTES },
      posterUrl: { not: null },
      id: { notIn: allCuratedIds },
      NOT: { genres: { hasSome: ["Horreur"] } },
    },
    select: { title: true, type: true, expertAgeRec: true, tmdbVoteCount: true, releaseDate: true },
    orderBy: { tmdbVoteCount: "desc" },
    take: 5,
  })

  const lines = ["", "## Fraîcheur des collections (Top 10)", ""]
  if (stale.length === 0) {
    lines.push(`Toutes les listes ouvertes contiennent au moins un titre récent (moins de ${FRESHNESS_WINDOW_MONTHS} mois).`)
  } else {
    lines.push(...stale)
  }
  if (missing.length > 0) {
    lines.push("", "Sorties récentes populaires absentes de toutes les collections :")
    for (const m of missing) {
      lines.push(
        `- ${m.title} (${m.type === "GAME" ? "jeu" : "film"}, ${m.expertAgeRec} ans, ${m.tmdbVoteCount} votes, sorti le ${m.releaseDate!.toISOString().slice(0, 10)})`,
      )
    }
  }
  return lines.join("\n")
}

export async function runFamilyContentAgent(): Promise<FamilyContentAgentResult> {
  const { selected, matching } = await getCandidates()

  let truncated = false
  let fellBack = false
  let body: string

  if (selected.length === 0) {
    body = "# Agent sorties famille\n\nAucune fiche candidate prioritaire détectée cette semaine."
  } else {
    const claude = await buildClaudeReport(selected, matching)
    if (claude) {
      body = claude.text
      truncated = claude.truncated
      if (truncated) {
        body += `\n\n---\n\n⚠️ **Rapport coupé.** La rédaction a atteint son plafond de longueur : la fin du rapport (souvent la checklist d'actions) manque. Les ${selected.length} fiches ci-dessus restent valides.`
      }
    } else {
      body = buildFallbackReport(selected)
      fellBack = true
    }
  }

  // Freshness audit is best-effort: a failure here must never block the
  // main editorial report.
  let freshness = ""
  try {
    freshness = await buildCollectionsFreshness()
  } catch (error) {
    console.error("[family-content-agent] collections freshness failed:", error)
  }

  const capped = matching > selected.length
  // Le sujet et la ligne de verdict annoncent la sélection ET la file réelle,
  // sinon un plafond constant se lit comme une mesure constante.
  const headline = capped
    ? `${selected.length} fiche(s) à traiter — ${matching} en file`
    : `${selected.length} fiche(s) à vérifier / promouvoir`

  const report = withVerdict(body + freshness, {
    count: selected.length,
    kind: "action",
    top: selected.length > 0 ? headline : undefined,
  })

  const subject = capped
    ? `Agent sorties famille — ${selected.length} fiches à traiter (${matching} en file)`
    : `Agent sorties famille — ${selected.length} fiches candidates`

  await sendEditorialAgentReport({ subject, report })

  return {
    candidatesSelected: selected.length,
    candidatesMatching: matching,
    capped,
    truncated,
    status: truncated || fellBack ? "partial" : "success",
    report,
  }
}
