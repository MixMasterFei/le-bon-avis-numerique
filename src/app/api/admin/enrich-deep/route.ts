import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { isCronOrAdminAuthorized } from "@/lib/cron-auth"
import { logCronRun } from "@/lib/cron-log"
import OpenAI from "openai"

export const maxDuration = 60

// Pass 2: Deep enrichment using GPT-5 with web search
// Targets low-confidence items flagged by Pass 1, verifies and corrects metrics

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

function filterToValidList(values: string[], validList: string[]): string[] {
  return values.filter((v) => validList.includes(v))
}

interface DeepAnalysis {
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
  confidence: number
  toneTags: string[]
  pacing: string
  visualStyle: string
  emotionalThemes: string[]
  corrections: string[]
}

async function deepEnrichWithOpenAI(
  openai: OpenAI,
  item: {
    title: string
    originalTitle?: string | null
    type: string
    synopsis?: string | null
    genres: string[]
    releaseDate?: Date | null
    officialRating?: string | null
  },
  existingMetrics: {
    violence: number
    sexNudity: number
    language: number
    consumerism: number
    substanceUse: number
    positiveMessages: number
    roleModels: number
    toneTags: string[]
    pacing: string | null
    emotionalThemes: string[]
    enrichmentConfidence: number | null
  },
  retryCount = 0
): Promise<DeepAnalysis> {
  const prompt = `Tu es un expert senior en evaluation de contenu mediatique pour les familles francophones.

IMPORTANT: Une premiere analyse automatique a ete effectuee mais avec une confiance faible (${existingMetrics.enrichmentConfidence ?? "inconnue"}).
Tu dois VERIFIER et CORRIGER cette analyse en te basant sur ta connaissance approfondie du contenu.
Utilise la recherche web si necessaire pour verifier les informations.

CONTENU:
- Titre: ${item.title}
${item.originalTitle ? `- Titre original: ${item.originalTitle}` : ""}
- Type: ${item.type === "GAME" ? "Jeu video" : item.type === "TV" ? "Serie TV" : "Film"}
- Genres: ${item.genres.join(", ") || "Non specifie"}
${item.releaseDate ? `- Date de sortie: ${item.releaseDate.toISOString().split("T")[0]}` : ""}
${item.officialRating ? `- Classification officielle: ${item.officialRating}` : ""}
- Synopsis: ${item.synopsis || "Non disponible"}

ANALYSE PRECEDENTE A VERIFIER:
- Violence: ${existingMetrics.violence}/5, Sexe: ${existingMetrics.sexNudity}/5, Langage: ${existingMetrics.language}/5
- Consumerisme: ${existingMetrics.consumerism}/5, Substances: ${existingMetrics.substanceUse}/5
- Messages positifs: ${existingMetrics.positiveMessages}/5, Modeles: ${existingMetrics.roleModels}/5
- Ton: ${existingMetrics.toneTags.join(", ") || "non defini"}
- Rythme: ${existingMetrics.pacing || "non defini"}
- Themes emotionnels: ${existingMetrics.emotionalThemes.join(", ") || "non defini"}

INSTRUCTIONS:
1. Si tu connais ce contenu, corrige TOUTES les metriques incorrectes
2. Fournis un synopsis DETAILLE en francais (4-5 phrases, max 600 caracteres, pas un resume generique). JAMAIS de spoilers, retournements ou fin — uniquement la premisse.
3. Ajoute des conseils parents SPECIFIQUES (4-6 points, max 150 car chacun — mentionne des scenes ou moments precis si possible)
4. Re-evalue la confiance avec ta connaissance directe
5. Liste les corrections apportees (max 3, courtes)

TON ET AMBIANCE (choisis 1 a 3):
"Doux et chaleureux", "Doux et rassurant", "Joyeux et coloré", "Drôle et léger", "Aventureux et exaltant", "Épique et grandiose", "Mystérieux et intrigant", "Sombre et tendu", "Nostalgique et poétique", "Action intense", "Effrayant et angoissant", "Romantique et tendre", "Fait réfléchir", "Inspiré et motivant", "Mélancolique et touchant"

RYTHME (exactement 1): "Très calme", "Lent et contemplatif", "Rythme modéré", "Dynamique", "Rapide et frénétique"

STYLE VISUEL (exactement 1): "Animation 2D classique", "Animation 3D/CGI", "Stop motion", "Anime japonais", "Prise de vue réelle", "Mix animation/réel", "Pixelisé/rétro", "Style aquarelle/artistique"

THEMES EMOTIONNELS (1 a 4): "Dépassement de soi", "Acceptation de la différence", "Force de l'amitié", "Lien familial", "Perte et deuil", "Premiers amours", "Trouver sa place", "Combattre l'injustice", "Découverte du monde", "Surmonter ses peurs", "Responsabilité et maturité", "Liberté et indépendance", "Pardon et réconciliation", "Confiance en soi", "Solidarité et entraide"

Echelle des metriques: 0=Aucun, 1=Minimal, 2=Leger, 3=Modere, 4=Important, 5=Intense

Reponds UNIQUEMENT avec un JSON valide:
{
  "expertAgeRec": <3-18>,
  "contentMetrics": { "violence": <0-5>, "sexNudity": <0-5>, "language": <0-5>, "consumerism": <0-5>, "substanceUse": <0-5>, "positiveMessages": <0-5>, "roleModels": <0-5> },
  "whatParentsNeedToKnow": ["<conseil specifique, max 150 car>", "<idem>", "<idem>", "<idem>"],
  "synopsis": "<synopsis detaille en francais, 4-5 phrases, max 600 car>",
  "tags": ["<tag1>", "<tag2>"],
  "confidence": <0.0-1.0>,
  "toneTags": ["<ton1>", "<ton2>"],
  "pacing": "<rythme>",
  "visualStyle": "<style>",
  "emotionalThemes": ["<theme1>", "<theme2>"],
  "corrections": ["<ce qui a ete corrige par rapport a l'analyse precedente>"]
}`

  try {
    // Use Responses API with web search tool
    const response = await openai.responses.create({
      model: "gpt-5",
      tools: [{ type: "web_search_preview" as const }],
      input: prompt,
      max_output_tokens: 1500,
    })

    const content = response.output_text
    if (!content) {
      throw new Error("No response from OpenAI")
    }

    // Clean and parse JSON
    let cleanedContent = content
      .replace(/```json\n?/g, "")
      .replace(/```\n?/g, "")
      .trim()

    const jsonMatch = cleanedContent.match(/\{[\s\S]*\}/)
    if (jsonMatch) {
      cleanedContent = jsonMatch[0]
    }

    let parsed
    try {
      parsed = JSON.parse(cleanedContent)
    } catch {
      console.error(`Deep enrich JSON parse error for "${item.title}":`, cleanedContent.substring(0, 200))
      throw new Error(`Invalid JSON response: ${cleanedContent.substring(0, 100)}...`)
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
        ? parsed.whatParentsNeedToKnow.slice(0, 6)
        : [],
      synopsis: parsed.synopsis || "",
      tags: Array.isArray(parsed.tags) ? parsed.tags : [],
      confidence: typeof parsed.confidence === "number" ? Math.min(1.0, Math.max(0.0, parsed.confidence)) : 0.7,
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
      corrections: Array.isArray(parsed.corrections) ? parsed.corrections.slice(0, 5) : [],
    }
  } catch (error) {
    if (retryCount < 1) {
      const isRetryable = error instanceof Error &&
        (error.message.includes("rate") || error.message.includes("429") || error.message.includes("timeout"))
      if (isRetryable) {
        await new Promise((resolve) => setTimeout(resolve, 3000))
        return deepEnrichWithOpenAI(openai, item, existingMetrics, retryCount + 1)
      }
    }
    throw error
  }
}

