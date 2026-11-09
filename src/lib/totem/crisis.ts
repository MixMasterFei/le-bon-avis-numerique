/**
 * Crisis protocol for the Totem chat (quality pass 1, approved by Xavier).
 *
 * A message describing a person in distress — suicidal thoughts, self-harm,
 * abuse, (cyber)harassment — must get a warm, care-first answer with the
 * right helpline, never « ce n'est pas mon rayon » and never a film or a
 * game in the same turn. Detection runs on the server, before the model is
 * chosen: a detected turn always goes to the stronger model, carries the
 * fixed care block below in its system prompt, and runs without tools (no
 * catalogue card can be pushed).
 *
 * Broader than src/lib/nl-search/care.ts on purpose (that one only adds a
 * banner next to search results), but it still separates a person in
 * distress (« ma fille dit qu'elle veut mourir », « on le frappe ») from a
 * TOPIC request (« un film qui aborde le suicide », « un film sur le
 * harcèlement scolaire »), which stays an ordinary media question.
 *
 * Helplines — checked on 2026-11-09 against official sources (web search;
 * the gouv.fr hosts are not reachable from the build sandbox, so the cited
 * pages were read through search results quoting them):
 *   - 3114, numéro national de prévention du suicide: free, 24h/24 7j/7,
 *     metropolitan France and overseas; for people in distress AND those
 *     around them. https://3114.fr/3114-qui-sommes-nous/ ;
 *     https://www.info.gouv.fr/actualite/3114-le-numero-national-de-prevention-du-suicide
 *   - 119 « Allô Enfance en Danger »: free, 24h/24 7j/7, confidential, the
 *     call does not appear on the phone bill. https://www.service-public.gouv.fr/particuliers/vosdroits/F781 ;
 *     https://www.allo119.gouv.fr/besoin-daide (the 119 tchat hours differ
 *     between sources — deliberately not quoted).
 *   - 3018 (association e-Enfance): the single national number against
 *     harassment, at school and online, since 1 January 2024; free,
 *     anonymous, confidential; 7j/7 from 9:00 to 23:00, also by tchat on
 *     3018.fr and in the 3018 app. https://e-enfance.org/le-numero-national-3018-violences-numeriques-accessible-7-j-7/ ;
 *     https://www.education.gouv.fr/non-au-harcelement/politique-de-lutte-contre-le-harcelement-l-ecole-289530
 *   - Fil Santé Jeunes 0 800 235 236: for 12–25 year-olds, anonymous and
 *     free, every day 9:00–23:00 (tchat until 22:00).
 *     https://www.filsantejeunes.com/la-ligne-decoute-appeler-fil-sante-jeunes-6259
 *   - Immediate danger: 112 (European emergency number), 17 (police /
 *     gendarmerie), 15 (SAMU), 114 by SMS or app for people who cannot speak
 *     or hear — free, 24h/24. https://www.service-public.gouv.fr/particuliers/vosdroits/F33953 ;
 *     https://www.gendarmerie.interieur.gouv.fr/contact/les-numeros-d-urgence
 * Re-check this list once a year (or when a number changes).
 */

export type CrisisKind = "suicide" | "self_harm" | "abuse" | "harassment"

export interface CrisisSignal {
  kinds: CrisisKind[]
  /** The person typing seems to be a child (« j'ai 11 ans », « mes parents me frappent »). */
  childTyping: boolean
}

