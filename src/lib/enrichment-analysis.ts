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

// ── House age scale (calibration, 27 Nov 2026) ──────────────────────────────
//
// Until 27 Nov 2026 the prompt never said what an age MEANS on Totem: no band
// definitions, no anchor titles, only « monte l'âge si un axe atteint 3 » and
// « la classification officielle est un indice FAIBLE ». The retired model happened to
// land on the catalogue's standard; gpt-6.1-terra filled the gap with a stricter
// one of its own (series judged on their worst late-season moment, 18 for any
// adult series, PEGI 3 karting at 5, scores a notch higher on every axis). The
// fix is a written house scale + reference points taken from our own published
// ages, not « copy the official rating »: the references themselves sit above a
// lenient TP (Forrest Gump) and below a -16 on a battle anime (Naruto).
//
// The references are CATALOGUE values (expertAgeRec + content_metrics as stored
// on 27 Nov 2026). They must never include a title of the calibration test sets
// (`CALIBRATION_HELD_OUT_TITLES`, test-enforced), or the measurement is void.
// MANGA keeps its previous instructions (out of the calibration's scope).
//
// Results (scripts/compare-text-models.ts, ages after the safety floors, vs the
// stored age): gpt-6.1-terra went from 12/20 identical to 19/20 on set A
// (tuning), 17/20 on set B, but only 12/20 on the fresh set C (8/20 with the
// old prompt): it still places live-action epics and historical violence one
// band higher (12 -> 14, 14 -> 16). The retired model: 19/20 on set A (18/20 before).
// Details and next steps: docs/agents/age-keeper.md « Open work ».

export interface AgeReferenceTitle {
  title: string
  kind: "film" | "film d'animation" | "serie" | "serie animee" | "anime" | "jeu"
  age: number
  /** Official classification shown in the line when it differs from our age. */
  official?: string
  /** violence / sexNudity / language / substanceUse as stored. */
  metrics: [number, number, number, number]
  note?: string
}

