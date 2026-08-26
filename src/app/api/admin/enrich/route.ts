import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { logCronRun } from "@/lib/cron-log"
import { notUnreleasedWhere, unenrichedBacklogWhere } from "@/lib/enrich-filter"
import { VALID_SENSITIVE_WARNINGS } from "@/lib/sensitive-warnings"
import { getMovieKeywords, getTVKeywords } from "@/lib/tmdb"
import { applyContentSafetyFloors } from "@/lib/content-safety-floors"
import OpenAI from "openai"

// Vercel Pro lets us go up to 300s — same ceiling as /enrich-deep,
// /import-cnc-ratings, /news-discover. We need it because gpt-5-mini
// occasionally takes 25-35s on a single analysis (especially mangas
// with the long manga rubric appended), and the previous 60s ceiling
// only fit 1-2 items per batch before bailing on time.
export const maxDuration = 300

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
  sensitiveWarnings: string[]
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
  // Studios & brands
  "Disney", "Pixar", "DreamWorks", "Studio Ghibli",
  "Aardman", "Illumination", "Laika",
  "LEGO", "Minecraft", "Astérix", "Tintin",
  // Seasonal
  "Noël", "Halloween",
  // Games
  "Nintendo", "PlayStation", "Xbox", "PC",
  // Manga-specific topics
  "Shounen", "Shoujo", "Seinen", "Josei", "Japon",
  "Arts martiaux", "Lycée", "Tranche de vie", "Romance", "Isekai",
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
    demographic?: string | null
    pegiDescriptors?: string[] | null
  },
  tmdbKeywords: string[] = [],
  retryCount = 0
): Promise<ContentAnalysis> {
  // Type label + noun used in the prompt. MANGA has its own phrasing so
  // the model knows it's reviewing a Japanese print-format comic, not
  // the anime adaptation or a Western comic.
  const isManga = item.type === "MANGA"
  const typeLabel = isManga
    ? "Manga (bande dessinee japonaise en format papier)"
    : item.type === "GAME"
    ? "Jeu video"
    : item.type === "TV"
    ? "Serie TV"
    : "Film"
  const typeNoun = isManga
    ? "ce manga"
    : item.type === "GAME"
    ? "jeu"
    : item.type === "TV"
    ? "cette serie"
    : "ce film"

  // Manga-specific rubric appended only when needed. Demographics shape
  // expected tone/violence norms; fanservice and stylised violence are
  // common in battle shounen and need explicit flagging.
  const mangaRubric = isManga
    ? `

PARTICULARITES MANGA — TIENS EN COMPTE:
- Public cible (${item.demographic || "non specifie"}) : shounen (ados garcons), shoujo (ados filles), seinen (adultes), josei (jeunes femmes adultes)
- Fanservice (plans suggestifs, tenues courtes) est frequent dans le shounen/seinen — signale-le quand present
- La violence stylisee (combats, sang stylise) est normale dans le shounen mais peut etre intense
- Les mangas sont souvent PLUS matures que leurs adaptations anime pour un age equivalent : base-toi sur le support papier
- Langage cru et themes adultes sont frequents en seinen/josei — n'hesite pas a monter a 16+/18+ si justifie`
    : ""

  // Best-effort grounding hint. These TMDB keywords are PISTES only — they help
  // the model recall what categories of sensitive content may be present; they
  // are never echoed to users and must not be treated as verified scenes.
  const keywordHint =
    tmdbKeywords.length > 0
      ? `\n- Indices (mots-cles TMDB, PISTES uniquement — ne decris jamais une scene precise comme un fait verifie): ${tmdbKeywords.slice(0, 40).join(", ")}`
      : ""

  const prompt = `Tu es un expert en evaluation de contenu mediatique pour les familles, similaire a Common Sense Media.
Analyse ce contenu et fournis une evaluation detaillee pour aider les parents.

CONTENU:
- Titre: ${item.title}
${item.originalTitle ? `- Titre original: ${item.originalTitle}` : ""}
- Type: ${typeLabel}
- Genres: ${item.genres.join(", ") || "Non specifie"}
${item.releaseDate ? `- Date de sortie: ${item.releaseDate.toISOString().split("T")[0]}` : ""}
${item.officialRating ? `- Classification officielle: ${item.officialRating}` : ""}
${item.pegiDescriptors && item.pegiDescriptors.length > 0 ? `- Descripteurs PEGI officiels (AUTORITAIRES — les axes correspondants DOIVENT les refleter, meme si le synopsis n'en parle pas): ${item.pegiDescriptors.join(", ")}` : ""}
- Synopsis/Description (peut etre en anglais): ${item.synopsis || "Non disponible"}${keywordHint}${mangaRubric}

IMPORTANT:
- Le synopsis que tu fournis DOIT etre en FRANCAIS (traduis si necessaire)
- Le synopsis ne doit JAMAIS reveler de spoilers, retournements ou fin de l'histoire. Decris uniquement la premisse et le contexte initial.
- Base ton analyse sur ta connaissance de ${typeNoun} si tu le connais

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

STUDIOS ET MARQUES:
"Disney", "Pixar", "DreamWorks", "Studio Ghibli", "Aardman", "Illumination", "Laika", "LEGO", "Minecraft", "Astérix", "Tintin"

MANGA (utiliser uniquement si type = MANGA):
"Shounen", "Shoujo", "Seinen", "Josei", "Japon", "Arts martiaux", "Lycée", "Tranche de vie", "Romance", "Isekai"

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

POINTS A SURVEILLER — "Ce qui peut marquer" (choisis 0 a 6 categories, UNIQUEMENT dans cette liste, casse exacte):
${VALID_SENSITIVE_WARNINGS.map((w) => `"${w}"`).join(", ")}
- Ce sont des REPERES DE VIGILANCE prudents ("ce qui PEUT marquer"), pas un verdict.
- Choisis uniquement les categories reellement pertinentes ; renvoie [] (tableau vide) pour un contenu doux sans point de vigilance.
- N'INVENTE JAMAIS de scene precise, de minutage, ni de detail d'intrigue. Categories seulement.

CONFIANCE dans ton analyse (0.0 a 1.0):
- 0.9-1.0: Tu connais tres bien ce contenu et es certain de tes evaluations
- 0.7-0.8: Tu connais le contenu ou as assez d'informations pour une evaluation fiable
- 0.5-0.6: Tu as des informations limitees, certaines evaluations sont estimees
- 0.3-0.4: Tu ne connais pas ce contenu, tes evaluations sont basees uniquement sur le synopsis/genre
- 0.1-0.2: Information insuffisante, evaluation tres incertaine

ECHELLE DES METRIQUES (0-5) — calibree pour une sensibilite FAMILIALE.
Distingue TOUJOURS le contenu STYLISE (animation, cartoon, fantastique, super-heros sans consequence reelle) du contenu REALISTE / GRAPHIQUE : la meme scene "vaut" moins en animation legere qu'en prise de vue reelle.
- Violence: 0=aucune. 1-2=peril leger, slapstick, bagarres cartoon/animees sans consequence ni sang. 3=bagarres repetees, armes, tension, mort hors-champ. 4=violence realiste, sang, blessures montrees. 5=gore, torture, morts graphiques.
- Sexe/Sensualite: 0=aucun. 1-2=romance, baisers, allusions legeres. 3=sensualite marquee, nudite suggeree. 4=scenes de sexe implicites / nudite. 5=sexe explicite.
- Langage: 0=aucun. 1-2=quelques mots familiers. 3=insultes regulieres. 4=langage grossier frequent. 5=tres cru ou haineux.
- Substances: 0=aucune. 1-2=alcool en arriere-plan. 3=consommation montree. 4=abus/drogues au coeur du recit. 5=usage glorifie ou explicite.
- Achats integres (jeux): 0=aucun. 1-2=cosmetiques optionnels. 3=microtransactions presentes. 4-5=pay-to-win / loot boxes au coeur du jeu.
Echelle generale des mots: 0=Aucun, 1=Minimal, 2=Leger, 3=Modere, 4=Important, 5=Intense.

CONTENU D'EPOQUE (titres d'avant ~1990) — DEUX REGLES OPPOSEES, applique les deux:
1. NE GONFLE PAS les axes pour une comedie familiale classique. Le slapstick (courses-poursuites, chutes, gifles comiques, gendarmes maladroits) reste 0-1 en violence, PAS 2+. Un baiser ou un quiproquo galant reste 0-1 en sexe/sensualite. Une comedie tous publics des annees 60-80 ne doit pas ressortir avec le meme profil qu'un film d'action moderne : c'est le principal defaut constate sur le catalogue patrimoine.
2. SIGNALE en revanche les representations datees. Beaucoup de ces films reposent sur des stereotypes aujourd'hui problematiques (roles de genre, origines, religions, handicap) joues pour le rire. Quand c'est le cas, utilise "Stereotypes dates" et/ou "Humour a connotation ethnique ou religieuse" dans sensitiveWarnings, et dis-le en clair dans un point de whatParentsNeedToKnow.
- C'est une information de CONTEXTE destinee aux parents, pas un jugement de valeur sur l'oeuvre : reste factuel et neutre, ne condamne pas, ne recommande pas d'eviter.
- N'invente rien : ne signale ces categories que si tu connais reellement ce ressort dans ce titre precis.

COHERENCE AGE <-> METRIQUES (essentiel):
- Tes scores de sensibilite et l'age conseille doivent rester coherents. Un titre que tu juges adapte des 6-8 ans ne doit PAS porter de score > 2 ("Leger") en violence/sexe/langage/substances, sauf scene precise qui le justifie vraiment.
- Si une scene te pousse vers 3+ sur un axe, demande-toi d'abord s'il faut RELEVER l'age conseille. L'age est le signal principal ; les axes ne sont que des reperes secondaires.

CLASSIFICATION OFFICIELLE (indice FAIBLE):
- La classification fournie n'est qu'un indice : souvent absente, et parfois imprecise (un meme code peut etre colle a des titres tres differents). Ne la suis jamais aveuglement — ta connaissance du titre et les genres priment.

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
  "sensitiveWarnings": ["<categorie de la liste>", "..."],
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
    // Per-call abort — gpt-5-mini occasionally takes 25-35s on a
    // single analysis (mangas in particular, with the long manga
    // rubric appended). Capping each call at 35s lets a slow item
    // finish without dragging neighbours into a timeout, and the
    // outer 270s loop budget still fits 5+ items even at the worst
    // per-call duration. OpenAI SDK default is 10 min — useless.
    const controller = new AbortController()
    const timer = setTimeout(() => controller.abort(), 35_000)
    let response
    try {
      // gpt-5-mini is a reasoning model — internal reasoning tokens
      // count against max_completion_tokens. With "medium" effort
      // (the default on project keys), 1500 tokens get eaten by
      // reasoning before any output is produced, so
      // .choices[0].message.content comes back empty and our caller
      // throws "No response from OpenAI". Setting "minimal" keeps
      // reasoning under control; bumping the budget to 4000 gives
      // the structured JSON output (~1k tokens) comfortable room.
      // reasoning_effort isn't yet in the OpenAI SDK's typed params,
      // so we add it via a typed base + extra-field cast.
      const completionParams = {
        model: "gpt-5-mini",
        messages: [
          { role: "system" as const, content: "Tu es un assistant spécialisé dans l'analyse de contenus médias pour les familles. Réponds toujours en JSON valide. Sois CONCIS : synopsis court (2-3 phrases, max 400 caractères), conseils parents courts (1 phrase chacun, max 120 caractères). Pas de texte superflu." },
          { role: "user" as const, content: prompt },
        ],
        max_completion_tokens: 4000,
        reasoning_effort: "minimal",
      }
      response = await openai.chat.completions.create(
        completionParams as unknown as Parameters<typeof openai.chat.completions.create>[0] & { stream?: false },
        { signal: controller.signal },
      )
    } finally {
      clearTimeout(timer)
    }

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
      sensitiveWarnings: filterToValidList(
        Array.isArray(parsed.sensitiveWarnings) ? parsed.sensitiveWarnings.slice(0, 6) : [],
        VALID_SENSITIVE_WARNINGS as unknown as string[]
      ),
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
        return analyzeWithOpenAI(openai, item, tmdbKeywords, retryCount + 1)
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
      recalibrate = false, // Re-enrich already-enriched items whose scores look
                           // over-calibrated under the old rubric (see below)
      mediaId, // When set, re-enrich EXACTLY this one item (forced, ignores the
               // batch modes above) — for targeted corrections of a single title.
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

    // Build query based on type.
    // MANGA is explicitly excluded from all automated enrichment pipelines:
    // the manga catalog is internal-only (not public) and should not consume
    // enrichment budget or appear in job logs. The weekly-manga import route
    // exists for historical data but is no longer called by cron (see cron.yml).
    const PUBLIC_TYPES = ["MOVIE", "TV", "GAME"] as const
    const typeFilter = type === "all"
      ? { type: { in: [...PUBLIC_TYPES] } }
      : type === "manga"
        ? { type: "MANGA" as const } // explicit single-title admin override only
        : { type: type.toUpperCase() as (typeof PUBLIC_TYPES)[number] }

    // Never fully enrich a title that hasn't been released yet — there's
    // no content to assess, so the model confabulates content metrics
    // (violence/language/etc.) from the premise alone and presents them
    // as a definitive evaluation. These titles stay "provisional" (age
    // estimate only, badged "à confirmer") until their release date
    // passes, then the cron picks them up. Preserves the documented
    // invariant: provisional ⟹ !isEnriched ⟹ no ContentMetrics.
    // Shared predicate (also drives the dashboard backlog count) lives in
    // src/lib/enrich-filter so all three agree on "enrichable". See there.
    const notUnreleased = notUnreleasedWhere()

    // Build where clause based on mode
    let whereClause
    if (mediaId) {
      // Targeted single-title re-enrichment (forced below).
      whereClause = { id: String(mediaId) }
    } else if (recalibrate) {
      // Re-enrich the genuinely over-scored cluster under the new rubric. NOT
      // every ≤12 title with a high axis — a 12+ live-action film with violence
      // 4 ("Important") is usually correct. The over-scoring concentrates in:
      //   • young titles (≤10) with a sensibility axis ≥4 (the Jungle-Cruise
      //     pattern: family adventure scored like a thriller), and
      //   • Animation / Famille titles with an axis ≥4 (cartoon peril scored
      //     like realistic violence — the old rubric had no stylized discount),
      // plus all-zero rows (likely a failed/empty pass).
      // Each item is marked `enrichmentSource: "AI_RECAL"` after processing and
      // excluded here, so repeated batches drain the set once and then no-op —
      // a clean, terminating sweep (the previous `updatedAt` guard was bumped by
      // unrelated crons and wrongly blocked most of the set).
      whereClause = {
        ...typeFilter,
        isEnriched: true,
        NOT: { contentMetrics: { enrichmentSource: "AI_RECAL" } },
        OR: [
          {
            AND: [
              {
                OR: [
                  { expertAgeRec: { not: null, lte: 10 } },
                  { genres: { hasSome: ["Animation", "Familial", "Family"] } },
                ],
              },
              {
                contentMetrics: {
                  OR: [
                    { violence: { gte: 4 } },
                    { sexNudity: { gte: 4 } },
                    { language: { gte: 4 } },
                    { substanceUse: { gte: 4 } },
                  ],
                },
              },
            ],
          },
          {
            contentMetrics: {
              is: { violence: 0, sexNudity: 0, language: 0, substanceUse: 0 },
            },
          },
        ],
      }
    } else if (onlyLegacy) {
      // Re-enrich items that have metrics but missing v2 fields
      whereClause = {
        ...typeFilter,
        contentMetrics: { isNot: null },
        OR: [
          { contentMetrics: { toneTags: { isEmpty: true } } },
          { contentMetrics: { enrichmentConfidence: null } },
          // Legacy rows enriched before the warnings feature: never computed
          // (null), as opposed to "computed, none found" (empty array). Using
          // the timestamp lets the sweep terminate instead of re-processing
          // warning-free titles forever.
          { contentMetrics: { sensitiveWarningsAt: null } },
        ],
      }
    } else if (onlyMissing) {
      // Filter on isEnriched: false to match what the dashboard reports
      // as "œuvres à enrichir". The previous filter (contentMetrics: null)
      // missed items that had a partial metrics row from a failed run
      // — they showed up on the dashboard counter but were invisible to
      // the enrichment cron + manual triggers, leaving a stuck backlog.
      whereClause = {
        ...typeFilter,
        isEnriched: false,
      }
    } else {
      whereClause = typeFilter
    }

    // Apply the release-date guard to every mode.
    whereClause = { AND: [whereClause, notUnreleased] }

    // Find items to enrich
    const items = await prisma.mediaItem.findMany({
      where: whereClause,
      include: { contentMetrics: true },
      orderBy: recalibrate
        ? { updatedAt: "asc" as const } // oldest-touched first → drains + terminates
        : onlyLegacy
          ? { tmdbVoteCount: { sort: "desc" as const, nulls: "last" as const } }
          : { createdAt: "desc" },
      take: Math.min(limit, 50), // Max 50 at a time
    })

    result.processed = items.length
    result.details.push(`Found ${items.length} items to enrich`)

    // Safety bail before Vercel's 300s function ceiling. With per-
    // item 35s OpenAI timeout (see analyzeWithOpenAI), worst case for
    // a single item is ~37s including post-processing + the inter-
    // item delay. Bail at 270s leaves ~30s headroom for a final
    // in-flight item to complete and the response to serialize back
    // before the gateway kill. Caller (auto-mode loop) re-invokes to
    // pick up the rest.
    const TIME_BUDGET_MS = 270_000
    let bailedOnTime = false

    for (const item of items) {
      try {
        // Skip if already has metrics and onlyMissing is true (but recalibrate
        // and a targeted mediaId deliberately re-process already-enriched items).
        if (onlyMissing && !onlyLegacy && !recalibrate && !mediaId && item.contentMetrics) {
          result.skipped++
          continue
        }

        if (Date.now() - startTime > TIME_BUDGET_MS) {
          bailedOnTime = true
          result.details.push(
            `⏱ Time budget reached (${Math.round((Date.now() - startTime) / 1000)}s); stopping early. ${result.enriched} enriched, ${items.length - result.enriched - result.errors - result.skipped} remaining in this batch.`,
          )
          break
        }

        // Best-effort TMDB keyword grounding (MOVIE/TV with a tmdbId only).
        // Never blocks enrichment: the fetchers swallow errors and return [].
        let tmdbKeywords: string[] = []
        if (item.tmdbId) {
          if (item.type === "MOVIE") tmdbKeywords = await getMovieKeywords(item.tmdbId)
          else if (item.type === "TV") tmdbKeywords = await getTVKeywords(item.tmdbId)
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
          demographic: item.demographic,
          pegiDescriptors: item.pegiDescriptors,
        }, tmdbKeywords)

        // Deterministic safety stack (PEGI axis floors → age floor → young-age
        // metric clamp), shared verbatim with every other write path via
        // src/lib/content-safety-floors.ts. topics MUST union the item's
        // PERSISTED topics (deterministic, IGDB-derived — the reliable "Horreur"
        // signal) with the fresh analysis.tags, never the fresh tags alone:
        // VALID_TOPICS does not even contain "Horreur", so a horror floor keyed
        // on analysis.tags alone only fired by luck (bug found + fixed
        // 2026-07-11 after a re-enrichment pass wrongly LOWERED horror titles).
        const floored = applyContentSafetyFloors({
          expertAgeRec: analysis.expertAgeRec,
          metrics: analysis.contentMetrics,
          genres: item.genres,
          topics: [...item.topics, ...analysis.tags],
          visualStyle: analysis.visualStyle,
          type: item.type,
          officialRating: item.officialRating,
          pegiDescriptors: item.pegiDescriptors,
        })
        analysis.expertAgeRec = floored.expertAgeRec
        analysis.contentMetrics = floored.metrics

        // Mark recalibrated rows so the recalibrate sweep processes each once
        // and then terminates (see the recalibrate whereClause above).
        const enrichmentSource = recalibrate ? "AI_RECAL" : "AI_BASIC"

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
            // A fresh synopsis needs a fresh grammar/tone pass — un-mark it so
            // the synopsis-audit sweep picks it back up instead of trusting a
            // check that ran against the PREVIOUS text.
            synopsisFrCheckedAt: null,
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
            enrichmentSource,
            needsDeepEnrich,
            toneTags: analysis.toneTags,
            pacing: analysis.pacing || null,
            visualStyle: analysis.visualStyle || null,
            emotionalThemes: analysis.emotionalThemes,
            sensitiveWarnings: analysis.sensitiveWarnings,
            sensitiveWarningsAt: new Date(),
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
            enrichmentSource,
            needsDeepEnrich,
            toneTags: analysis.toneTags,
            pacing: analysis.pacing || null,
            visualStyle: analysis.visualStyle || null,
            emotionalThemes: analysis.emotionalThemes,
            sensitiveWarnings: analysis.sensitiveWarnings,
            sensitiveWarningsAt: new Date(),
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
      status: result.errors > 0 ? "partial" : bailedOnTime ? "partial" : "success",
      summary:
        result.processed === 0
          ? `Backlog vide — rien a enrichir (${type})`
          : `${result.enriched} enrichis sur ${result.processed} (${type})${bailedOnTime ? " — bailed on time" : ""}`,
      details: { ...result, type, bailedOnTime },
      startTime,
    })

    return NextResponse.json({
      success: true,
      result,
      bailedOnTime,
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

  // Backlog count = items the cron + manual triggers will actually
  // pick up. Mirrors the POST onlyMissing filter (isEnriched:false AND
  // released) so the dashboard, the script preflight, and the actual
  // processing all agree on what "needs enrichment" means. Unreleased
  // titles are excluded — enrich skips them, so counting them here would
  // show a backlog that never drains.
  const withoutMetrics = await prisma.mediaItem.count({
    where: unenrichedBacklogWhere(),
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
