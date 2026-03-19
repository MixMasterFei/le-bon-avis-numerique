import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { logCronRun } from "@/lib/cron-log"
import OpenAI from "openai"

export const maxDuration = 60 // Allow up to 60s for OpenAI batch processing

// Batch enrichment API - Enrich items that don't have content metrics
// Uses OpenAI GPT-5 Mini to generate age ratings, content analysis, and v2 metadata

interface EnrichmentResult {
  processed: number
  enriched: number
  skipped: number
  errors: number
  details: string[]
}

interface ContentAnalysis {
  expertAgeRec: number
  contentMetrics: {
    violence: number
    sexNudity: number
    language: number
    consumerism: number
    substanceUse: number
    positiveMessages: number
    roleModels: number
  }
  whatParentsNeedToKnow: string[]
  synopsis: string
  tags: string[]
  // V2 enrichment fields
  confidence: number
  confidenceReasons: string[]
  toneTags: string[]
  pacing: string
  visualStyle: string
  emotionalThemes: string[]
}

// Valid closed lists for enrichment fields
const VALID_TOPICS = [
  // Genres/themes
  "Animation", "Aventure", "Comédie", "Fantastique", "Science-Fiction",
  "Famille", "Éducatif", "Super-héros", "Magie", "Sport", "Musique",
  "Histoire", "Amitié",
  // Emotional/social
  "Émotions", "Courage", "Différence", "Handicap", "Deuil", "Divorce",
  "Harcèlement", "Premiers amours",
  // Life stages
  "École", "Adolescence",
  // Worlds/imagination
  "Espace", "Aviation", "Mythologie", "Contes", "Pirates", "Chevaliers",
  "Dinosaures", "Robots", "Enquête/Mystère", "Espionnage",
  // Nature/environment
  "Animaux", "Nature", "Écologie", "Mer/Océan", "Montagne", "Voyage",
  // Arts/culture
  "Cuisine", "Art", "Danse", "Théâtre",
  // History/society
  "Guerre", "Résistance", "Seconde Guerre mondiale",
  // Studios
  "Disney", "Pixar", "DreamWorks", "Studio Ghibli",
  // Seasonal
  "Noël", "Halloween",
  // Games
  "Nintendo", "PlayStation", "Xbox", "PC",
]

const VALID_TONE_TAGS = [
  "Doux et chaleureux", "Doux et rassurant", "Joyeux et coloré",
  "Drôle et léger", "Aventureux et exaltant", "Épique et grandiose",
  "Mystérieux et intrigant", "Sombre et tendu", "Nostalgique et poétique",
  "Action intense", "Effrayant et angoissant", "Romantique et tendre",
  "Fait réfléchir", "Inspiré et motivant", "Mélancolique et touchant",
]

const VALID_PACING = [
  "Très calme", "Lent et contemplatif", "Rythme modéré", "Dynamique", "Rapide et frénétique",
]

const VALID_VISUAL_STYLES = [
  "Animation 2D classique", "Animation 3D/CGI", "Stop motion", "Anime japonais",
  "Prise de vue réelle", "Mix animation/réel", "Pixelisé/rétro", "Style aquarelle/artistique",
]

const VALID_EMOTIONAL_THEMES = [
  "Dépassement de soi", "Acceptation de la différence", "Force de l'amitié",
  "Lien familial", "Perte et deuil", "Premiers amours", "Trouver sa place",
  "Combattre l'injustice", "Découverte du monde", "Surmonter ses peurs",
  "Responsabilité et maturité", "Liberté et indépendance", "Pardon et réconciliation",
  "Confiance en soi", "Solidarité et entraide",
]

function computeFinalConfidence(
  aiConfidence: number,
  item: { synopsis: string | null; genres: string[]; officialRating: string | null; tmdbVoteCount: number | null }
): { score: number; needsDeepEnrich: boolean } {
  let score = Math.min(1.0, Math.max(0.0, aiConfidence))

  // Heuristic adjustments based on input data quality
  if (!item.synopsis || item.synopsis.length < 50) score *= 0.7
  if (item.genres.length === 0) score *= 0.8
  if (!item.officialRating) score *= 0.9
  if (item.tmdbVoteCount && item.tmdbVoteCount > 1000) score = Math.min(1.0, score * 1.1)

  score = Math.round(score * 100) / 100

  return { score, needsDeepEnrich: score < 0.6 }
}