export const AGE_REFERENCE_SCREEN: AgeReferenceTitle[] = [
  { title: "Peppa Pig", kind: "serie animee", age: 3, metrics: [1, 0, 0, 0] },
  { title: "Les Aventures de Winnie l'ourson", kind: "film d'animation", age: 3, metrics: [1, 0, 0, 0] },
  { title: "Bluey", kind: "serie animee", age: 4, metrics: [1, 0, 0, 0] },
  { title: "Toy Story", kind: "film d'animation", age: 6, metrics: [1, 0, 0, 0] },
  { title: "Le Roi lion", kind: "film d'animation", age: 6, metrics: [2, 0, 0, 0] },
  { title: "Phinéas et Ferb", kind: "serie animee", age: 6, metrics: [1, 0, 0, 0] },
  { title: "Oggy et les Cafards", kind: "serie animee", age: 6, metrics: [2, 0, 1, 0], note: "slapstick" },
  { title: "Mr Bean", kind: "serie", age: 6, metrics: [1, 0, 0, 0] },
  { title: "Miraculous, les aventures de Ladybug et Chat Noir", kind: "serie animee", age: 7, metrics: [2, 0, 1, 0] },
  { title: "Le Monde incroyable de Gumball", kind: "serie animee", age: 7, metrics: [1, 0, 1, 0] },
  { title: "Vice-versa", kind: "film d'animation", age: 8, metrics: [1, 0, 0, 0] },
  { title: "Les Indestructibles", kind: "film d'animation", age: 8, metrics: [2, 0, 1, 0] },
  { title: "Le Voyage de Chihiro", kind: "film d'animation", age: 8, metrics: [2, 0, 0, 0] },
  { title: "E.T. l'extra-terrestre", kind: "film", age: 8, official: "TP", metrics: [2, 0, 1, 0] },
  { title: "Jumanji", kind: "film", age: 8, official: "TP", metrics: [2, 0, 1, 0] },
  { title: "Retour vers le futur", kind: "film", age: 10, official: "TP", metrics: [2, 1, 1, 1] },
  { title: "Spider-Man : Homecoming", kind: "film", age: 10, official: "TP", metrics: [2, 1, 1, 0] },
  { title: "Dragon Ball Z", kind: "anime", age: 10, official: "-10", metrics: [3, 0, 1, 0] },
  { title: "Fairy Tail", kind: "anime", age: 10, official: "-10", metrics: [3, 2, 1, 0], note: "fanservice leger" },
  { title: "Détective Conan", kind: "anime", age: 10, metrics: [3, 0, 1, 0], note: "meurtres non graphiques" },
  { title: "Avatar : Le Dernier Maître de l'air", kind: "serie animee", age: 10, official: "-12", metrics: [3, 0, 1, 0] },
  { title: "Malcolm", kind: "serie", age: 10, metrics: [1, 0, 2, 1] },
  { title: "La Guerre des étoiles", kind: "film", age: 12, official: "TP", metrics: [2, 0, 1, 0] },
  { title: "Avengers : Endgame", kind: "film", age: 12, official: "TP", metrics: [3, 0, 1, 0] },
  { title: "Forrest Gump", kind: "film", age: 12, official: "TP", metrics: [2, 1, 1, 2], note: "themes adultes" },
  { title: "Naruto", kind: "anime", age: 12, official: "-16", metrics: [3, 0, 1, 0] },
  { title: "Friends", kind: "serie", age: 12, metrics: [1, 1, 2, 1] },
  { title: "American Dad!", kind: "serie animee", age: 12, official: "-10", metrics: [2, 2, 3, 1] },
  { title: "Loki", kind: "serie", age: 12, metrics: [3, 1, 2, 1] },
  { title: "Imitation game", kind: "film", age: 13, official: "TP", metrics: [2, 1, 1, 1], note: "drame historique, themes adultes" },
  { title: "Mercredi", kind: "serie", age: 13, metrics: [3, 1, 2, 1] },
  { title: "Jurassic Park", kind: "film", age: 14, official: "TP", metrics: [4, 0, 1, 0] },
  { title: "The Dark Knight : Le Chevalier noir", kind: "film", age: 14, official: "-12", metrics: [4, 1, 3, 1] },
  { title: "Supernatural", kind: "serie", age: 14, official: "-12", metrics: [4, 1, 3, 1] },
  { title: "Vampire Diaries", kind: "serie", age: 14, metrics: [3, 2, 2, 1] },
  { title: "Arcane", kind: "serie animee", age: 14, official: "-16", metrics: [4, 1, 2, 1] },
  { title: "Les Griffin", kind: "serie animee", age: 14, official: "-10", metrics: [2, 1, 4, 2], note: "humour adulte cru" },
  { title: "Joker", kind: "film", age: 15, official: "-12", metrics: [4, 1, 4, 2] },
  { title: "Dexter", kind: "serie", age: 15, official: "-12", metrics: [5, 2, 3, 2] },
  { title: "Logan", kind: "film", age: 16, metrics: [4, 1, 3, 1] },
  { title: "Pulp Fiction", kind: "film", age: 16, metrics: [4, 2, 5, 4] },
  { title: "Breaking Bad", kind: "serie", age: 16, metrics: [4, 1, 4, 5] },
  { title: "The Walking Dead", kind: "serie", age: 16, metrics: [5, 1, 4, 2] },
  { title: "The Last of Us", kind: "serie", age: 16, official: "-18", metrics: [5, 2, 4, 2] },
  { title: "The Witcher", kind: "serie", age: 16, metrics: [4, 3, 4, 2] },
  { title: "Euphoria", kind: "serie", age: 16, metrics: [2, 4, 4, 5] },
  { title: "Love, Death & Robots", kind: "serie animee", age: 18, metrics: [5, 3, 4, 1], note: "sexualite et gore explicites" },
]

