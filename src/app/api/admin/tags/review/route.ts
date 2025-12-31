import { NextRequest, NextResponse } from "next/server"
import { auth } from "@/lib/auth"
import { prisma } from "@/lib/prisma"
import OpenAI from "openai"

export const maxDuration = 60

// Check if user is admin
async function checkAdmin() {
  const session = await auth()
  return {
    isAdmin: session?.user?.role === "ADMIN" || session?.user?.role === "MODERATOR",
    userId: session?.user?.id,
  }
}

// POST: Use GPT-4o to review tags and clean up false positives
export async function POST(request: NextRequest) {
  try {
    const { isAdmin, userId } = await checkAdmin()
    if (!isAdmin || !userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 403 })
    }

    if (!process.env.OPENAI_API_KEY) {
      return NextResponse.json(
        { error: "OPENAI_API_KEY is not configured" },
        { status: 400 }
      )
    }

    const body = await request.json()
    const {
      tag,
      type = "MOVIE",
      limit = 20,
      offset = 0,
      dryRun = false // If true, just return suggestions without making changes
    } = body

    if (!tag) {
      return NextResponse.json({ error: "Tag is required" }, { status: 400 })
    }

    const openai = new OpenAI({
      apiKey: process.env.OPENAI_API_KEY,
    })

    // Get items with this tag
    const items = await prisma.mediaItem.findMany({
      where: {
        type: type as "MOVIE" | "TV" | "GAME",
        topics: { has: tag },
      },
      select: {
        id: true,
        title: true,
        originalTitle: true,
        genres: true,
        topics: true,
        expertAgeRec: true,
        synopsisFr: true,
        officialRating: true,
      },
      orderBy: { title: "asc" },
      skip: offset,
      take: Math.min(limit, 50), // Max 50 at a time
    })

    if (items.length === 0) {
      return NextResponse.json({
        success: true,
        message: "No items found with this tag",
        reviewed: 0,
        removed: 0,
        kept: 0,
      })
    }

    // Prepare batch for GPT-4o review
    const itemsForReview = items.map((item, index) => ({
      index,
      id: item.id,
      title: item.title,
      originalTitle: item.originalTitle,
      genres: item.genres.join(", "),
      ageRec: item.expertAgeRec,
      synopsis: item.synopsisFr?.substring(0, 200) || "Non disponible",
      officialRating: item.officialRating,
    }))

    // Build the prompt for GPT-4o
    const prompt = `Tu es un expert en classification de contenu pour familles.
Analyse ces ${items.length} films/séries et détermine si le tag "${tag}" est APPROPRIÉ pour chacun.

RÈGLES pour le tag "${tag}":
${getTagRules(tag)}

FILMS À ANALYSER:
${itemsForReview.map(item => `
[${item.index}] "${item.title}"${item.originalTitle && item.originalTitle !== item.title ? ` (${item.originalTitle})` : ""}
- Genres: ${item.genres || "Non spécifié"}
- Âge recommandé: ${item.ageRec ? `${item.ageRec}+` : "Non défini"}
- Classification: ${item.officialRating || "Non définie"}
- Synopsis: ${item.synopsis}
`).join("\n")}

Pour CHAQUE film, réponds avec:
- L'index [X]
- "GARDER" si le tag "${tag}" est approprié
- "RETIRER" si le tag ne devrait PAS être là
- Une courte raison (10 mots max)

Format de réponse (JSON array):
[
  {"index": 0, "action": "GARDER", "reason": "Film pour enfants avec valeurs familiales"},
  {"index": 1, "action": "RETIRER", "reason": "Film d'action violent pour adultes"},
  ...
]

Réponds UNIQUEMENT avec le JSON, sans markdown.`

    const response = await openai.chat.completions.create({
      model: "gpt-4o",
      messages: [{ role: "user", content: prompt }],
      temperature: 0.2,
      max_tokens: 4000,
    })

    const content = response.choices[0]?.message?.content
    if (!content) {
      throw new Error("No response from OpenAI")
    }

    // Parse the response
    let decisions: Array<{ index: number; action: string; reason: string }>
    try {
      // Clean potential markdown
      const cleanedContent = content
        .replace(/```json\n?/g, "")
        .replace(/```\n?/g, "")
        .trim()
      decisions = JSON.parse(cleanedContent)
    } catch {
      console.error("Failed to parse GPT response:", content)
      throw new Error("Failed to parse GPT-4o response")
    }

    // Process decisions
    const results = {
      reviewed: items.length,
      removed: 0,
      kept: 0,
      details: [] as Array<{ title: string; action: string; reason: string }>,
    }

    for (const decision of decisions) {
      const item = items[decision.index]
      if (!item) continue

      results.details.push({
        title: item.title,
        action: decision.action,
        reason: decision.reason,
      })

      if (decision.action === "RETIRER" && !dryRun) {
        // Remove the tag
        await prisma.mediaItem.update({
          where: { id: item.id },
          data: {
            topics: item.topics.filter((t) => t !== tag),
          },
        })
        results.removed++
      } else if (decision.action === "GARDER") {
        results.kept++
      }
    }

    // Log admin activity
    if (!dryRun && results.removed > 0) {
      await prisma.adminActivity.create({
        data: {
          userId,
          action: "AI_TAG_CLEANUP",
          entityType: type,
          details: JSON.stringify({
            tag,
            reviewed: results.reviewed,
            removed: results.removed,
            kept: results.kept,
          }),
        },
      })
    }

    // Check if there are more items to process
    const totalWithTag = await prisma.mediaItem.count({
      where: {
        type: type as "MOVIE" | "TV" | "GAME",
        topics: { has: tag },
      },
    })

    return NextResponse.json({
      success: true,
      dryRun,
      tag,
      ...results,
      totalRemaining: totalWithTag - (dryRun ? 0 : results.removed),
      hasMore: offset + items.length < totalWithTag,
      nextOffset: offset + items.length,
    })
  } catch (error) {
    console.error("Tag review error:", error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Tag review failed" },
      { status: 500 }
    )
  }
}

