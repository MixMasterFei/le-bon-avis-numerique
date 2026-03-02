/**
 * Bulk enrichment backfill script
 *
 * Three modes:
 *   npx tsx scripts/backfill-enrichment.ts --confidence-only     # Free: assign heuristic confidence
 *   npx tsx scripts/backfill-enrichment.ts --full-reenrich       # ~$0.0013/item: re-run Pass 1 with v2 prompt
 *   npx tsx scripts/backfill-enrichment.ts --deep --limit 500    # ~$0.02/item: deep enrich top items
 *
 * Options:
 *   --limit N     Max items to process (default: all for confidence, 10000 for reenrich)
 *   --dry-run     Preview what would be processed without making changes
 */

import { config } from "dotenv"
config()

import { PrismaClient } from "@prisma/client"
import OpenAI from "openai"

const prisma = new PrismaClient()

// ── Closed lists for v2 fields ──────────────────────────────────────────────

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

// ── CLI argument parsing ────────────────────────────────────────────────────

const args = process.argv.slice(2)
const mode = args.includes("--confidence-only")
  ? "confidence"
  : args.includes("--deep")
    ? "deep"
    : args.includes("--full-reenrich")
      ? "reenrich"
      : null

const limitArg = args.indexOf("--limit")
const limit = limitArg !== -1 ? parseInt(args[limitArg + 1]) : (mode === "confidence" ? 999999 : 10000)
const dryRun = args.includes("--dry-run")

if (!mode) {
  console.log(`
Usage:
  npx tsx scripts/backfill-enrichment.ts --confidence-only     # Free: assign heuristic confidence
  npx tsx scripts/backfill-enrichment.ts --full-reenrich       # Re-run Pass 1 with v2 prompt (~$0.0013/item)
  npx tsx scripts/backfill-enrichment.ts --deep --limit 500    # Deep enrich top items (~$0.02/item)

Options:
  --limit N     Max items to process
  --dry-run     Preview without making changes
`)
  process.exit(0)
}

// ── Step 1: Heuristic confidence ────────────────────────────────────────────

async function backfillConfidence() {
  console.log("\n🔍 Mode: Heuristic confidence scoring (free)")
  console.log("─".repeat(50))

  const BATCH_SIZE = 500
  let offset = 0
  let totalProcessed = 0
  let totalFlagged = 0

  while (totalProcessed < limit) {
    const items = await prisma.mediaItem.findMany({
      where: {
        isEnriched: true,
        contentMetrics: { enrichmentConfidence: null },
      },
      include: { contentMetrics: true },
      take: Math.min(BATCH_SIZE, limit - totalProcessed),
      skip: offset,
      orderBy: { tmdbVoteCount: { sort: "desc", nulls: "last" } },
    })

    if (items.length === 0) break

    for (const item of items) {
      if (!item.contentMetrics) continue

      let confidence = 0.65 // Default for existing enrichments

      // Adjust based on data quality signals
      if (item.synopsisFr && item.synopsisFr.length > 200) confidence += 0.05
      if (item.genres.length >= 2) confidence += 0.05
      if (item.officialRating) confidence += 0.05
      if (item.tmdbVoteCount && item.tmdbVoteCount > 1000) confidence += 0.05
      if (!item.synopsisFr || item.synopsisFr.length < 50) confidence -= 0.15
      if (item.genres.length === 0) confidence -= 0.10

      confidence = Math.round(Math.min(1.0, Math.max(0.1, confidence)) * 100) / 100
      const needsDeepEnrich = confidence < 0.5

      if (needsDeepEnrich) totalFlagged++

      if (!dryRun) {
        await prisma.contentMetrics.update({
          where: { mediaId: item.id },
          data: {
            enrichmentConfidence: confidence,
            enrichmentSource: "AI_BASIC",
            needsDeepEnrich,
            pass1At: item.contentMetrics.updatedAt,
          },
        })
      }

      totalProcessed++
    }

    console.log(`  Processed ${totalProcessed} items (${totalFlagged} flagged for deep enrich)`)
    offset += BATCH_SIZE
  }

  console.log(`\n✅ Done: ${totalProcessed} items scored, ${totalFlagged} flagged for deep enrichment`)
}

// ── Step 2: Full re-enrichment with v2 prompt ───────────────────────────────

