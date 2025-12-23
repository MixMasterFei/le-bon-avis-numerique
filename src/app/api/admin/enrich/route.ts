import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { getMovieDetails, getTVDetails, getImageUrl, ImageSize } from "@/lib/tmdb"
import { getGameDetails, getIGDBImageUrl, getPegiRating } from "@/lib/igdb"
import OpenAI from "openai"

// Batch enrichment API - Enrich items that don't have content metrics
// Uses OpenAI to generate age ratings and content analysis

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
  tags: string[] // For thematic collections
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
  }
): Promise<ContentAnalysis> {
  const prompt = `Tu es un expert en evaluation de contenu mediatique pour les familles, similaire a Common Sense Media.
Analyse ce contenu et fournis une evaluation detaillee pour aider les parents.

CONTENU:
- Titre: ${item.title}
${item.originalTitle ? `- Titre original: ${item.originalTitle}` : ""}
- Type: ${item.type}
- Genres: ${item.genres.join(", ") || "Non specifie"}
${item.releaseDate ? `- Date de sortie: ${item.releaseDate.toISOString().split("T")[0]}` : ""}
${item.officialRating ? `- Classification officielle: ${item.officialRating}` : ""}
- Synopsis: ${item.synopsis || "Non disponible"}

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
  "whatParentsNeedToKnow": [
    "<conseil 1 en francais>",
    "<conseil 2 en francais>",
    "<conseil 3 en francais>"
  ],
  "synopsis": "<resume en francais de 2-3 phrases>",
  "tags": ["<tag1>", "<tag2>"]
}

Tags possibles: "famille", "noel", "halloween", "ete", "comedie-ado", "action", "educatif", "classique", "animation", "aventure", "fantastique", "super-heros", "disney", "pixar", "dreamworks", "studio-ghibli", "meilleur-${new Date().getFullYear()}"

Echelle des metriques: 0=Aucun, 1=Minimal, 2=Leger, 3=Modere, 4=Important, 5=Intense

Sois precis et base ton analyse sur les informations fournies.`

  const response = await openai.chat.completions.create({
    model: "gpt-4o-mini",
    messages: [{ role: "user", content: prompt }],
    temperature: 0.3,
    max_tokens: 1000,
  })

  const content = response.choices[0]?.message?.content
  if (!content) {
    throw new Error("No response from OpenAI")
  }

  const cleanedContent = content.replace(/```json\n?|\n?```/g, "").trim()
  const parsed = JSON.parse(cleanedContent)

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
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const {
      type = "all", // "movie", "tv", "game", or "all"
      limit = 10, // How many to process at once
      onlyMissing = true, // Only enrich items without contentMetrics
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

    // Find items to enrich
    const items = await prisma.mediaItem.findMany({
      where: {
        ...typeFilter,
        ...(onlyMissing ? { contentMetrics: null } : {}),
      },
      include: { contentMetrics: true },
      orderBy: { createdAt: "desc" },
      take: Math.min(limit, 50), // Max 50 at a time
    })

    result.processed = items.length
    result.details.push(`Found ${items.length} items to enrich`)

    for (const item of items) {
      try {
        // Skip if already has metrics and onlyMissing is true
        if (onlyMissing && item.contentMetrics) {
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
        })

        // Update the item
        await prisma.mediaItem.update({
          where: { id: item.id },
          data: {
            expertAgeRec: analysis.expertAgeRec,
            synopsisFr: analysis.synopsis || item.synopsisFr,
            topics: [...new Set([...item.topics, ...analysis.tags])],
          },
        })

        // Create or update content metrics
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
          },
        })

        result.enriched++
        result.details.push(`✓ Enriched: ${item.title} (age ${analysis.expertAgeRec}+)`)

        // Small delay to avoid rate limiting
        await new Promise((resolve) => setTimeout(resolve, 500))
      } catch (error) {
        result.errors++
        result.details.push(
          `✗ Error enriching ${item.title}: ${error instanceof Error ? error.message : "Unknown error"}`
        )
      }
    }

    return NextResponse.json({
      success: true,
      result,
    })
  } catch (error) {
    console.error("Enrichment error:", error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Enrichment failed" },
      { status: 500 }
    )
  }
}

// GET to check enrichment status
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
      percentComplete: withMetrics + withoutMetrics > 0
        ? Math.round((withMetrics / (withMetrics + withoutMetrics)) * 100)
        : 0,
    },
    recentlyEnriched,
  })
}