function filterToValidList(values: string[], validList: string[]): string[] {
  return values.filter((v) => validList.includes(v))
}

async function analyzeWithOpenAI(
  openai: OpenAI,
  item: {
    title: string
    originalTitle?: string | null
    type: string
    synopsis?: string | null
    genres: string[]
    releaseDate?: Date | null
    officialRating?: string | null
    tmdbVoteCount?: number | null
  },
  retryCount = 0
): Promise<ContentAnalysis> {
  const prompt = `Tu es un expert en evaluation de contenu mediatique pour les familles, similaire a Common Sense Media.
Analyse ce contenu et fournis une evaluation detaillee pour aider les parents.

CONTENU:
- Titre: ${item.title}
${item.originalTitle ? `- Titre original: ${item.originalTitle}` : ""}
- Type: ${item.type === "GAME" ? "Jeu video" : item.type === "TV" ? "Serie TV" : "Film"}
- Genres: ${item.genres.join(", ") || "Non specifie"}
${item.releaseDate ? `- Date de sortie: ${item.releaseDate.toISOString().split("T")[0]}` : ""}
${item.officialRating ? `- Classification officielle: ${item.officialRating}` : ""}
- Synopsis/Description (peut etre en anglais): ${item.synopsis || "Non disponible"}

IMPORTANT:
- Le synopsis que tu fournis DOIT etre en FRANCAIS (traduis si necessaire)
- Le synopsis ne doit JAMAIS reveler de spoilers, retournements ou fin de l'histoire. Decris uniquement la premisse et le contexte initial.
- Base ton analyse sur ta connaissance de ce ${item.type === "GAME" ? "jeu" : item.type === "TV" ? "cette serie" : "ce film"} si tu le connais

Tags possibles (choisis UNIQUEMENT parmi cette liste, en respectant exactement la casse — 3 a 8 tags par contenu):

GENRES/THEMES GENERAUX:
"Animation", "Aventure", "Comédie", "Fantastique", "Science-Fiction", "Famille", "Éducatif", "Super-héros", "Magie", "Sport", "Musique", "Histoire", "Amitié"

THEMES EMOTIONNELS ET SOCIAUX:
"Émotions", "Courage", "Différence", "Handicap", "Deuil", "Divorce", "Harcèlement", "Premiers amours"

TRANCHES DE VIE:
"École", "Adolescence"

UNIVERS ET IMAGINAIRE:
"Espace", "Aviation", "Mythologie", "Contes", "Pirates", "Chevaliers", "Dinosaures", "Robots", "Enquête/Mystère", "Espionnage"

NATURE ET ENVIRONNEMENT:
"Animaux" (SEULEMENT si les animaux sont les personnages principaux, ex: Le Roi Lion, Babe)
"Nature" (SEULEMENT pour documentaires nature ou films sur l'environnement)
"Écologie", "Mer/Océan", "Montagne", "Voyage"

ARTS ET CULTURE:
"Cuisine", "Art", "Danse", "Théâtre"

HISTOIRE ET SOCIETE:
"Guerre", "Résistance", "Seconde Guerre mondiale"

STUDIOS:
"Disney", "Pixar", "DreamWorks", "Studio Ghibli"

SAISONNIER:
"Noël", "Halloween"

JEUX:
"Nintendo", "PlayStation", "Xbox", "PC"

ATTENTION:
- Ne mets JAMAIS "Animaux" ou "Nature" pour les films d'horreur, thriller, fantastique sombre, ou science-fiction meme s'ils mentionnent des creatures, monstres, ou forets
- Privilegies les tags specifiques aux tags generiques (ex: "Dinosaures" plutot que "Aventure" seul)

TON ET AMBIANCE (choisis 1 a 3 tags parmi cette liste):
"Doux et chaleureux", "Doux et rassurant", "Joyeux et coloré", "Drôle et léger", "Aventureux et exaltant", "Épique et grandiose", "Mystérieux et intrigant", "Sombre et tendu", "Nostalgique et poétique", "Action intense", "Effrayant et angoissant", "Romantique et tendre", "Fait réfléchir", "Inspiré et motivant", "Mélancolique et touchant"

RYTHME (choisis exactement 1):
"Très calme", "Lent et contemplatif", "Rythme modéré", "Dynamique", "Rapide et frénétique"

STYLE VISUEL (choisis exactement 1):
"Animation 2D classique", "Animation 3D/CGI", "Stop motion", "Anime japonais", "Prise de vue réelle", "Mix animation/réel", "Pixelisé/rétro", "Style aquarelle/artistique"

THEMES EMOTIONNELS (choisis 1 a 4 — ce que le spectateur RESSENT):
"Dépassement de soi", "Acceptation de la différence", "Force de l'amitié", "Lien familial", "Perte et deuil", "Premiers amours", "Trouver sa place", "Combattre l'injustice", "Découverte du monde", "Surmonter ses peurs", "Responsabilité et maturité", "Liberté et indépendance", "Pardon et réconciliation", "Confiance en soi", "Solidarité et entraide"

CONFIANCE dans ton analyse (0.0 a 1.0):
- 0.9-1.0: Tu connais tres bien ce contenu et es certain de tes evaluations
- 0.7-0.8: Tu connais le contenu ou as assez d'informations pour une evaluation fiable
- 0.5-0.6: Tu as des informations limitees, certaines evaluations sont estimees
- 0.3-0.4: Tu ne connais pas ce contenu, tes evaluations sont basees uniquement sur le synopsis/genre
- 0.1-0.2: Information insuffisante, evaluation tres incertaine

Echelle des metriques: 0=Aucun, 1=Minimal, 2=Leger, 3=Modere, 4=Important, 5=Intense

Sois precis et base ton analyse sur les informations fournies ET ta connaissance du contenu.

REGLES DE LONGUEUR (OBLIGATOIRE):
- synopsis: 2-3 phrases, MAXIMUM 400 caracteres. Pas de resume exhaustif de l'intrigue.
- whatParentsNeedToKnow: exactement 3 a 5 points, chaque point = 1 phrase courte (max 120 caracteres)
- confidenceReasons: max 2 raisons courtes (10 mots max chacune), tableau vide si confidence >= 0.7
- tags: 3-8 tags de la liste ci-dessus, pas de texte libre

Reponds UNIQUEMENT avec un JSON valide (sans markdown) dans ce format exact:
{
  "expertAgeRec": <nombre entre 3 et 18>,
  "contentMetrics": {
    "violence": <0-5>,
    "sexNudity": <0-5>,
    "language": <0-5>,
    "consumerism": <0-5>,
    "substanceUse": <0-5>,
    "positiveMessages": <0-5>,
    "roleModels": <0-5>
  },
  "whatParentsNeedToKnow": ["<1 phrase, max 120 car>", "<idem>", "<idem>"],
  "synopsis": "<EN FRANCAIS, 2-3 phrases, max 400 car>",
  "tags": ["<tag1>", "<tag2>"],
  "confidence": <0.0-1.0>,
  "confidenceReasons": ["<10 mots max>"],
  "toneTags": ["<ton1>", "<ton2>"],
  "pacing": "<rythme>",
  "visualStyle": "<style>",
  "emotionalThemes": ["<theme1>", "<theme2>"]
}`

  try {
    const response = await openai.chat.completions.create({
      model: "gpt-5-mini",
      messages: [
        { role: "system", content: "Tu es un assistant spécialisé dans l'analyse de contenus médias pour les familles. Réponds toujours en JSON valide. Sois CONCIS : synopsis court (2-3 phrases, max 400 caractères), conseils parents courts (1 phrase chacun, max 120 caractères). Pas de texte superflu." },
        { role: "user", content: prompt },
      ],
      max_completion_tokens: 2000,
    })

    const content = response.choices[0]?.message?.content
    if (!content) {
      throw new Error("No response from OpenAI")
    }

    // Clean the response - remove markdown code blocks and any leading/trailing whitespace
    let cleanedContent = content
      .replace(/```json\n?/g, "")
      .replace(/```\n?/g, "")
      .trim()

    // Try to extract JSON if there's extra text
    const jsonMatch = cleanedContent.match(/\{[\s\S]*\}/)
    if (jsonMatch) {
      cleanedContent = jsonMatch[0]
    }

    let parsed
    try {
      parsed = JSON.parse(cleanedContent)
    } catch {
      // If JSON parsing fails, log the content for debugging
      console.error(`JSON parse error for "${item.title}":`, cleanedContent.substring(0, 200))
      throw new Error(`Invalid JSON response: ${cleanedContent.substring(0, 100)}...`)
    }

    // Post-processing: enforce length limits as safety net
    if (parsed.synopsis && parsed.synopsis.length > 500) {
      parsed.synopsis = parsed.synopsis.slice(0, 497) + "..."
    }
    if (Array.isArray(parsed.whatParentsNeedToKnow)) {
      parsed.whatParentsNeedToKnow = parsed.whatParentsNeedToKnow
        .slice(0, 5)
        .map((tip: string) => (tip.length > 150 ? tip.slice(0, 147) + "..." : tip))
    }
    if (Array.isArray(parsed.confidenceReasons)) {
      parsed.confidenceReasons = parsed.confidenceReasons.slice(0, 2)
    }

    return {
      expertAgeRec: Math.min(18, Math.max(3, parsed.expertAgeRec || 8)),
      contentMetrics: {
        violence: Math.min(5, Math.max(0, parsed.contentMetrics?.violence || 0)),
        sexNudity: Math.min(5, Math.max(0, parsed.contentMetrics?.sexNudity || 0)),
        language: Math.min(5, Math.max(0, parsed.contentMetrics?.language || 0)),
        consumerism: Math.min(5, Math.max(0, parsed.contentMetrics?.consumerism || 0)),
        substanceUse: Math.min(5, Math.max(0, parsed.contentMetrics?.substanceUse || 0)),
        positiveMessages: Math.min(5, Math.max(0, parsed.contentMetrics?.positiveMessages || 3)),
        roleModels: Math.min(5, Math.max(0, parsed.contentMetrics?.roleModels || 3)),
      },
      whatParentsNeedToKnow: Array.isArray(parsed.whatParentsNeedToKnow)
        ? parsed.whatParentsNeedToKnow.slice(0, 5)
        : [],
      synopsis: parsed.synopsis || item.synopsis || "",
      tags: Array.isArray(parsed.tags) ? parsed.tags : [],
      // V2 fields with validation
      confidence: typeof parsed.confidence === "number" ? Math.min(1.0, Math.max(0.0, parsed.confidence)) : 0.5,
      confidenceReasons: Array.isArray(parsed.confidenceReasons) ? parsed.confidenceReasons.slice(0, 3) : [],
      toneTags: filterToValidList(
        Array.isArray(parsed.toneTags) ? parsed.toneTags.slice(0, 3) : [],
        VALID_TONE_TAGS
      ),
      pacing: VALID_PACING.includes(parsed.pacing) ? parsed.pacing : "Rythme modéré",
      visualStyle: VALID_VISUAL_STYLES.includes(parsed.visualStyle) ? parsed.visualStyle : "",
      emotionalThemes: filterToValidList(
        Array.isArray(parsed.emotionalThemes) ? parsed.emotionalThemes.slice(0, 4) : [],
        VALID_EMOTIONAL_THEMES
      ),
    }
  } catch (error) {
    // Retry on rate limit or temporary errors (max 2 retries)
    if (retryCount < 2) {
      const isRateLimit = error instanceof Error &&
        (error.message.includes("rate") || error.message.includes("429") || error.message.includes("timeout"))

      if (isRateLimit) {
        // Wait longer for rate limit errors
        await new Promise((resolve) => setTimeout(resolve, 2000 * (retryCount + 1)))
        return analyzeWithOpenAI(openai, item, retryCount + 1)
      }
    }
    throw error
  }
}