async function fullReenrich() {
  console.log("\n🔄 Mode: Full re-enrichment with GPT-5 Mini")
  console.log("─".repeat(50))

  if (!process.env.OPENAI_API_KEY) {
    console.error("❌ OPENAI_API_KEY is required")
    process.exit(1)
  }

  const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY })

  // Count total items to process
  const totalCount = await prisma.mediaItem.count({
    where: {
      isEnriched: true,
      OR: [
        { contentMetrics: { toneTags: { isEmpty: true } } },
        { contentMetrics: { enrichmentConfidence: null } },
      ],
    },
  })

  const toProcess = Math.min(totalCount, limit)
  console.log(`  Found ${totalCount} items missing v2 fields, will process ${toProcess}`)
  if (dryRun) {
    console.log("  (dry run — no changes will be made)")
    return
  }

  let processed = 0
  let enriched = 0
  let errors = 0
  const startTime = Date.now()

  const BATCH_SIZE = 50

  while (processed < toProcess) {
    const items = await prisma.mediaItem.findMany({
      where: {
        isEnriched: true,
        OR: [
          { contentMetrics: { toneTags: { isEmpty: true } } },
          { contentMetrics: { enrichmentConfidence: null } },
        ],
      },
      include: { contentMetrics: true },
      orderBy: { tmdbVoteCount: { sort: "desc", nulls: "last" } },
      take: Math.min(BATCH_SIZE, toProcess - processed),
    })

    if (items.length === 0) break

    for (const item of items) {
      try {
        const currentYear = new Date().getFullYear()
        const releaseYear = item.releaseDate?.getFullYear()

        const prompt = buildPass1Prompt(item, currentYear, releaseYear)

        const response = await openai.chat.completions.create({
          model: "gpt-5-mini",
          messages: [{ role: "user", content: prompt }],
          temperature: 0.3,
          max_tokens: 1200,
        })

        const content = response.choices[0]?.message?.content
        if (!content) throw new Error("No response")

        let cleanedContent = content.replace(/```json\n?/g, "").replace(/```\n?/g, "").trim()
        const jsonMatch = cleanedContent.match(/\{[\s\S]*\}/)
        if (jsonMatch) cleanedContent = jsonMatch[0]

        const parsed = JSON.parse(cleanedContent)

        // Compute confidence
        let aiConfidence = typeof parsed.confidence === "number" ? Math.min(1.0, Math.max(0.0, parsed.confidence)) : 0.5
        if (!item.synopsisFr || item.synopsisFr.length < 50) aiConfidence *= 0.7
        if (item.genres.length === 0) aiConfidence *= 0.8
        if (!item.officialRating) aiConfidence *= 0.9
        if (item.tmdbVoteCount && item.tmdbVoteCount > 1000) aiConfidence = Math.min(1.0, aiConfidence * 1.1)
        const finalConfidence = Math.round(aiConfidence * 100) / 100

        await prisma.mediaItem.update({
          where: { id: item.id },
          data: {
            expertAgeRec: Math.min(18, Math.max(3, parsed.expertAgeRec || 8)),
            synopsisFr: parsed.synopsis || item.synopsisFr,
            topics: [...new Set([...item.topics, ...(Array.isArray(parsed.tags) ? parsed.tags : [])])],
          },
        })

        await prisma.contentMetrics.upsert({
          where: { mediaId: item.id },
          update: {
            violence: Math.min(5, Math.max(0, parsed.contentMetrics?.violence || 0)),
            sexNudity: Math.min(5, Math.max(0, parsed.contentMetrics?.sexNudity || 0)),
            language: Math.min(5, Math.max(0, parsed.contentMetrics?.language || 0)),
            consumerism: Math.min(5, Math.max(0, parsed.contentMetrics?.consumerism || 0)),
            substanceUse: Math.min(5, Math.max(0, parsed.contentMetrics?.substanceUse || 0)),
            positiveMessages: Math.min(5, Math.max(0, parsed.contentMetrics?.positiveMessages || 3)),
            roleModels: Math.min(5, Math.max(0, parsed.contentMetrics?.roleModels || 3)),
            whatParentsNeedToKnow: Array.isArray(parsed.whatParentsNeedToKnow) ? parsed.whatParentsNeedToKnow.slice(0, 5) : [],
            enrichmentConfidence: finalConfidence,
            enrichmentSource: "AI_BASIC",
            needsDeepEnrich: finalConfidence < 0.6,
            toneTags: filterToValidList(Array.isArray(parsed.toneTags) ? parsed.toneTags.slice(0, 3) : [], VALID_TONE_TAGS),
            pacing: VALID_PACING.includes(parsed.pacing) ? parsed.pacing : null,
            visualStyle: VALID_VISUAL_STYLES.includes(parsed.visualStyle) ? parsed.visualStyle : null,
            emotionalThemes: filterToValidList(Array.isArray(parsed.emotionalThemes) ? parsed.emotionalThemes.slice(0, 4) : [], VALID_EMOTIONAL_THEMES),
            pass1At: new Date(),
          },
          create: {
            mediaId: item.id,
            violence: Math.min(5, Math.max(0, parsed.contentMetrics?.violence || 0)),
            sexNudity: Math.min(5, Math.max(0, parsed.contentMetrics?.sexNudity || 0)),
            language: Math.min(5, Math.max(0, parsed.contentMetrics?.language || 0)),
            consumerism: Math.min(5, Math.max(0, parsed.contentMetrics?.consumerism || 0)),
            substanceUse: Math.min(5, Math.max(0, parsed.contentMetrics?.substanceUse || 0)),
            positiveMessages: Math.min(5, Math.max(0, parsed.contentMetrics?.positiveMessages || 3)),
            roleModels: Math.min(5, Math.max(0, parsed.contentMetrics?.roleModels || 3)),
            whatParentsNeedToKnow: Array.isArray(parsed.whatParentsNeedToKnow) ? parsed.whatParentsNeedToKnow.slice(0, 5) : [],
            enrichmentConfidence: finalConfidence,
            enrichmentSource: "AI_BASIC",
            needsDeepEnrich: finalConfidence < 0.6,
            toneTags: filterToValidList(Array.isArray(parsed.toneTags) ? parsed.toneTags.slice(0, 3) : [], VALID_TONE_TAGS),
            pacing: VALID_PACING.includes(parsed.pacing) ? parsed.pacing : null,
            visualStyle: VALID_VISUAL_STYLES.includes(parsed.visualStyle) ? parsed.visualStyle : null,
            emotionalThemes: filterToValidList(Array.isArray(parsed.emotionalThemes) ? parsed.emotionalThemes.slice(0, 4) : [], VALID_EMOTIONAL_THEMES),
            pass1At: new Date(),
          },
        })

        enriched++

        // Rate limit
        await new Promise((resolve) => setTimeout(resolve, 500))
      } catch (error) {
        errors++
        console.error(`  ✗ ${item.title}: ${error instanceof Error ? error.message : "Unknown"}`)
      }

      processed++

      // Progress every 50 items
      if (processed % 50 === 0) {
        const elapsed = (Date.now() - startTime) / 1000
        const rate = processed / elapsed
        const remaining = (toProcess - processed) / rate
        console.log(`  [${processed}/${toProcess}] ${enriched} enriched, ${errors} errors | ${rate.toFixed(1)} items/s | ~${Math.ceil(remaining / 60)} min remaining`)
      }
    }
  }

  const elapsed = (Date.now() - startTime) / 1000
  console.log(`\n✅ Done: ${enriched} enriched, ${errors} errors in ${Math.ceil(elapsed)}s`)
  console.log(`   Estimated cost: ~$${(enriched * 0.0013).toFixed(2)}`)
}

