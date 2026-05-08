import { prisma } from "@/lib/prisma"
import { getAnthropic, DEFAULT_MODEL } from "@/lib/anthropic"
import { callClaudeWithTimeout } from "@/lib/anthropic-with-timeout"
import { sendEditorialAgentReport } from "@/lib/email"
import { toMediaRouteId } from "@/lib/media-route"

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
  candidatesFound: number
  candidatesSent: number
  report: string
}

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

async function getCandidates(): Promise<Candidate[]> {
  const now = new Date()
  const recentFloor = new Date(now)
  recentFloor.setDate(now.getDate() - 45)
  const futureCeiling = new Date(now)
  futureCeiling.setDate(now.getDate() + 60)

  const items = await prisma.mediaItem.findMany({
    where: {
      type: { in: ["MOVIE", "TV", "GAME"] },
      posterUrl: { not: null },
      OR: [
        { releaseDate: { gte: recentFloor, lte: futureCeiling } },
        { createdAt: { gte: recentFloor } },
        { updatedAt: { gte: recentFloor } },
        { dataQualityScore: { lt: 65 } },
        { expertAgeRec: null },
        { isEnriched: false },
      ],
    },
    include: {
      contentMetrics: {
        select: {
          whatParentsNeedToKnow: true,
          toneTags: true,
          pacing: true,
        },
      },
      _count: { select: { reviews: true } },
    },
    orderBy: [
      { releaseDate: { sort: "desc", nulls: "last" } },
      { updatedAt: "desc" },
    ],
    take: 80,
  })

  return items
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
    .slice(0, 24)
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

async function buildClaudeReport(candidates: Candidate[]): Promise<string | null> {
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
          max_tokens: 2600,
          temperature: 0.2,
          system:
            "Tu es l'agent éditorial de Totem Avisé. Tu aides un fondateur à prioriser les fiches média à vérifier et à promouvoir auprès de parents français. Tu privilégies les contenus vraiment utiles aux familles françaises, pas seulement les sorties adultes populaires. Tu dois être concret, prudent, orienté SEO/AEO et ne jamais proposer de publier automatiquement.",
          messages: [
            {
              role: "user",
              content: `Voici les fiches candidates extraites de la base. Produis un rapport hebdomadaire en 3 sections.

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
    45_000,
    "family-content-agent",
  )

  const text = response?.content
    .map((block) => (block.type === "text" ? block.text : ""))
    .join("\n")
    .trim()

  return text || null
}

export async function runFamilyContentAgent(): Promise<FamilyContentAgentResult> {
  const candidates = await getCandidates()
  const report =
    candidates.length > 0
      ? (await buildClaudeReport(candidates)) ?? buildFallbackReport(candidates)
      : "# Agent sorties famille\n\nAucune fiche candidate prioritaire détectée cette semaine."

  await sendEditorialAgentReport({
    subject: `Agent sorties famille — ${candidates.length} fiches candidates`,
    report,
  })

  return {
    candidatesFound: candidates.length,
    candidatesSent: Math.min(candidates.length, 18),
    report,
  }
}