export async function POST(request: NextRequest) {
  const startTime = Date.now()
  try {
    const body = await request.json()
    const {
      type = "all", // "movie", "tv", "game", or "all"
      limit = 10, // How many to process at once
      onlyMissing = true, // Only enrich items without contentMetrics
      onlyLegacy = false, // Only re-enrich items missing v2 fields (toneTags empty)
    } = body

    if (!process.env.OPENAI_API_KEY) {
      return NextResponse.json(
        { error: "OPENAI_API_KEY is not configured" },
        { status: 400 }
      )
    }

    const openai = new OpenAI({
      apiKey: process.env.OPENAI_API_KEY,
    })

    const result: EnrichmentResult = {
      processed: 0,
      enriched: 0,
      skipped: 0,
      errors: 0,
      details: [],
    }

    // Build query based on type
    const typeFilter = type === "all"
      ? {}
      : { type: type.toUpperCase() as "MOVIE" | "TV" | "GAME" }

    // Build where clause based on mode
    let whereClause
    if (onlyLegacy) {
      // Re-enrich items that have metrics but missing v2 fields
      whereClause = {
        ...typeFilter,
        contentMetrics: { isNot: null },
        OR: [
          { contentMetrics: { toneTags: { isEmpty: true } } },
          { contentMetrics: { enrichmentConfidence: null } },
        ],
      }
    } else if (onlyMissing) {
      whereClause = {
        ...typeFilter,
        contentMetrics: null,
      }
    } else {
      whereClause = typeFilter
    }

    // Find items to enrich
    const items = await prisma.mediaItem.findMany({
      where: whereClause,
      include: { contentMetrics: true },
      orderBy: onlyLegacy
        ? { tmdbVoteCount: { sort: "desc" as const, nulls: "last" as const } }
        : { createdAt: "desc" },
      take: Math.min(limit, 50), // Max 50 at a time
    })

    result.processed = items.length
    result.details.push(`Found ${items.length} items to enrich`)

    for (const item of items) {
      try {
        // Skip if already has metrics and onlyMissing is true
        if (onlyMissing && !onlyLegacy && item.contentMetrics) {
          result.skipped++
          continue
        }

        // Analyze with OpenAI
        const analysis = await analyzeWithOpenAI(openai, {
          title: item.title,
          originalTitle: item.originalTitle,
          type: item.type,
          synopsis: item.synopsisFr,
          genres: item.genres,
          releaseDate: item.releaseDate,
          officialRating: item.officialRating,
          tmdbVoteCount: item.tmdbVoteCount,
        })

        // Compute final confidence with heuristic adjustments
        const { score: finalConfidence, needsDeepEnrich } = computeFinalConfidence(
          analysis.confidence,
          {
            synopsis: item.synopsisFr,
            genres: item.genres,
            officialRating: item.officialRating,
            tmdbVoteCount: item.tmdbVoteCount,
          }
        )

        // Update the item
        await prisma.mediaItem.update({
          where: { id: item.id },
          data: {
            expertAgeRec: analysis.expertAgeRec,
            synopsisFr: analysis.synopsis || item.synopsisFr,
            topics: [...new Set([...item.topics, ...filterToValidList(analysis.tags, VALID_TOPICS)])],
            isEnriched: true,
          },
        })

        // Create or update content metrics with v2 fields
        await prisma.contentMetrics.upsert({
          where: { mediaId: item.id },
          update: {
            violence: analysis.contentMetrics.violence,
            sexNudity: analysis.contentMetrics.sexNudity,
            language: analysis.contentMetrics.language,
            consumerism: analysis.contentMetrics.consumerism,
            substanceUse: analysis.contentMetrics.substanceUse,
            positiveMessages: analysis.contentMetrics.positiveMessages,
            roleModels: analysis.contentMetrics.roleModels,
            whatParentsNeedToKnow: analysis.whatParentsNeedToKnow,
            // V2 fields
            enrichmentConfidence: finalConfidence,
            enrichmentSource: "AI_BASIC",
            needsDeepEnrich,
            toneTags: analysis.toneTags,
            pacing: analysis.pacing || null,
            visualStyle: analysis.visualStyle || null,
            emotionalThemes: analysis.emotionalThemes,
            pass1At: new Date(),
          },
          create: {
            mediaId: item.id,
            violence: analysis.contentMetrics.violence,
            sexNudity: analysis.contentMetrics.sexNudity,
            language: analysis.contentMetrics.language,
            consumerism: analysis.contentMetrics.consumerism,
            substanceUse: analysis.contentMetrics.substanceUse,
            positiveMessages: analysis.contentMetrics.positiveMessages,
            roleModels: analysis.contentMetrics.roleModels,
            whatParentsNeedToKnow: analysis.whatParentsNeedToKnow,
            // V2 fields
            enrichmentConfidence: finalConfidence,
            enrichmentSource: "AI_BASIC",
            needsDeepEnrich,
            toneTags: analysis.toneTags,
            pacing: analysis.pacing || null,
            visualStyle: analysis.visualStyle || null,
            emotionalThemes: analysis.emotionalThemes,
            pass1At: new Date(),
          },
        })

        result.enriched++
        result.details.push(`✓ Enriched: ${item.title} (age ${analysis.expertAgeRec}+, confidence ${finalConfidence}${needsDeepEnrich ? " → needs deep" : ""})`)

        // Delay to avoid rate limiting - longer for larger batches
        const delay = items.length > 20 ? 1000 : 500
        await new Promise((resolve) => setTimeout(resolve, delay))
      } catch (error) {
        result.errors++
        result.details.push(
          `✗ Error enriching ${item.title}: ${error instanceof Error ? error.message : "Unknown error"}`
        )
      }
    }

    await logCronRun({
      task: "enrich",
      status: result.errors > 0 ? "partial" : "success",
      summary: `${result.enriched} enrichis sur ${result.processed} (${type})`,
      details: { ...result, type },
      startTime,
    })

    return NextResponse.json({
      success: true,
      result,
    })
  } catch (error) {
    console.error("Enrichment error:", error)

    await logCronRun({
      task: "enrich",
      status: "error",
      summary: error instanceof Error ? error.message : "Enrichment failed",
      startTime,
    })

    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Enrichment failed" },
      { status: 500 }
    )
  }
}