// ── Step 3: Deep enrichment ─────────────────────────────────────────────────

async function deepEnrich() {
  console.log("\n🔬 Mode: Deep enrichment with GPT-5 + web search")
  console.log("─".repeat(50))

  if (!process.env.OPENAI_API_KEY) {
    console.error("❌ OPENAI_API_KEY is required")
    process.exit(1)
  }

  const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY })

  const items = await prisma.mediaItem.findMany({
    where: {
      isEnriched: true,
      contentMetrics: { needsDeepEnrich: true },
    },
    include: { contentMetrics: true },
    orderBy: { tmdbVoteCount: { sort: "desc", nulls: "last" } },
    take: limit,
  })

  console.log(`  Found ${items.length} items for deep enrichment`)
  if (dryRun) {
    for (const item of items.slice(0, 20)) {
      console.log(`  - ${item.title} (votes: ${item.tmdbVoteCount}, confidence: ${item.contentMetrics?.enrichmentConfidence})`)
    }
    return
  }

  let enriched = 0
  let errors = 0
  const startTime = Date.now()

  for (let i = 0; i < items.length; i++) {
    const item = items[i]
    if (!item.contentMetrics) continue

    try {
      const prompt = buildDeepPrompt(item, item.contentMetrics)

      const response = await openai.responses.create({
        model: "gpt-5",
        tools: [{ type: "web_search_preview" as const }],
        input: prompt,
        temperature: 0.2,
        max_output_tokens: 1500,
      })

      const content = response.output_text
      if (!content) throw new Error("No response")

      let cleanedContent = content.replace(/```json\n?/g, "").replace(/```\n?/g, "").trim()
      const jsonMatch = cleanedContent.match(/\{[\s\S]*\}/)
      if (jsonMatch) cleanedContent = jsonMatch[0]

      const parsed = JSON.parse(cleanedContent)

      await prisma.mediaItem.update({
        where: { id: item.id },
        data: {
          expertAgeRec: Math.min(18, Math.max(3, parsed.expertAgeRec || 8)),
          synopsisFr: parsed.synopsis || item.synopsisFr,
          topics: [...new Set([...item.topics, ...(Array.isArray(parsed.tags) ? parsed.tags : [])])],
        },
      })

      await prisma.contentMetrics.update({
        where: { mediaId: item.id },
        data: {
          violence: Math.min(5, Math.max(0, parsed.contentMetrics?.violence || 0)),
          sexNudity: Math.min(5, Math.max(0, parsed.contentMetrics?.sexNudity || 0)),
          language: Math.min(5, Math.max(0, parsed.contentMetrics?.language || 0)),
          consumerism: Math.min(5, Math.max(0, parsed.contentMetrics?.consumerism || 0)),
          substanceUse: Math.min(5, Math.max(0, parsed.contentMetrics?.substanceUse || 0)),
          positiveMessages: Math.min(5, Math.max(0, parsed.contentMetrics?.positiveMessages || 3)),
          roleModels: Math.min(5, Math.max(0, parsed.contentMetrics?.roleModels || 3)),
          whatParentsNeedToKnow: Array.isArray(parsed.whatParentsNeedToKnow) ? parsed.whatParentsNeedToKnow.slice(0, 6) : [],
          enrichmentConfidence: typeof parsed.confidence === "number" ? Math.min(1.0, Math.max(0.0, parsed.confidence)) : 0.7,
          enrichmentSource: "AI_DEEP",
          needsDeepEnrich: false,
          toneTags: filterToValidList(Array.isArray(parsed.toneTags) ? parsed.toneTags.slice(0, 3) : [], VALID_TONE_TAGS),
          pacing: VALID_PACING.includes(parsed.pacing) ? parsed.pacing : null,
          visualStyle: VALID_VISUAL_STYLES.includes(parsed.visualStyle) ? parsed.visualStyle : null,
          emotionalThemes: filterToValidList(Array.isArray(parsed.emotionalThemes) ? parsed.emotionalThemes.slice(0, 4) : [], VALID_EMOTIONAL_THEMES),
          pass2At: new Date(),
        },
      })

      enriched++
      const corrections = Array.isArray(parsed.corrections) ? parsed.corrections : []
      console.log(`  ✓ [${i + 1}/${items.length}] ${item.title} (conf: ${parsed.confidence})${corrections.length > 0 ? ` [${corrections[0]}]` : ""}`)

      await new Promise((resolve) => setTimeout(resolve, 1000))
    } catch (error) {
      errors++
      console.error(`  ✗ [${i + 1}/${items.length}] ${item.title}: ${error instanceof Error ? error.message : "Unknown"}`)
    }
  }

  const elapsed = (Date.now() - startTime) / 1000
  console.log(`\n✅ Done: ${enriched} deep-enriched, ${errors} errors in ${Math.ceil(elapsed)}s`)
  console.log(`   Estimated cost: ~$${(enriched * 0.02).toFixed(2)}`)
}