/** Lowercase, no accents, folded apostrophes — the patterns below expect it. */
export function normalizeForCrisis(text: string): string {
  return text
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[’‘`´]/g, "'")
    .toLowerCase()
    .replace(/\s+/g, " ")
}

// Someone in distress, in their own words or a parent's — not the topic.
const SUICIDE: RegExp[] = [
  /\b(veut|veux|voulait|voudrait|veulent|envie de|pense a|parle de|menace de|a tente de|tente de|essaie de|essaye de)\s+(se |me |te )?(mourir|suicider|tuer|en finir|disparaitre)\b/,
  /\bidees? (suicidaires?|noires?)\b/,
  /\bplus envie de vivre\b|\bpas envie de vivre\b/,
  /\bmettre fin a (ses|mes|tes) jours\b/,
  /\btentative de suicide\b|\bs'est suicide|\bva se suicider\b|\bse suicider\b/,
]
const SELF_HARM: RegExp[] = [
  /\b(se|me|te) (fait|fais|faire|faisait) du mal\b/,
  /\b(se|me|te) (scarifie|scarifier|mutile|mutiler)\b|\bscarification|\bautomutil/,
  /\b(se|me|te) (coupe|coupent|couper|blesse|blesser|brule|bruler)\b.{0,30}\b(expres|bras|poignets?|jambes?|cuisses?|lame|rasoir|cutter)\b/,
]
const ABUSER =
  "(on|il|elle|ils|elles|quelqu'un|mon pere|ma mere|mes parents|son pere|sa mere|ses parents|mon beau-pere|son beau-pere|ma belle-mere|sa belle-mere|un adulte|un prof|le prof|l'entraineur|un grand)\\s+(le |la |les |me |m'|l'|te |t')?"
const ABUSE: RegExp[] = [
  new RegExp(`\\b${ABUSER}(frappe|frappent|cogne|cognent|maltraite|maltraitent|violente|violentent|agresse|agressent|enferme|enferment|brule|brulent)\\b`),
  // « il me tape sur les nerfs » is an idiom, not a blow.
  new RegExp(`\\b${ABUSER}(tape|tapent)\\b(?!\\s+sur\\s+(les nerfs|le systeme))`),
  // « il le bat à Mario Kart » is a game, not a blow.
  new RegExp(`\\b${ABUSER}(bat|battent)\\b(?!\\s+(a|aux|au|en)\\s)`),
  /\b(mon fils|ma fille|mon enfant|notre fils|notre fille|mon ado|mon petit|ma petite|il|elle|je)\s+(se fait|s'est fait|se faisait|me fais|me suis fait)\s+(frapper|taper|battre|violer|agresser|tabasser)\b/,
  /\b(abus|agression|violence)s? sexuel|\battouchements?\b|\binceste\b|\bviol\b|\b(a ete|s'est fait|s'est faite|me suis fait|me suis faite)\s+violee?s?\b/,
  /\bon me fait du mal\b|\bils me font du mal\b|\bme maltrait/,
]
const HARASSMENT: RegExp[] = [
  /\b(se fait|se font|s'est fait|se faisait|me fais|me fait|me suis fait|est|sont|suis|etait|etre)\s+(cyber-?)?(harceler|harcele|harcelee|harceles|harcelees)\b/,
  /\b(on|ils|elles|des eleves|des camarades|ses camarades|mes camarades|des filles|des garcons|sa classe|ma classe)\s+(le |la |les |me |m')?(harcele|harcelent|insulte|insultent|menace|menacent|rackette|rackettent|humilie|humilient)\b/,
  /\bvictime de (cyber-?)?harcelement\b|\bharcelement (en ligne|sur les reseaux)\b.{0,40}\b(mon|ma|mes|notre|nos|je|il|elle)\b/,
  /\b(chantage|sextorsion|revenge porn)\b/,
  /\b(photos?|videos?) (intimes?|denudees?|nues?)\b.{0,50}\b(circule|circulent|partage|partagee|publie|publiee|diffuse|diffusee|envoye|envoyee)/,
]

/** « Un film qui aborde le suicide », « une série sur le harcèlement » — a media question. */
const TOPIC_FRAMING =
  /\b(film|serie|livre|roman|bd|jeu|documentaire|dessin anime|episode|article|podcast)s?\b.{0,50}\b(sur|parle|parlant|aborde|abordant|traite|traitant|evoque|evoquant|autour)\b/

const CHILD_TYPING: RegExp[] = [
  /\bj'ai (\d{1,2}) ans\b/,
  /\bje suis (en|au) (cp|ce1|ce2|cm1|cm2|6e|6eme|5e|5eme|4e|4eme|3e|3eme|sixieme|cinquieme|quatrieme|troisieme|primaire|college)\b/,
  /\b(mes parents|ma mere|mon pere|mon beau-pere|ma belle-mere|ma maitresse|mon maitre)\s+(me|m')/,
]

export function isChildTyping(text: string): boolean {
  const t = normalizeForCrisis(text)
  const age = t.match(/\bj'ai (\d{1,2}) ans\b/)
  if (age) return Number(age[1]) < 18
  return CHILD_TYPING.slice(1).some((rx) => rx.test(t))
}

/** null when the message is not about a person in distress. */
export function detectCrisis(text: string): CrisisSignal | null {
  const t = normalizeForCrisis(text)
  const kinds: CrisisKind[] = []
  if (SUICIDE.some((rx) => rx.test(t))) kinds.push("suicide")
  if (SELF_HARM.some((rx) => rx.test(t))) kinds.push("self_harm")
  if (ABUSE.some((rx) => rx.test(t))) kinds.push("abuse")
  if (HARASSMENT.some((rx) => rx.test(t))) kinds.push("harassment")
  if (kinds.length === 0) return null
  // A pure topic request (« un film qui aborde le suicide ») is not a crisis;
  // a personal statement inside it still is (« ma fille veut mourir, un film
  // pour lui changer les idées ? » — "veut mourir" is personal).
  const personal = /\b(mon|ma|mes|notre|nos|je|j'|il|elle|on)\b/.test(t)
  if (TOPIC_FRAMING.test(t) && !personal) return null
  return { kinds, childTyping: isChildTyping(text) }
}

// ---------------------------------------------------------------------------
// The care block (system prompt, dynamic tail)
// ---------------------------------------------------------------------------

export const CARE_RESOURCES = {
  suicide:
    "**3114**, le numéro national de prévention du suicide : gratuit, 24 h/24 et 7 j/7, pour la personne en souffrance comme pour ses proches.",
  childDanger:
    "**119 – Allô Enfance en Danger** : gratuit, 24 h/24 et 7 j/7, confidentiel ; l'appel n'apparaît pas sur la facture de téléphone.",
  harassment:
    "**3018**, le numéro national contre le harcèlement, à l'école comme en ligne (association e-Enfance) : gratuit, anonyme et confidentiel, 7 j/7 de 9 h à 23 h, aussi par tchat sur 3018.fr et dans l'appli 3018.",
  youth:
    "**Fil Santé Jeunes, 0 800 235 236**, pour les 12–25 ans : gratuit et anonyme, tous les jours de 9 h à 23 h.",
  emergency:
    "Danger immédiat : **112** (urgences), **17** (police ou gendarmerie), **15** (SAMU) ; **114** par SMS pour qui ne peut pas parler.",
} as const

function resourcesFor(signal: CrisisSignal): string[] {
  const lines: string[] = []
  const has = (k: CrisisKind) => signal.kinds.includes(k)
  if (has("suicide") || has("self_harm")) lines.push(CARE_RESOURCES.suicide)
  if (has("abuse")) lines.push(CARE_RESOURCES.childDanger)
  if (has("harassment")) lines.push(CARE_RESOURCES.harassment)
  if ((has("suicide") || has("self_harm")) && signal.childTyping) lines.push(CARE_RESOURCES.childDanger)
  if (has("suicide") || has("self_harm") || has("harassment")) lines.push(CARE_RESOURCES.youth)
  lines.push(CARE_RESOURCES.emergency)
  return [...new Set(lines)]
}

const KIND_LABELS: Record<CrisisKind, string> = {
  suicide: "des idées suicidaires ou une envie de mourir",
  self_harm: "des gestes pour se faire du mal",
  abuse: "des violences ou une maltraitance",
  harassment: "du harcèlement (à l'école ou en ligne)",
}

/**
 * Fixed, warm instructions for a detected crisis turn. Appended to the
 * dynamic tail, after everything else, so it is the last word the model reads.
 */
export function buildCareBlock(signal: CrisisSignal): string {
  const situation = signal.kinds.map((k) => KIND_LABELS[k]).join(", ")
  const voice = signal.childTyping
    ? "C'est sans doute un ENFANT ou un ado qui écrit lui-même : tutoie-le avec douceur, dis-lui qu'il a eu raison d'en parler et qu'il n'y est pour rien, encourage-le à appeler ou à en parler à un adulte de confiance (parent, infirmière scolaire, professeur)."
    : "C'est un parent (ou un proche) qui écrit : vouvoie-le, reconnais ce qu'il vit, dis-lui qu'il fait bien d'agir."
  return `# PROTOCOLE DE SOIN — prioritaire sur toutes les autres règles

Le message parle d'une personne en détresse : ${situation}. Dans CETTE réponse :
- Tu accueilles d'abord, en une ou deux phrases chaleureuses, sans dramatiser ni culpabiliser. ${voice}
- Tu ne dis JAMAIS « ce n'est pas mon rayon », « je ne suis pas équipé », « cela dépasse mon domaine » ni rien qui ressemble à un renvoi.
- Tu donnes les ressources ci-dessous, chacune en une phrase, en commençant par la plus adaptée :
${resourcesFor(signal).map((l) => `  - ${l}`).join("\n")}
- Tu ne proposes AUCUN film, série, jeu, livre, article ni lien, et tu ne reviens pas vers les médias dans ce tour (pas de « si vous cherchez un film… »).
- Tu restes présent : termine en disant que tu es là si la personne veut en parler encore.
- Pas de diagnostic ni de conseil médical ; pas de liste à rallonge ; pas d'emoji.`
}