// GET to check enrichment status including v2 confidence distribution
export async function GET() {
  const stats = await prisma.mediaItem.groupBy({
    by: ["type"],
    _count: { id: true },
  })

  const withMetrics = await prisma.mediaItem.count({
    where: { contentMetrics: { isNot: null } },
  })

  const withoutMetrics = await prisma.mediaItem.count({
    where: { contentMetrics: null },
  })

  // Also count items missing age recommendation (even if they have empty metrics)
  const withoutAgeRec = await prisma.mediaItem.count({
    where: {
      OR: [
        { expertAgeRec: null },
        { expertAgeRec: 0 },
      ],
    },
  })

  // V2: Confidence distribution
  const confidenceHigh = await prisma.contentMetrics.count({
    where: { enrichmentConfidence: { gte: 0.7 } },
  })
  const confidenceMedium = await prisma.contentMetrics.count({
    where: { enrichmentConfidence: { gte: 0.4, lt: 0.7 } },
  })
  const confidenceLow = await prisma.contentMetrics.count({
    where: { enrichmentConfidence: { lt: 0.4, not: null } },
  })
  const confidenceUnscored = await prisma.contentMetrics.count({
    where: { enrichmentConfidence: null },
  })
  const needsDeepEnrich = await prisma.contentMetrics.count({
    where: { needsDeepEnrich: true },
  })
  const deepEnriched = await prisma.contentMetrics.count({
    where: { enrichmentSource: "AI_DEEP" },
  })
  const hasV2Fields = await prisma.contentMetrics.count({
    where: { NOT: { toneTags: { isEmpty: true } } },
  })

  const recentlyEnriched = await prisma.mediaItem.findMany({
    where: { contentMetrics: { isNot: null } },
    orderBy: { updatedAt: "desc" },
    take: 5,
    select: {
      title: true,
      type: true,
      expertAgeRec: true,
      updatedAt: true,
    },
  })

  return NextResponse.json({
    stats: stats.reduce((acc, s) => ({ ...acc, [s.type]: s._count.id }), {}),
    enrichment: {
      withMetrics,
      withoutMetrics,
      withoutAgeRec,
      percentComplete: withMetrics + withoutMetrics > 0
        ? Math.round((withMetrics / (withMetrics + withoutMetrics)) * 100)
        : 0,
      // V2 stats
      confidenceDistribution: {
        high: confidenceHigh,
        medium: confidenceMedium,
        low: confidenceLow,
        unscored: confidenceUnscored,
      },
      needsDeepEnrich,
      deepEnriched,
      hasV2Fields,
    },
    recentlyEnriched,
  })
}