// ── Prompt builders ─────────────────────────────────────────────────────────

function buildPass1Prompt(item: { title: string; originalTitle: string | null; type: string; synopsisFr: string | null; genres: string[]; releaseDate: Date | null; officialRating: string | null }, currentYear: number, releaseYear: number | undefined): string {
  return `Tu es un expert en evaluation de contenu mediatique pour les familles, similaire a Common Sense Media.
Analyse ce contenu et fournis une evaluation detaillee pour aider les parents.

CONTENU:
- Titre: ${item.title}
${item.originalTitle ? `- Titre original: ${item.originalTitle}` : ""}
- Type: ${item.type === "GAME" ? "Jeu video" : item.type === "TV" ? "Serie TV" : "Film"}
- Genres: ${item.genres.join(", ") || "Non specifie"}
${item.releaseDate ? `- Date de sortie: ${item.releaseDate.toISOString().split("T")[0]}` : ""}
${item.officialRating ? `- Classification officielle: ${item.officialRating}` : ""}
- Synopsis/Description: ${item.synopsisFr || "Non disponible"}

IMPORTANT:
- Le synopsis que tu fournis DOIT etre en FRANCAIS
- Base ton analyse sur ta connaissance de ce contenu si tu le connais

Tags possibles (choisis UNIQUEMENT parmi cette liste — 3 a 8 tags):
"Animation", "Aventure", "Comédie", "Fantastique", "Science-Fiction", "Famille", "Éducatif", "Super-héros", "Magie", "Sport", "Musique", "Histoire", "Amitié", "Émotions", "Courage", "Différence", "Handicap", "Deuil", "Divorce", "Harcèlement", "Premiers amours", "École", "Adolescence", "Espace", "Aviation", "Mythologie", "Contes", "Pirates", "Chevaliers", "Dinosaures", "Robots", "Enquête/Mystère", "Espionnage", "Animaux", "Nature", "Écologie", "Mer/Océan", "Montagne", "Voyage", "Cuisine", "Art", "Danse", "Théâtre", "Guerre", "Résistance", "Seconde Guerre mondiale", "Disney", "Pixar", "DreamWorks", "Studio Ghibli", "Noël", "Halloween", "Nintendo", "PlayStation", "Xbox", "PC"${releaseYear && releaseYear >= currentYear - 1 ? `, "Meilleur ${releaseYear}"` : ""}

TON ET AMBIANCE (1 a 3): "Doux et chaleureux", "Doux et rassurant", "Joyeux et coloré", "Drôle et léger", "Aventureux et exaltant", "Épique et grandiose", "Mystérieux et intrigant", "Sombre et tendu", "Nostalgique et poétique", "Action intense", "Effrayant et angoissant", "Romantique et tendre", "Fait réfléchir", "Inspiré et motivant", "Mélancolique et touchant"
RYTHME (1): "Très calme", "Lent et contemplatif", "Rythme modéré", "Dynamique", "Rapide et frénétique"
STYLE VISUEL (1): "Animation 2D classique", "Animation 3D/CGI", "Stop motion", "Anime japonais", "Prise de vue réelle", "Mix animation/réel", "Pixelisé/rétro", "Style aquarelle/artistique"
THEMES EMOTIONNELS (1 a 4): "Dépassement de soi", "Acceptation de la différence", "Force de l'amitié", "Lien familial", "Perte et deuil", "Premiers amours", "Trouver sa place", "Combattre l'injustice", "Découverte du monde", "Surmonter ses peurs", "Responsabilité et maturité", "Liberté et indépendance", "Pardon et réconciliation", "Confiance en soi", "Solidarité et entraide"
CONFIANCE (0.0-1.0): 0.9+=certain, 0.7-0.8=fiable, 0.5-0.6=estime, 0.3-0.4=synopsis seul, <0.3=incertain

Echelle metriques: 0=Aucun, 1=Minimal, 2=Leger, 3=Modere, 4=Important, 5=Intense

Reponds UNIQUEMENT avec un JSON valide:
{"expertAgeRec":<3-18>,"contentMetrics":{"violence":<0-5>,"sexNudity":<0-5>,"language":<0-5>,"consumerism":<0-5>,"substanceUse":<0-5>,"positiveMessages":<0-5>,"roleModels":<0-5>},"whatParentsNeedToKnow":["<1>","<2>","<3>"],"synopsis":"<FR>","tags":["<t1>"],"confidence":<0-1>,"confidenceReasons":[],"toneTags":["<>"],"pacing":"<>","visualStyle":"<>","emotionalThemes":["<>"]}`
}

