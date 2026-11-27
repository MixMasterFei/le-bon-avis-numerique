import { VALID_SENSITIVE_WARNINGS } from "./sensitive-warnings"
import { modelFailureStatus } from "./openai-text-model"

/**
 * Pass-1 enrichment analysis: the prompt the daily enrichment sends for one
 * title, and the parser that turns the model's JSON into a validated
 * `ContentAnalysis`. Moved out of `src/app/api/admin/enrich/route.ts`
 * (27 Nov 2026, no behaviour change) so `scripts/compare-text-models.ts` can
 * run the exact same prompt through several models without touching the DB.
 * The route keeps the DB querying, the model call, the retries and the
 * safety floors.
 */

export interface ContentAnalysis {
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
export const VALID_TOPICS = [
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

export const VALID_TONE_TAGS = [
  "Doux et chaleureux", "Doux et rassurant", "Joyeux et coloré",
  "Drôle et léger", "Aventureux et exaltant", "Épique et grandiose",
  "Mystérieux et intrigant", "Sombre et tendu", "Nostalgique et poétique",
  "Action intense", "Effrayant et angoissant", "Romantique et tendre",
  "Fait réfléchir", "Inspiré et motivant", "Mélancolique et touchant",
]

export const VALID_PACING = [
  "Très calme", "Lent et contemplatif", "Rythme modéré", "Dynamique", "Rapide et frénétique",
]

export const VALID_VISUAL_STYLES = [
  "Animation 2D classique", "Animation 3D/CGI", "Stop motion", "Anime japonais",
  "Prise de vue réelle", "Mix animation/réel", "Pixelisé/rétro", "Style aquarelle/artistique",
]

export const VALID_EMOTIONAL_THEMES = [
  "Dépassement de soi", "Acceptation de la différence", "Force de l'amitié",
  "Lien familial", "Perte et deuil", "Premiers amours", "Trouver sa place",
  "Combattre l'injustice", "Découverte du monde", "Surmonter ses peurs",
  "Responsabilité et maturité", "Liberté et indépendance", "Pardon et réconciliation",
  "Confiance en soi", "Solidarité et entraide",
]

export function filterToValidList(values: string[], validList: string[]): string[] {
  return values.filter((v) => validList.includes(v))
}

/** What the prompt reads from a catalogue row. */
export interface EnrichmentPromptItem {
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
}

export const ENRICHMENT_SYSTEM_PROMPT =
  "Tu es un assistant spécialisé dans l'analyse de contenus médias pour les familles. Réponds toujours en JSON valide. Sois CONCIS : synopsis court (2-3 phrases, max 400 caractères), conseils parents courts (1 phrase chacun, max 120 caractères). Pas de texte superflu."

/**
 * Output budget of one analysis. The structured JSON is ~1k tokens; reasoning
 * tokens (if the model's effort allows any) count against the same budget.
 */
export const ENRICHMENT_MAX_COMPLETION_TOKENS = 4000

export function buildEnrichmentPrompt(item: EnrichmentPromptItem, tmdbKeywords: string[] = []): string {
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

  return prompt
}

export function buildEnrichmentMessages(item: EnrichmentPromptItem, tmdbKeywords: string[] = []) {
  return [
    { role: "system" as const, content: ENRICHMENT_SYSTEM_PROMPT },
    { role: "user" as const, content: buildEnrichmentPrompt(item, tmdbKeywords) },
  ]
}

/**
 * Parses the model's answer into a validated analysis (clamped scores, closed
 * lists, length limits). Throws on an empty answer or invalid JSON — the route
 * counts that as a failed item.
 */
export function parseEnrichmentResponse(
  content: string | null | undefined,
  item: { title: string; synopsis?: string | null },
): ContentAnalysis {
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
}

/**
 * `cron_logs` status of one /api/admin/enrich call.
 *   - every item that reached the model failed at the model call → "error"
 *     (failure email: the model is down, renamed or retired)
 *   - ≥ 50 % failed at the model call → "partial" (modelFailureStatus)
 *   - otherwise the historical rule: any error or a time bail → "partial".
 * Before 27 Nov 2026 a dead model logged "partial" on every run, never
 * "error", so no failure email was sent.
 */
export function enrichRunStatus(input: {
  modelAttempts: number
  modelFailures: number
  errors: number
  bailedOnTime: boolean
}): "success" | "partial" | "error" {
  const fallback = input.errors > 0 || input.bailedOnTime ? "partial" : "success"
  return modelFailureStatus({
    attempted: input.modelAttempts,
    modelFailures: input.modelFailures,
    fallback,
  })
}