export const AGE_REFERENCE_GAMES: AgeReferenceTitle[] = [
  { title: "Animal Crossing: New Horizons", kind: "jeu", age: 3, official: "PEGI 3", metrics: [0, 0, 0, 0] },
  { title: "Rocket League", kind: "jeu", age: 7, official: "PEGI 3", metrics: [1, 0, 0, 0], note: "competition en ligne" },
  { title: "Super Mario Odyssey", kind: "jeu", age: 7, official: "PEGI 7", metrics: [2, 0, 0, 0] },
  { title: "Among Us", kind: "jeu", age: 8, official: "PEGI 7", metrics: [2, 0, 1, 0], note: "en ligne avec des inconnus" },
  { title: "Cuphead", kind: "jeu", age: 8, official: "PEGI 7", metrics: [2, 0, 0, 0] },
  { title: "The Legend of Zelda: Breath of the Wild", kind: "jeu", age: 12, official: "PEGI 12", metrics: [2, 0, 1, 0] },
  { title: "Fortnite", kind: "jeu", age: 12, official: "PEGI 12", metrics: [3, 0, 1, 0] },
  { title: "Elden Ring", kind: "jeu", age: 16, official: "PEGI 16", metrics: [5, 1, 2, 0] },
  { title: "Red Dead Redemption 2", kind: "jeu", age: 18, official: "PEGI 18", metrics: [5, 1, 4, 3] },
]

/**
 * Titles of the calibration test sets (set A = the model-comparison run of
 * 27 Nov 2026, used for tuning; set B = held out, used for the two allowed
 * follow-up iterations; set C = fresh, measured once on the frozen prompt).
 * A reference title equal to one of them would leak the answer into the
 * prompt — test-enforced. A future calibration round needs a fresh set D.
 */
export const CALIBRATION_HELD_OUT_TITLES = [
  // Set A
  "Le Monde de Nemo", "WALL·E", "Harry Potter à l'école des sorciers",
  "Harry Potter et la Chambre des secrets", "Interstellar", "Inception", "Deadpool",
  "Pokémon", "El Chavo del Ocho", "Les Simpson", "One Piece", "Stranger Things", "Lucifer",
  "Game of Thrones", "Mario Kart 8", "Hollow Knight", "Minecraft: Java Edition", "Portal 2",
  "Portal", "Grand Theft Auto V",
  // Set B
  "Les Razmoket, le film", "Monstres & Cie", "Là-haut", "Seul sur Mars", "Iron Man",
  "Hunger Games", "Le Silence des agneaux", "Scooby-Doo, où es-tu ?", "Sailor Moon",
  "SPY x FAMILY", "Young Sheldon", "The Mandalorian", "Prison Break", "Peaky Blinders",
  "Yoshi's Crafted World", "Fall Guys", "Celeste", "Roblox", "Batman: Arkham Asylum",
  "Call of Duty: Black Ops",
  // Set C
  "La Pat' Patrouille : Le Film", "Zootopie", "Les Nouveaux Héros", "Titanic",
  "Le Seigneur des anneaux : La Communauté de l'anneau", "Gladiator", "Le Loup de Wall Street",
  "Ben 10", "Souvenirs de Gravity Falls", "Hunter x Hunter", "The Big Bang Theory", "Vikings",
  "Tokyo Ghoul", "Riverdale", "Mario Party Superstars", "Splatoon 3", "Ori and the Blind Forest",
  "Super Smash Bros. Ultimate", "Apex Legends", "God of War",
]

function referenceLine(ref: AgeReferenceTitle): string {
  const [v, s, l, sub] = ref.metrics
  const official = ref.official ? `, classification ${ref.official}` : ""
  const note = ref.note ? `, ${ref.note}` : ""
  return `- ${ref.age} ans : ${ref.title} (${ref.kind}${official}${note}) · V${v} S${s} L${l} Sub${sub}`
}

/** The age sections every type had before the calibration — MANGA keeps them. */
const MANGA_AGE_SECTIONS = `COHERENCE AGE <-> METRIQUES (essentiel):
- Tes scores de sensibilite et l'age conseille doivent rester coherents. Un titre que tu juges adapte des 6-8 ans ne doit PAS porter de score > 2 ("Leger") en violence/sexe/langage/substances, sauf scene precise qui le justifie vraiment.
- Si une scene te pousse vers 3+ sur un axe, demande-toi d'abord s'il faut RELEVER l'age conseille. L'age est le signal principal ; les axes ne sont que des reperes secondaires.

CLASSIFICATION OFFICIELLE (indice FAIBLE):
- La classification fournie n'est qu'un indice : souvent absente, et parfois imprecise (un meme code peut etre colle a des titres tres differents). Ne la suis jamais aveuglement — ta connaissance du titre et les genres priment.`

