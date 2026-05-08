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
  reasons: string[]
}

export type FamilyContentAgentResult = {
  candidatesFound: number
  candidatesSent: number
  report: string
}

const SITE_URL = process.env.NEXT_PUBLIC_APP_URL || "https://totemavise.com"

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
}): { score: number; reasons: string[]; metricsCompleteness: number } {
  const now = new Date()
  let score = 0
  const reasons: string[] = []

  if (item.releaseDate) {
    const delta = daysBetween(item.releaseDate, now)
    if (delta >= -21 && delta <= 45) {
      score += 35
      reasons.push(delta >= 0 ? "sortie à venir" : "sortie récente")
    }
  }

  const voteCount = item.tmdbVoteCount ?? 0
  if (voteCount >= 1000) {
    score += 18
    reasons.push("fort signal de popularité")
  } else if (voteCount >= 200) {
    score += 10
    reasons.push("popularité correcte")
  }

  if (item.expertAgeRec == null) {
    score += 18
    reasons.push("âge recommandé manquant")
  }
  if (!item.isEnriched || !item.contentMetrics) {
    score += 18
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
    score += 4
    reasons.push("aucun avis parent")
  }

  const metricsCompleteness =
    (item.contentMetrics ? 30 : 0) +
    (item.expertAgeRec != null ? 20 : 0) +
    (item.synopsisFr && item.synopsisFr.length >= 180 ? 15 : 0) +
    (item.topics.length >= 3 ? 15 : 0) +
    ((item.contentMetrics?.whatParentsNeedToKnow.length ?? 0) >= 3 ? 20 : 0)

  return { score, reasons, metricsCompleteness }
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
        reasons: scored.reasons,
      }
    })
    .filter((candidate) => candidate.priorityScore >= 18)
    .sort((a, b) => b.priorityScore - a.priorityScore)
    .slice(0, 18)
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
      `- Complétude : ${candidate.metricsCompleteness}/100`,
      `- Raisons : ${candidate.reasons.join(", ") || "signal éditorial"}`,
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
    raisons: candidate.reasons,
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
            "Tu es l'agent éditorial de Totem Avisé. Tu aides un fondateur à prioriser les fiches média à vérifier et à promouvoir auprès de parents français. Tu dois être concret, prudent, orienté SEO/AEO et ne jamais proposer de publier automatiquement.",
          messages: [
            {
              role: "user",
              content: `Voici les fiches candidates extraites de la base. Sélectionne les 5 meilleures priorités de la semaine, puis propose des requêtes SEO long-tail et des posts courts à valider.

Contraintes :
- Réponds en français.
- Format markdown lisible par email.
- Pour chaque priorité : pourquoi maintenant, état de la fiche, action recommandée, requête SEO cible, angle social.
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