// Get specific rules for each tag
function getTagRules(tag: string): string {
  const rules: Record<string, string> = {
    "Famille": `
- GARDER: Films explicitement conçus pour être vus en famille, avec des valeurs positives, pour enfants ou tout public
- GARDER: Films d'animation pour enfants, comédies familiales légères
- RETIRER: Films dramatiques adultes même si "Familial" est dans les genres TMDB
- RETIRER: Films avec violence, thèmes matures, romance adulte
- RETIRER: Films d'action, thrillers, horreur, même légers
- RETIRER: Films avec âge recommandé > 12 ans (sauf exceptions comme Harry Potter)`,

    "Animaux": `
- GARDER: Films où les animaux sont les PERSONNAGES PRINCIPAUX (Le Roi Lion, Babe, Beethoven)
- GARDER: Documentaires animaliers
- RETIRER: Films où les animaux ne sont que secondaires ou mentionnés
- RETIRER: Films d'horreur/thriller avec créatures ou monstres
- RETIRER: Films fantastiques avec créatures magiques (sauf si clairement sur les animaux)`,

    "Nature": `
- GARDER: Documentaires sur la nature, l'environnement, l'écologie
- GARDER: Films dont le thème CENTRAL est la nature/environnement
- RETIRER: Films qui se passent juste "dans la nature" ou en forêt
- RETIRER: Films d'aventure en extérieur (sauf si message écologique fort)
- RETIRER: Films d'horreur/thriller en milieu naturel`,

    "Animation": `
- GARDER: Tous les films d'animation (2D, 3D, stop-motion)
- RETIRER: Films live-action avec quelques effets animés`,

    "Éducatif": `
- GARDER: Films avec un contenu éducatif clair (histoire, science, valeurs)
- GARDER: Documentaires éducatifs pour enfants
- RETIRER: Films de divertissement pur sans valeur éducative`,

    "Noël": `
- GARDER: Films dont l'intrigue se déroule pendant Noël
- GARDER: Films sur le thème de Noël, le Père Noël, etc.
- RETIRER: Films où Noël n'est qu'une scène ou mention passagère`,

    "Halloween": `
- GARDER: Films sur le thème d'Halloween
- GARDER: Films d'horreur légers pour familles autour d'Halloween
- RETIRER: Films d'horreur génériques sans lien avec Halloween`,
  }

  return rules[tag] || `
- GARDER: Si le film correspond clairement au thème "${tag}"
- RETIRER: Si le lien avec "${tag}" est ténu ou inexistant`
}