function buildDeepPrompt(item: { title: string; originalTitle: string | null; type: string; synopsisFr: string | null; genres: string[]; releaseDate: Date | null; officialRating: string | null }, metrics: { violence: number; sexNudity: number; language: number; consumerism: number; substanceUse: number; positiveMessages: number; roleModels: number; toneTags: string[]; pacing: string | null; emotionalThemes: string[]; enrichmentConfidence: number | null }): string {
  return `Tu es un expert senior en evaluation de contenu mediatique pour les familles francophones.

IMPORTANT: Une premiere analyse a ete effectuee avec une confiance de ${metrics.enrichmentConfidence ?? "inconnue"}.
VERIFIE et CORRIGE cette analyse. Utilise la recherche web si necessaire.

CONTENU:
- Titre: ${item.title}
${item.originalTitle ? `- Titre original: ${item.originalTitle}` : ""}
- Type: ${item.type === "GAME" ? "Jeu video" : item.type === "TV" ? "Serie TV" : "Film"}
- Genres: ${item.genres.join(", ") || "Non specifie"}
${item.releaseDate ? `- Date de sortie: ${item.releaseDate.toISOString().split("T")[0]}` : ""}
${item.officialRating ? `- Classification: ${item.officialRating}` : ""}
- Synopsis: ${item.synopsisFr || "Non disponible"}

ANALYSE PRECEDENTE:
Violence: ${metrics.violence}/5, Sexe: ${metrics.sexNudity}/5, Langage: ${metrics.language}/5, Substances: ${metrics.substanceUse}/5
Messages+: ${metrics.positiveMessages}/5, Modeles: ${metrics.roleModels}/5
Ton: ${metrics.toneTags.join(", ") || "?"}, Rythme: ${metrics.pacing || "?"}, Emotions: ${metrics.emotionalThemes.join(", ") || "?"}

TON (1-3): "Doux et chaleureux", "Doux et rassurant", "Joyeux et coloré", "Drôle et léger", "Aventureux et exaltant", "Épique et grandiose", "Mystérieux et intrigant", "Sombre et tendu", "Nostalgique et poétique", "Action intense", "Effrayant et angoissant", "Romantique et tendre", "Fait réfléchir", "Inspiré et motivant", "Mélancolique et touchant"
RYTHME (1): "Très calme", "Lent et contemplatif", "Rythme modéré", "Dynamique", "Rapide et frénétique"
STYLE (1): "Animation 2D classique", "Animation 3D/CGI", "Stop motion", "Anime japonais", "Prise de vue réelle", "Mix animation/réel", "Pixelisé/rétro", "Style aquarelle/artistique"
EMOTIONS (1-4): "Dépassement de soi", "Acceptation de la différence", "Force de l'amitié", "Lien familial", "Perte et deuil", "Premiers amours", "Trouver sa place", "Combattre l'injustice", "Découverte du monde", "Surmonter ses peurs", "Responsabilité et maturité", "Liberté et indépendance", "Pardon et réconciliation", "Confiance en soi", "Solidarité et entraide"

JSON uniquement:
{"expertAgeRec":<3-18>,"contentMetrics":{"violence":<0-5>,"sexNudity":<0-5>,"language":<0-5>,"consumerism":<0-5>,"substanceUse":<0-5>,"positiveMessages":<0-5>,"roleModels":<0-5>},"whatParentsNeedToKnow":["<specifique 1>","<2>","<3>","<4>"],"synopsis":"<FR detaille 4-5 phrases>","tags":["<>"],"confidence":<0-1>,"toneTags":["<>"],"pacing":"<>","visualStyle":"<>","emotionalThemes":["<>"],"corrections":["<ce qui a change>"]}`
}

// ── Main ────────────────────────────────────────────────────────────────────

async function main() {
  try {
    if (mode === "confidence") {
      await backfillConfidence()
    } else if (mode === "reenrich") {
      await fullReenrich()
    } else if (mode === "deep") {
      await deepEnrich()
    }
  } catch (error) {
    console.error("Fatal error:", error)
    process.exit(1)
  } finally {
    await prisma.$disconnect()
  }
}

main()
