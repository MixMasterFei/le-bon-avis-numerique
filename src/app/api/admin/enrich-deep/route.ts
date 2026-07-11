import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { isCronOrAdminAuthorized } from "@/lib/cron-auth"
import { logCronRun } from "@/lib/cron-log"
import { VALID_SENSITIVE_WARNINGS } from "@/lib/sensitive-warnings"
import { applyContentSafetyFloors } from "@/lib/content-safety-floors"
import OpenAI from "openai"

// Each item runs a web-search-enabled gpt-4o call (~15-30 s) plus Prisma
// writes. Default batch of 3 = ~60-90 s, which blew past the 60 s ceiling.
// Bumped to 300 s (5 min, Vercel Pro) to match the CNC import endpoint.
export const maxDuration = 300

// Pass 2: Deep enrichment — refines low-confidence items from Pass 1 using
// a sharper model with web search. Model: gpt-4o (noticeably sharper than
// the mini used in Pass 1; cost negligible at ~3 items/day).

const VALID_TOPICS = [
  "Animation", "Aventure", "Comédie", "Fantastique", "Science-Fiction",
  "Famille", "Éducatif", "Super-héros", "Magie", "Sport", "Musique",
  "Histoire", "Amitié",
  "Émotions", "Courage", "Différence", "Handicap", "Deuil", "Divorce",
  "Harcèlement", "Premiers amours",
  "École", "Adolescence",
  "Espace", "Aviation", "Mythologie", "Contes", "Pirates", "Chevaliers",
  "Dinosaures", "Robots", "Enquête/Mystère", "Espionnage",
  "Animaux", "Nature", "Écologie", "Mer/Océan", "Montagne", "Voyage",
  "Cuisine", "Art", "Danse", "Théâtre",
  "Guerre", "Résistance", "Seconde Guerre mondiale",
  "Disney", "Pixar", "DreamWorks", "Studio Ghibli",
  "Aardman", "Illumination", "Laika",
  "LEGO", "Minecraft", "Astérix", "Tintin",
  "Noël", "Halloween",
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
  sensitiveWarnings: string[]
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
    // Persisted deterministic signals — REQUIRED by the safety floor. topics
    // carries the reliable IGDB-derived "Horreur"/"Guerre" tags; pegiDescriptors
    // carries the official content flags. Omitting them is exactly how deep
    // enrich used to silently lower correctly-floored horror titles.
    topics?: string[] | null
    pegiDescriptors?: string[] | null
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

POINTS A SURVEILLER — "Ce qui peut marquer" (0 a 6 categories, UNIQUEMENT dans cette liste, casse exacte):
${VALID_SENSITIVE_WARNINGS.map((w) => `"${w}"`).join(", ")}
Reperes de vigilance prudents (categories seulement, jamais de scene precise inventee). Renvoie [] si rien de pertinent.

ECHELLE DES METRIQUES (0-5) — calibree pour une sensibilite FAMILIALE.
Distingue TOUJOURS le contenu STYLISE (animation, cartoon, fantastique, super-heros sans consequence reelle) du contenu REALISTE / GRAPHIQUE.
- Violence: 0=aucune. 1-2=peril leger, slapstick, bagarres cartoon/animees sans sang. 3=bagarres repetees, armes, mort hors-champ. 4=violence realiste, sang, blessures. 5=gore, torture, morts graphiques.
- Sexe/Sensualite: 0=aucun. 1-2=romance, baisers. 3=sensualite marquee, nudite suggeree. 4=sexe implicite/nudite. 5=explicite.
- Langage: 0=aucun. 1-2=quelques mots familiers. 3=insultes regulieres. 4=grossier frequent. 5=tres cru/haineux.
- Substances: 0=aucune. 1-2=alcool en arriere-plan. 3=consommation montree. 4=abus au coeur du recit. 5=glorifie.
- Achats integres (jeux): 0=aucun. 1-2=cosmetiques. 3=microtransactions presentes. 4-5=pay-to-win/loot boxes.
COHERENCE AGE <-> METRIQUES: tes scores et l'age conseille doivent rester coherents. Un titre adapte des 6-8 ans ne porte pas de score > 2 sur un axe sauf scene precise ; si un axe te semble a 3+, releve plutot l'age. L'age prime, les axes sont secondaires.
CLASSIFICATION OFFICIELLE = indice FAIBLE (souvent absente ou imprecise) : ne la suis pas aveuglement, ta connaissance du titre prime.

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
  "sensitiveWarnings": ["<categorie de la liste>", "..."],
  "corrections": ["<ce qui a ete corrige par rapport a l'analyse precedente>"]
}`

  try {
    // Use Responses API with web search tool
    const response = await openai.responses.create({
      model: "gpt-4o",
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
      // OpenAI's safety filter sometimes returns plain refusal text
      // ("I'm sorry, I can't assist with that") instead of JSON. Tag
      // these so the outer handler can soft-skip them — they're not
      // bugs, just titles the model won't analyze.
      const isRefusal = /^(i'?m sorry|i cannot|i can'?t|sorry,)/i.test(cleanedContent.trim())
      if (isRefusal) {
        const err = new Error(`AI_REFUSED: ${cleanedContent.substring(0, 100)}`)
        ;(err as Error & { isRefusal?: boolean }).isRefusal = true
        throw err
      }
      console.error(`Deep enrich JSON parse error for "${item.title}":`, cleanedContent.substring(0, 200))
      throw new Error(`Invalid JSON response: ${cleanedContent.substring(0, 100)}...`)
    }

    // Deterministic safety stack (PEGI axis floors → age floor → young-age
    // metric clamp), shared verbatim with the basic enrich route via
    // content-safety-floors.ts. topics MUST union the item's PERSISTED topics
    // (the reliable IGDB-derived "Horreur" signal) with the fresh tags, and the
    // official PEGI descriptors must be passed too — the previous version here
    // floored on `parsed.tags` alone with no PEGI descriptors, which silently
    // LOWERED correctly-floored horror titles on the nightly deep pass (the
    // exact bug fixed in the basic route on 2026-07-11, previously unfixed here).
    const rawAxis = (v: unknown) =>
      Math.min(5, Math.max(0, typeof v === "number" ? v : 0))
    const { expertAgeRec: expertAge, metrics: flooredMetrics } = applyContentSafetyFloors({
      expertAgeRec: Math.min(18, Math.max(3, parsed.expertAgeRec || 8)),
      metrics: {
        violence: rawAxis(parsed.contentMetrics?.violence),
        sexNudity: rawAxis(parsed.contentMetrics?.sexNudity),
        language: rawAxis(parsed.contentMetrics?.language),
        consumerism: Math.min(5, Math.max(0, parsed.contentMetrics?.consumerism || 0)),
        substanceUse: rawAxis(parsed.contentMetrics?.substanceUse),
        positiveMessages: Math.min(5, Math.max(0, parsed.contentMetrics?.positiveMessages || 3)),
        roleModels: Math.min(5, Math.max(0, parsed.contentMetrics?.roleModels || 3)),
      },
      genres: item.genres,
      topics: [...(item.topics ?? []), ...(Array.isArray(parsed.tags) ? parsed.tags : [])],
      visualStyle: typeof parsed.visualStyle === "string" ? parsed.visualStyle : null,
      type: item.type,
      officialRating: item.officialRating,
      pegiDescriptors: item.pegiDescriptors,
    })

    return {
      expertAgeRec: expertAge,
      contentMetrics: flooredMetrics,
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
      sensitiveWarnings: filterToValidList(
        Array.isArray(parsed.sensitiveWarnings) ? parsed.sensitiveWarnings.slice(0, 6) : [],
        VALID_SENSITIVE_WARNINGS as unknown as string[]
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

    const result = {
      processed: items.length,
      enriched: 0,
      errors: 0,
      // OpenAI sometimes refuses (safety filter) on borderline content.
      // We track those separately so they don't pollute the error count
      // — they're soft-skipped and removed from the queue.
      refused: 0,
      details: [] as string[],
    }

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
            topics: item.topics,
            pegiDescriptors: item.pegiDescriptors,
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
            topics: [...new Set([...item.topics, ...filterToValidList(analysis.tags, VALID_TOPICS)])],
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
            sensitiveWarnings: analysis.sensitiveWarnings,
            sensitiveWarningsAt: new Date(),
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
        const isRefusal =
          error instanceof Error && (error as Error & { isRefusal?: boolean }).isRefusal === true

        if (isRefusal) {
          // Remove from queue so we don't re-attempt the same item every
          // night — the model isn't going to change its mind. Admin can
          // manually enrich via the UI if they want.
          try {
            await prisma.contentMetrics.update({
              where: { mediaId: item.id },
              data: { needsDeepEnrich: false },
            })
          } catch {
            // Non-fatal — worst case we retry next run.
          }
          result.refused++
          result.details.push(`⊘ Refused: ${item.title} (skipped, removed from queue)`)
        } else {
          result.errors++
          result.details.push(
            `✗ Error: ${item.title}: ${error instanceof Error ? error.message : "Unknown error"}`
          )
        }
      }
    }

    await logCronRun({
      task: "enrich-deep",
      // Refusals don't count as failures — they're a normal outcome for
      // borderline content. Only real errors flip status to "partial".
      status: result.errors > 0 ? "partial" : "success",
      summary: `${result.enriched} deep-enrichis sur ${result.processed}${result.refused > 0 ? ` (${result.refused} refusés)` : ""}`,
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