// POST: Run deep enrichment on flagged items
export async function POST(request: NextRequest) {
  const startTime = Date.now()

  if (!(await isCronOrAdminAuthorized(request))) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  try {
    const body = await request.json()
    const { limit = 5 } = body

    if (!process.env.OPENAI_API_KEY) {
      return NextResponse.json({ error: "OPENAI_API_KEY is not configured" }, { status: 400 })
    }

    const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY })

    // Find items flagged for deep enrichment, prioritized by popularity
    const items = await prisma.mediaItem.findMany({
      where: {
        isEnriched: true,
        contentMetrics: { needsDeepEnrich: true },
      },
      include: { contentMetrics: true },
      orderBy: { tmdbVoteCount: { sort: "desc", nulls: "last" } },
      take: Math.min(limit, 10),
    })

    const remaining = await prisma.contentMetrics.count({
      where: { needsDeepEnrich: true },
    })

    const result = { processed: items.length, enriched: 0, errors: 0, details: [] as string[] }

    for (const item of items) {
      if (!item.contentMetrics) continue

      try {
        const analysis = await deepEnrichWithOpenAI(
          openai,
          {
            title: item.title,
            originalTitle: item.originalTitle,
            type: item.type,
            synopsis: item.synopsisFr,
            genres: item.genres,
            releaseDate: item.releaseDate,
            officialRating: item.officialRating,
          },
          {
            violence: item.contentMetrics.violence,
            sexNudity: item.contentMetrics.sexNudity,
            language: item.contentMetrics.language,
            consumerism: item.contentMetrics.consumerism,
            substanceUse: item.contentMetrics.substanceUse,
            positiveMessages: item.contentMetrics.positiveMessages,
            roleModels: item.contentMetrics.roleModels,
            toneTags: item.contentMetrics.toneTags,
            pacing: item.contentMetrics.pacing,
            emotionalThemes: item.contentMetrics.emotionalThemes,
            enrichmentConfidence: item.contentMetrics.enrichmentConfidence,
          }
        )

        // Update MediaItem
        await prisma.mediaItem.update({
          where: { id: item.id },
          data: {
            expertAgeRec: analysis.expertAgeRec,
            synopsisFr: analysis.synopsis || item.synopsisFr,
            topics: [...new Set([...item.topics, ...analysis.tags])],
          },
        })

        // Overwrite ContentMetrics with deep enrichment results
        await prisma.contentMetrics.update({
          where: { mediaId: item.id },
          data: {
            violence: analysis.contentMetrics.violence,
            sexNudity: analysis.contentMetrics.sexNudity,
            language: analysis.contentMetrics.language,
            consumerism: analysis.contentMetrics.consumerism,
            substanceUse: analysis.contentMetrics.substanceUse,
            positiveMessages: analysis.contentMetrics.positiveMessages,
            roleModels: analysis.contentMetrics.roleModels,
            whatParentsNeedToKnow: analysis.whatParentsNeedToKnow,
            enrichmentConfidence: analysis.confidence,
            enrichmentSource: "AI_DEEP",
            needsDeepEnrich: false,
            toneTags: analysis.toneTags,
            pacing: analysis.pacing || null,
            visualStyle: analysis.visualStyle || null,
            emotionalThemes: analysis.emotionalThemes,
            pass2At: new Date(),
          },
        })

        result.enriched++
        const correctionSummary = analysis.corrections.length > 0
          ? ` [corrections: ${analysis.corrections.join("; ")}]`
          : ""
        result.details.push(`✓ Deep: ${item.title} (confidence ${analysis.confidence}${correctionSummary})`)

        // Rate limit between items
        await new Promise((resolve) => setTimeout(resolve, 1000))
      } catch (error) {
        result.errors++
        result.details.push(
          `✗ Error: ${item.title}: ${error instanceof Error ? error.message : "Unknown error"}`
        )
      }
    }

    await logCronRun({
      task: "enrich-deep",
      status: result.errors > 0 ? "partial" : "success",
      summary: `${result.enriched} deep-enrichis sur ${result.processed}`,
      details: result,
      startTime,
    })

    return NextResponse.json({
      success: true,
      result,
      remaining: remaining - result.enriched,
    })
  } catch (error) {
    console.error("Deep enrichment error:", error)

    await logCronRun({
      task: "enrich-deep",
      status: "error",
      summary: error instanceof Error ? error.message : "Deep enrichment failed",
      startTime,
    })

    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Deep enrichment failed" },
      { status: 500 }
    )
  }
}

// PATCH: Manually flag items for deep enrichment
export async function PATCH(request: NextRequest) {
  if (!(await isCronOrAdminAuthorized(request))) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  try {
    const body = await request.json()
    const { mediaIds } = body as { mediaIds: string[] }

    if (!Array.isArray(mediaIds) || mediaIds.length === 0) {
      return NextResponse.json({ error: "mediaIds array required" }, { status: 400 })
    }

    const updated = await prisma.contentMetrics.updateMany({
      where: { mediaId: { in: mediaIds } },
      data: { needsDeepEnrich: true },
    })

    return NextResponse.json({
      success: true,
      flagged: updated.count,
    })
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to flag items" },
      { status: 500 }
    )
  }
}