/**
 * The house age scale + catalogue reference points + series / games / official
 * rating rules, for films, series and games. Replaces the old « COHERENCE » and
 * « CLASSIFICATION OFFICIELLE » sections (MANGA keeps those).
 */
export function buildAgeCalibrationBlock(type: string): string {
  const isGame = type === "GAME"
  const references = (isGame ? AGE_REFERENCE_GAMES : AGE_REFERENCE_SCREEN).map(referenceLine).join("\n")

  const typeRules = isGame
    ? `JEUX VIDEO:
- Le PEGI est un MINIMUM legal (applique automatiquement apres toi). Pour un jeu PEGI 12, 16 ou 18, l'age conseille est en general exactement le PEGI.
- Un jeu PEGI 3 ou 7 pense pour jouer en famille (course, plateforme, simulation douce) reste au niveau du PEGI, meme s'il a un mode en ligne optionnel : la difficulte, l'adresse ou la lecture necessaires ne relevent PAS l'age (c'est un age de contenu, pas d'habilete).
- Monte au-dessus du PEGI seulement pour une raison precise : ambiance angoissante ou themes lourds (+1 a 3 ans), ou une experience centree sur le jeu en ligne avec des inconnus, qui place un PEGI 3 ou 7 a 7-8 (Rocket League, Among Us).
- Jeu en ligne, chat et achats integres : dis-le dans whatParentsNeedToKnow et sur l'axe achats integres ; ils ne justifient pas a eux seuls un age plus eleve.`
    : `SERIES:
- Juge la serie dans son ensemble, au niveau HABITUEL des episodes, telle qu'on la suit depuis le debut — pas sur la scene la plus extreme d'une saison tardive. Si l'intensite monte au fil des saisons, dis-le dans whatParentsNeedToKnow au lieu de monter l'age.
- Meme regle pour les scores 0-5 : note l'intensite typique, pas un pic isole.

CLASSIFICATION OFFICIELLE (films et series):
- Ni plancher ni plafond. Nous sommes souvent AU-DESSUS d'un "TP" indulgent (Forrest Gump, TP -> 12) et parfois EN DESSOUS d'une -16 sur un anime de combat (Naruto -> 12) ou d'une -18 sur une serie adulte (The Last of Us -> 16).
- Quand elle est coherente avec ce que tu sais du titre (ex. -10 sur un anime d'aventure, -12 sur une serie d'action), c'est un bon point d'ancrage : ne t'en ecarte que pour une raison precise.`

  return `AGE CONSEILLE — ECHELLE MAISON (essentiel):
L'age conseille est l'age a partir duquel nous recommandons le titre a la plupart des enfants. Il tient compte du contenu sensible (violence, peur, sexualite, langage, substances) ET de la maturite des themes ; ce n'est ni l'age du public vise, ni un age d'habilete.
Valeurs a utiliser de preference : 3, 4, 6, 7, 8, 10, 12, 13, 14, 15, 16 ; 18 seulement dans les cas decrits.
- 3-4 : tout-petits. Aucune menace, ton doux.
- 6 : dessins animes et comedies pour enfants, y compris les combats de creatures ou de robots sans blessure. Peril leger, slapstick, mechants caricaturaux ; un moment triste ou des monstres un peu effrayants mais gentils au fond sont possibles (la mort d'un parent dans Le Roi lion ne le fait pas sortir de 6). C'est l'age le plus courant du catalogue pour un programme pour enfants.
- 7-8 : la meme chose avec davantage d'action ou de tension : super-heros et heroines magiques pour enfants (combats reguliers sans blessure), classiques familiaux, animes ou en prise de vue reelle, avec une peur ou une emotion plus marquee et plus longue (deuil montre, sequences sombres, magie inquietante).
- 10 : aventure, action cartoon ou fantastique sans sang, anime d'aventure ou de combat grand public au ton leger (combats spectaculaires, peu de morts), sitcom familiale ou dessin anime satirique un peu insolent.
- 12 : blockbusters d'action et super-heros (violence frequente mais peu graphique), anime de combat au ton plus sombre (morts, deuil, mechants cruels), themes adultes traites sans crudite, sitcom adulte ou dessin anime pour adultes avec allusions sexuelles regulieres.
- 13 : themes adultes difficiles traites frontalement (manipulation, persecution, guerre) ou intrigue psychologique troublante, sans contenu cru. Une science-fiction ou une aventure simplement complexe reste a 12.
- 14 : violence realiste ou sanglante par moments, peur et tension soutenues, series ados ou fantastiques avec relations amoureuses, humour adulte cru.
- 15-16 : contenu adulte (violence graphique, scenes de sexe, drogue, langage tres cru). 16 est l'age normal d'un film ou d'une serie pour adultes, meme tres violent : la plupart des titres -16 et -18 du catalogue sont a 16.
- 18 : exceptionnel pour un film ou une serie (sexualite explicite, sadisme ou gore continus). Pour un jeu : PEGI 18.

REPERES DU CATALOGUE — ages deja publies sur le site. Un titre comparable doit recevoir le meme age ; ne t'en ecarte que pour une raison precise. (V=violence, S=sexe/sensualite, L=langage, Sub=substances, sur 5)
${references}

${typeRules}

COHERENCE AGE <-> METRIQUES:
- Un titre que tu juges adapte des 6-8 ans ne doit PAS porter de score > 2 ("Leger") en violence/sexe/langage/substances, sauf scene precise qui le justifie vraiment.
- Un score de 3 sur un axe va avec 10 ans en animation et 12 en prise de vue reelle ; un 4 avec 12 en animation et 14 en prise de vue reelle. Un moment isole ne fait pas monter l'age au-dessus des titres comparables.
- Compare tes scores a ceux des reperes : un titre comparable doit avoir des scores comparables, pas un cran au-dessus. Note l'intensite TYPIQUE du titre (film, serie ou jeu) : une scene isolee compte pour un cran au plus, jamais pour deux.
- Violence (le catalogue note cet axe avec retenue) : peril, chutes, bagarres sans blessure = 1 ; poursuites, combats ou tirs sans blessure visible, une mort non montree = 2 (Le Roi lion, La Guerre des étoiles) ; combats frequents au coeur du recit, morts a l'ecran sans sang = 3 (Avengers : Endgame, Naruto) ; sang, blessures ou brutalite realiste montres = 4 (Jurassic Park, The Dark Knight) ; 5 = gore ou brutalite extreme repetee (The Walking Dead, Dexter). Une blessure accidentelle ou un soin medical (survie, operation) n'est pas de la violence entre personnes : il ne depasse pas 2.
- Langage : quelques gros mots isoles, meme un juron fort de temps en temps = 2 ; insultes regulieres = 3 (The Dark Knight) ; langage grossier frequent = 4 (Breaking Bad, Joker) ; 5 = cru en permanence (Pulp Fiction).
- Sexe/sensualite (axe sobre dans le catalogue) : aucun contenu ou romance tres chaste = 0 ; baisers, flirt, tenues suggestives, allusions verbales, un seducteur, une nuit sous-entendue hors champ = 1 (Friends) ; allusions appuyees et repetees, fanservice marque, scenes de lit suggerees sans nudite = 2 (Fairy Tail, Vampire Diaries) ; scenes de sexe montrees ou nudite = 3-4 (The Witcher, Euphoria) ; 5 = explicite.
- Substances : alcool ou tabac en passant, ou un personnage secondaire porte sur la bouteille traite avec humour = 1 ; alcoolisme ou drogue montres comme un probleme d'un personnage principal = 2 (Forrest Gump) ; 3+ seulement si drogue ou abus sont un ressort recurrent du recit (Breaking Bad, Euphoria 5).
- Messages positifs / modeles : 4-5 quand le titre porte clairement des valeurs (amitie, courage, entraide, perseverance), meme avec des heros imparfaits ; 3 = neutre ; 1-2 seulement s'il valorise des comportements negatifs.${isGame ? "" : `
- Consumerisme d'un film ou d'une serie : ce qui se passe DANS l'oeuvre, pas le merchandising autour de la franchise. 0 sans marque ni produit a l'ecran ; 1-2 si l'oeuvre met en scene la consommation, des marques ou la collection (cartes, gadgets, publicite parodiee).`}`
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

${isManga ? MANGA_AGE_SECTIONS : buildAgeCalibrationBlock(item.type)}

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
