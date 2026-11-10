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
 * banner next to search results), but it separates a person in distress
 * (« ma fille dit qu'elle veut mourir », « on le frappe ») from a TOPIC
 * request (« un film qui aborde le suicide, pour mon fils ») and from a scene
 * or a game (« dans le film il se fait frapper », « un jeu où on tape sur des
 * taupes »), which stay ordinary media questions — see « Detection » below.
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
    .replace(/œ/g, "oe")
    .replace(/Œ/g, "Oe")
    .replace(/æ/g, "ae")
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[’‘`´]/g, "'")
    .toLowerCase()
    .replace(/\s+/g, " ")
}

// ---------------------------------------------------------------------------
// Detection
// ---------------------------------------------------------------------------
//
// A crisis turn REPLACES the answer (no tools, helplines), so a false alarm
// costs as much as a miss. The first version matched distress words alone and
// flagged 13 of 20 ordinary questions in the Director's probe (2026-11-10):
// « un jeu où on tape sur des taupes », « il bat son record à Tetris », « j'ai
// envie de mourir de rire », « dans le film, il se fait frapper par son
// père »… So a distress phrase now counts only once we know WHO it is about:
//   - the writer or someone close to them (« je », « me », « mon fils », « ma
//     fille de 13 ans », « mes parents me… », « ma fille dit qu'elle… ») →
//     crisis, whatever else the message asks (« mon fils se fait harceler, un
//     film pour lui changer les idées ? » stays a crisis);
//   - a pronoun, a household first name, a classmate (« il », « on le… »,
//     « Hugo », « un élève de ma classe ») → crisis, unless the message
//     describes a scene inside a work (« dans le film », « le héros », « un
//     film où… », « dans Harry Potter ») and names no real people around it
//     (« d'autres joueurs », « en ligne », « dans le chat »…);
//   - anyone else (« le héros », « un enfant qui… », « Mario ») → not a
//     crisis: the subject of a story, not someone to help.
// Idioms and game talk are ruled out in the patterns: « mourir de rire »,
// « en finir avec Fortnite », « me tape sur les nerfs », « se faire battre à
// Fortnite », « tuer des zombies » (only « se tuer » counts).
//
// No softer tier: what stays ambiguous (a pronoun inside a scene) goes
// through the ordinary pipeline, which keeps its tools and still carries
// soul.md §8 (distress → care, never a title) and the router's grave
// keywords. A middle tier would put a care note on every scene question.

type Who = "personal" | "pronoun" | "other"

/** People close to the writer: their child, family, friends, classmates. */
const KIN =
  "fils|fille|filles|enfant|enfants|ado|ados|garcon|garcons|bebe|petit|petite|petits|petites|grand|grande|cadet|cadette|aine|ainee|benjamin|benjamine|fiston|puce|frere|freres|soeur|soeurs|neveu|niece|filleul|filleule|eleve|eleves|copain|copine|ami|amie|pere|mere|parents|mari|femme|conjoint|conjointe|compagnon|compagne|petit-fils|petite-fille"
const PERSONAL_NP = `(?:mon|ma|mes|notre|nos)\\s+(?:(?:petit|petite|grand|grande|plus jeune|jeune|tout petit|toute petite|meilleur|meilleure)\\s+)?(?:beau-|belle-|demi-)?(?:${KIN})(?:\\s+(?:de|d')\\s*\\d{1,2}\\s+ans)?`
/** Words that may sit between a subject and its verb. */
const FILLERS = "(?:\\s+(?:aussi|meme|encore|toujours|souvent|parfois|deja|vraiment|ne|n'|y|en))*"

const PERSONAL_END = new RegExp(`(?:^|\\s)(?:(?:${PERSONAL_NP})(?:\\s+[a-z][a-z-]+)?|je|j'|moi|moi-meme)${FILLERS}$`)
// « ma fille dit qu'elle… », « mon fils m'a dit qu'il… »
const REPORTED_END = new RegExp(
  `(?:^|\\s)(?:${PERSONAL_NP})(?:\\s+[a-z][a-z-]+)?\\s+(?:me\\s+|m')?(?:dit|a dit|disait|ecrit|a ecrit|repete|raconte|a raconte|explique|a explique|avoue|a avoue|confie|a confie)\\s+(?:qu'|que\\s+)(?:il|elle)${FILLERS}$`,
)
// (« qu'il », and « s'il » after « je me demande »)
const PRONOUN_END = new RegExp(`(?:^|\\s|qu'|s')(?:il|elle|ils|elles|on)${FILLERS}$`)
const CLASSMATE_END = new RegExp(
  `(?:^|\\s)(?:un|une|des)\\s+(?:eleves?|enfants?|copains?|copines?|amis?|amies?|camarades?|ados?)\\s+(?:de|d')\\s*(?:ma|mon|notre|sa|son)\\s+(?:classe|ecole|college|lycee|equipe|club|groupe|famille)${FILLERS}$`,
)
/**
 * How parents hedge a worry: « je crois que ma fille… », « j'ai peur que mon
 * fils… », « je me demande si… », « on m'a dit que… ». The subject that
 * follows still counts.
 */
const HEDGE =
  "(?:je crois|je pense|j'ai l'impression|il me semble|j'ai peur|je crains|je me demande|je soupconne|on m'a dit|on me dit|il parait|apparemment|visiblement|a mon avis|peut-etre|sans doute|je sais|j'ai appris|j'ai decouvert|je viens d'apprendre|je viens de decouvrir)"
/** « mon fils je pense se fait… »: a hedge after the subject. */
const TRAILING_HEDGE = new RegExp(`\\s+${HEDGE}$`)
/** A comma-separated piece that names nobody (« mon fils, depuis un mois, se fait… », « je crois »). */
const ADVERBIAL_ONLY = new RegExp(
  `^(?:${HEDGE}(?: que| qu'| si)?|depuis(?: [a-z'-]+){1,4}|encore|toujours|souvent|parfois|tous les jours|chaque jour|en ce moment|ces temps(?:-ci)?|ces derniers (?:jours|temps|mois)|a l'ecole|au college|au lycee|en classe|la semaine derniere|hier|aujourd'hui|ce matin|ce soir|maintenant|du coup|bref|enfin)$`,
)

function whoAtEnd(segment: string, names: ReadonlySet<string>): Who {
  const s = segment.trim().replace(TRAILING_HEDGE, "")
  if (!s) return "other"
  if (REPORTED_END.test(s) || PERSONAL_END.test(s)) return "personal"
  if (PRONOUN_END.test(s) || CLASSMATE_END.test(s)) return "pronoun"
  const tokens = s.split(" ")
  const last = tokens[tokens.length - 1]
  // « mon fils qui se fait… », « un enfant qui se fait… »: the antecedent.
  if (last === "qui") return whoAtEnd(tokens.slice(0, -1).join(" "), names)
  // A household member's first name (« Inès se fait harceler »). Any other
  // bare name is more often a character (« Mario se fait frapper ? »).
  return names.has(last) ? "pronoun" : "other"
}

/**
 * Who the phrase starting after `before` is about: its grammatical subject,
 * at the end of the same clause. A piece that ends on a subject wins (« je
 * crois que ma fille », « depuis la rentrée mon fils »); a piece that is only
 * a hedge or a time (« je crois », « depuis un mois ») passes to the one
 * before it; anything else names nobody close.
 */
function subjectBefore(before: string, names: ReadonlySet<string>): Who {
  const clause = before.split(/[.!?;:]/).pop() ?? ""
  const parts = clause.split(",")
  for (let i = parts.length - 1; i >= 0; i--) {
    const p = parts[i].trim()
    if (!p) continue
    const who = whoAtEnd(p, names)
    if (who !== "other") return who
    if (ADVERBIAL_ONLY.test(p)) continue
    return "other"
  }
  return "other"
}

/** The victim named by an object pronoun or a noun phrase inside the match. */
function victim(word: string | undefined): Who {
  if (!word) return "other"
  if (/^(?:me|m'|moi|nous)$/.test(word) || new RegExp(`^${PERSONAL_NP}$`).test(word)) return "personal"
  return "pronoun"
}

/** A reflexive or passive form whose person tells who it is about. */
function byPerson(m: RegExpMatchArray): Who | "before" {
  const head = m[0]
  if (/^(?:me\s|m'|suis\s)/.test(head)) return "personal"
  if (/^(?:te\s|t'|es\s)/.test(head)) return "pronoun"
  return "before"
}

// A scene inside a film, a series or a book: told, not lived.
const WORK_SCENE =
  /\bdans (?:le|la|les|ce|cette|cet|ces|un|une|l')\s?(?:film|films|serie|series|episode|saison|livre|roman|manga|bd|dessin anime|anime|scene|histoire|clip|video|trailer|bande-annonce|saga|tome|chapitre)\b|\b(?:le|la|les|un|une|ce|cette|des)\s+(?:personnage|personnages|heros|heroine|protagoniste|mechant|mechants|acteur|actrice)\b|\b(?:film|serie|livre|roman|manga|dessin anime|episode|scene|histoire|bd|clip|video)s?\s+(?:ou|dans lequel|dans laquelle|qui montre|qui raconte)\b|\b(?:a la fin|au debut|au milieu) (?:du|de la|de l')\s?(?:film|serie|jeu|livre|episode|saison|tome|histoire)\b/
// In a game, a blow is a game mechanic; harassment comes from real players.
const GAME_SCENE = /\bdans (?:le|ce|un|les|ces) jeux?\b|\bjeux? (?:ou|dans lequel)\b/
// « Dans Harry Potter », « dans Minecraft » (read on the original casing).
const TITLE_SCENE = /\b[Dd]ans\s+(?!(?:[Ll]es?|[Ll]a|[Uu]ne?|[Mm]on|[Mm]a|[Mm]es|[Ss]on|[Ss]a|[Ss]es|[Cc]es?|[Cc]ette|[Nn]otre|[Nn]os|[Ll]eurs?)\b)[A-Z0-9]/
// Real players around a game: then it is not a game mechanic. (Not « en
// ligne » or a platform: a series can show harassment on Instagram.)
const REAL_PLAYERS =
  /\b(?:par d'autres joueurs|par des joueurs|d'autres joueurs|des joueurs|un joueur|dans le chat|sur le chat|dans le tchat|sur le tchat|en vocal|dans la vraie vie|pour de vrai)\b/

function inScene(t: string, original: string, kind: CrisisKind): boolean {
  if (WORK_SCENE.test(t)) return true
  const realPlayers = REAL_PLAYERS.test(t)
  // A title may be a game (« dans Fortnite, des joueurs le harcèlent »).
  if (TITLE_SCENE.test(original) && !realPlayers) return true
  return kind !== "harassment" && GAME_SCENE.test(t) && !realPlayers
}

// ---- the phrases ------------------------------------------------------------

const IDIOM_DEATH =
  "(?:rire|faim|froid|chaud|soif|ennui|honte|fatigue|impatience|envie|peur|jalousie|plaisir|bonheur|joie|curiosite|trouille|stress)"
const DIE =
  `(?:mourir(?!\\s+(?:de|d')\\s*${IDIOM_DEATH}\\b)` +
  // « se tuer », never « tuer des zombies »
  `|(?:se|me|te|s'|m'|t')\\s?(?:suicider|tuer|foutre en l'air|pendre|jeter (?:par la fenetre|sous un train|d'un pont|du haut)|ouvrir les veines)` +
  // « en finir », « en finir avec la vie », never « en finir avec Fortnite »
  // or « en finir au plus vite avec ses devoirs »
  `|en finir(?=\\s*(?:$|[.,;!?]|et\\b|avec (?:la vie|tout|(?:ses|mes|tes) jours|(?:son|mon|ton) existence|(?:lui|elle|moi)-meme)\\b|une bonne fois pour toutes\\s*(?:$|[.,;!?])))` +
  // « veut disparaître », never « disparaître sous sa couette »
  `|disparaitre(?=\\s*(?:$|[.,;!?]|et\\b|pour toujours\\b|a jamais\\b|definitivement\\b|de ce monde\\b|de la surface\\b))` +
  `|ne plus (?:etre la|exister|se reveiller|vivre))`
const WANT =
  // (subjunctives too: « j'ai peur qu'elle veuille mourir »)
  "(?:veut|veux|voulait|voulais|voudrait|voudrais|veulent|voulaient|veuille|veuillent|(?:a|ai|as|ait|aient|avait|avais|ont) envie de|envie de|pense a|pensait a|pensais a|parle de|parlait de|menace de|menacait de|(?:a|ai|as|ait|ont) tente de|tente de|essaie de|essaye de|essayait de|aimerait|aimerais|souhaite|souhaiterait|reve de)"

// Blows. The « battre » family is a game result after « à / au / en » (« le
// bat à Mario Kart », « se fait battre à Fortnite »), unless the place is a
// school, the home or the blows themselves (« à coups de ceinture »).
const NOT_A_GAME =
  "(?![^.!?]*?\\b(?:a|au|aux|en|sur)\\s+(?!l'ecole\\b|la recre|la maison\\b|la cantine\\b|la sortie\\b|la cour\\b|la piscine\\b|la garderie\\b|l'internat\\b|la colo|la gym\\b|l'arret\\b|la gare\\b|(?:son|mon|leur|notre) (?:ecole|college|lycee)\\b|ecole\\b|college\\b|lycee\\b|cours\\b|classe\\b|la classe\\b|coups?\\b|mains nues\\b|la ceinture\\b)[a-z0-9])"
// A blow taken inside a game (« dans le jeu », « par un monstre »).
const BY_HIT_GAME = "(?![^.!?]*\\b(?:dans (?:le|ce|un|les|ces) jeux?|par (?:un|une|des|le|la|les) (?:monstres?|zombies?|boss|ennemis?|robots?|aliens?|pnj|creatures?|dinosaures?))\\b)"
// A parent and a child at odds over screens is not a child in danger.
const NOT_SCREEN_CONFLICT =
  "(?![^.!?]*\\bquand (?:je|on) (?:lui |leur )?(?:coupe|enleve|eteins|retire|confisque|interdis|refuse|dis non|prive|arrete)\\b)"
const HIT =
  `(?:frapp\\w*|tap(?:e|ent|ait|aient)\\b(?!\\s+(?:sur les nerfs|sur le systeme|la discute|dans l'oeil))|cogn\\w*|maltrait\\w*|agress\\w*|gifl\\w*|etrangl\\w*|brutalis\\w*|molest\\w*|enferm\\w*|brul(?:e|ent|ait|aient)\\b|viol(?:e|ent|ait|aient)\\b|violent(?:e|ent|ait|aient)\\b` +
  `|touch(?:e|ee|es|ees|ent|ait|aient)\\b(?=[^.!?]{0,40}\\b(?:parties|intimes?|sexe|seins|fesses|de force|contre (?:son|mon) gre|sans (?:son|mon) (?:accord|consentement)|alors qu'(?:elle|il|je) ne (?:veut|voulait|voulais) pas)\\b)` +
  `|(?:bat|battent|battait|battaient|tabass\\w*|defonc\\w*)\\b${NOT_A_GAME})`
const HIT_ACTIVE = `${HIT}${BY_HIT_GAME}${NOT_SCREEN_CONFLICT}`
// « il me harcèle pour avoir Fortnite », « elle nous menace de partir » are
// a child nagging; « il me menace de publier mes photos » is not.
const HARASS =
  // (\b after \w* so the lookahead cannot be dodged by matching half a word)
  "(?:harcel\\w*\\b(?!\\s+(?:pour (?:avoir|acheter|jouer|regarder|sortir|aller|une? |des |du |le |la |les )(?![^.!?]{0,30}\\b(?:photos?|nudes?|videos?)\\b)|de questions|avec ses demandes))" +
  "|insult\\w*|humili\\w*|racket\\w*|rackett\\w*" +
  "|menac\\w*\\b(?!\\s+de\\s+(?!publier|partager|diffuser|envoyer|balancer|poster|montrer|(?:me|te|se|nous|vous|le|la|les|l')\\s?(?:tuer|frapper|taper|faire du mal|battre))))"
const HARASS_ACTIVE = `${HARASS}${NOT_SCREEN_CONFLICT}`
const PASSIVE_HIT =
  `(?:(?:frapp(?:er|e|ee|es|ees)\\b(?!\\s+par\\s+(?:la|le|l'|cette|ce|cet|sa|son)\\s*(?:beaute|realisme|ressemblance|justesse|qualite|scene|fin|musique|histoire|film|serie|livre|jeu|idee|foudre))` +
  `|tap(?:er|e|ee|es|ees)\\b(?!\\s+(?:sur les nerfs|dans l'oeil))|cogn(?:er|e|ee|es|ees)\\b|maltrait(?:er|e|ee|es|ees)\\b|agress(?:er|e|ee|es|ees)\\b|gifl(?:er|e|ee|es|ees)\\b|etrangl(?:er|e|ee|es|ees)\\b|brutalis(?:er|e|ee|es|ees)\\b|lynch(?:er|e|ee|es|ees)\\b|viol(?:er|e|ee|es|ees)\\b` +
  `|(?:battre|battu|battue|battus|battues|tabass(?:er|e|ee|es|ees)|defonc(?:er|e|ee|es|ees))\\b${NOT_A_GAME})${BY_HIT_GAME})`
const PASSIVE_HARASS =
  "(?:(?:cyber-?)?harcel(?:er|e|ee|es|ees)|insult(?:er|e|ee|es|ees)|menac(?:er|e|ee|es|ees)|humili(?:er|e|ee|es|ees)|rackett?(?:er|e|ee|es|ees)|ridiculis(?:er|e|ee|es|ees))\\b"
const PASSIVE_HEAD =
  // (subjunctives too: « j'ai peur qu'il se fasse harceler », « qu'elle soit frappée »)
  "\\b(?:se\\s+(?:fait|fais|faire|font|faisait|faisaient|fasse|fassent)|s'est\\s+fait(?:e|s)?|se\\s+soit\\s+fait(?:e|s)?|me\\s+(?:fais|faisais|fasse)|me\\s+suis\\s+fait(?:e)?|te\\s+(?:fais|fasses)|t'es\\s+fait(?:e)?|(?:a|ont|avait|aurait|ait|aient)\\s+ete|est|suis|es|sont|etait|etaient|soit|soient|sois)\\s+"

/** People who can hurt a child (a « méchant » or « Bowser » is a character). */
const PERSON_NOUN =
  "camarades?|eleves?|copains?|copines?|garcons?|filles?|grands?|grandes?|ados?|adultes?|joueurs?|inconnus?|voisins?|voisines?|surveillants?|surveillantes?|animateurs?|animatrices?|profs?|professeurs?|maitre|maitresse|entraineurs?|moniteurs?|monitrices?|cousins?|cousines?|oncles?|tantes?|freres?|soeurs?|peres?|meres?|parents|beau-pere|belle-mere|nounous?|baby-sitters?|gens|autres"
const ABUSERS =
  `(?:on|il|elle|ils|elles|quelqu'un|tout le monde|toute la classe|(?:sa|ma) classe|(?<kin>${PERSONAL_NP})` +
  `|(?:(?:un|une|des|le|la|les|ses|mes|son|sa|leur|leurs|d'autres|plusieurs|deux|trois)\\s+|l')(?:${PERSON_NOUN}))` +
  "(?:\\s+(?:de|d')\\s*(?:sa|ma|son|mon|leur|la|l')?\\s*(?:classe|ecole|college|lycee|equipe|club|quartier|bus|famille|\\d(?:e|eme)|cm\\d|terminale|seconde|premiere))?(?:\\s+(?:aussi|encore|toujours|souvent|tous les jours|parfois|deja))?"
/** The writer's own child as the one who hits or nags: a parent's day, not a crisis. */
const CHILD_OF_WRITER =
  /^(?:mon|ma|mes|notre|nos)\s+(?:(?:petit|petite|grand|grande|plus jeune|jeune|tout petit|toute petite)\s+)?(?:fils|fille|filles|enfant|enfants|ado|ados|garcon|garcons|bebe|petit|petite|petits|petites|grand|grande|cadet|cadette|aine|ainee|benjamin|benjamine|fiston|puce)\b/
const OBJ = "(?<obj>le|la|les|l'|me|m'|te|t'|nous|vous|lui|leur)"
const AUX = "(?:a\\s+|ont\\s+|avait\\s+|avaient\\s+)?"
const FAMILY_ABUSER =
  "(?:mon|ma|mes|notre|nos)\\s+(?:beau-pere|belle-mere|beau pere|belle mere|pere|mere|parents|frere|soeur|grand-pere|grand-mere|oncle|tante|cousin|cousine|mari|femme|conjoint|conjointe|compagnon|compagne|ex|nounou|baby-sitter|prof|professeur|entraineur|maitre|maitresse)"
// Self-harm marks (« des marques sur les bras, je crois qu'il se coupe »),
// not felt-tip, scratches from the cat or an old operation.
const HARM_MARKS = "(?:marques?|cicatrices?|coupures?|entailles?|griffures?|traces? de (?:coupures?|lame))"
const HARM_SITES = "(?:bras|avant-bras|poignets?|cuisses?)"
const NOT_AN_ACCIDENT =
  "(?![^.!?]{0,40}\\b(?:operation|accident|chute|vaccins?|varicelle|eczema|moustiques?|piqures?|feutres?|stylos?|peinture|tatouages?|chat|chaton|chien|ronces?|jeu|sport|velo|tombe\\w*)\\b)"
// Adults around a child, for the euphemisms of sexual abuse (« gestes
// déplacés », « l'a touchée », « des caresses »). Not doctors: an
// examination is a touch too.
const ADULT =
  "(?:une? adulte|des adultes|un homme|des hommes|une femme|un monsieur|un vieux|un inconnu|une inconnue|un ami de (?:la famille|mes parents|ses parents)" +
  "|(?:(?:le|la|un|une|son|sa|mon|ma|leur)\\s+|l')(?:moniteur|monitrice|animateur|animatrice|entraineur|entraineuse|coach|educateur|educatrice|prof|professeur|maitre|maitresse|surveillant|surveillante|voisin|voisine|oncle|tante|cousin|cousine|beau-pere|grand-pere|parrain|baby-sitter|nounou|pretre|cure|chauffeur))"
// « l'entraîneur du club de foot », « le coach de mon fils »
const ADULT_FROM = `(?:\\s+(?:(?:de|d')\\s*(?:${PERSONAL_NP})|(?:du|de la|de l'|des|de|d')\\s*[a-z'-]+(?:\\s+(?:de|d'|du)\\s*[a-z'-]+)?))?`
// Someone met online: « un inconnu sur Roblox », « quelqu'un rencontré sur Discord »
const ONLINE_STRANGER =
  "(?:un inconnu|une inconnue|quelqu'un|un mec|un type|un gars|un homme|une femme|une? adulte|un joueur|une joueuse|un ami|une amie|un garcon|une fille)" +
  "(?:\\s+(?:qu'(?:il|elle) a rencontre\\w*|rencontre\\w*|connu\\w*))?\\s+(?:sur|dans|de)\\s+(?:roblox|discord|fortnite|minecraft|snap\\w*|insta\\w*|tiktok|whatsapp|telegram|messenger|facebook|twitch|youtube|internet|un jeu|le jeu|un forum|les reseaux|un chat|le chat|un site)"
// An adult, or someone met online, asking a child for something.
const GROOMER = `(?:${ADULT}${ADULT_FROM}|${ONLINE_STRANGER})`
/** What they ask for: photos of the child, a secret, a meeting. */
const GROOMING_ASK =
  "(?:(?:des |une |de |d'autres |plein de )?(?:photos?|videos?|selfies?)\\s+(?:de|d')\\s*(?:lui|elle|moi|toi|eux)\\b(?![^.!?]{0,40}\\bpour (?:le site|le journal|le trombinoscope|l'album|la photo de classe|le club|l'equipe|le bulletin|la licence|l'inscription|le dossier)\\b)" +
  "|(?:de\\s+)?(?:garder (?:le|un|ca|ce|leur|notre|son) secret|garder (?:leur|notre|cette|la|ses) (?:conversations?|discussions?|relation|amitie|echanges?|messages?) secrete?s?|ne (?:rien|pas en|le|pas le) dire|ne pas (?:en parler|le dire))(?![^.!?]{0,40}\\b(?:surprise|cadeau|anniversaire|fete|spoil\\w*|la fin|le film|l'episode)\\b)" +
  "|(?:de\\s+)?(?:se voir|le voir|la voir|me voir|les voir|le rencontrer|la rencontrer|me rencontrer|se rencontrer|un rendez-vous|un rdv|le retrouver|la retrouver|me retrouver|venir chez (?:lui|elle|moi))" +
  // a teacher seeing a pupil after class to help is not a meeting to hide
  "(?![^.!?]{0,40}\\b(?:pour (?:l'aider|le soutien|ses devoirs|reviser|ses notes|un cours|le rattrapage|travailler)|avec (?:ses|mes|leurs) parents|avec moi|avec nous|en presence)\\b))"
const NOT_A_PLAIN_TOUCH =
  "(?![^.!?]{0,30}\\b(?:pour (?:l'|la |le |les )?(?:soigner|examiner|consoler|rassurer|aider|feliciter)|la tete|les cheveux|l'epaule|la main|la joue|le dos|au (?:loup|chat|jeu)|a chat|avec (?:le|la|un|une) (?:ballon|balle))\\b)"
// « il la fait chanter » is blackmail next to what it is about, or online;
// « la prof la fait chanter à la chorale » is music.
const BLACKMAIL_CONTEXT =
  /\b(?:photos?|videos?|nudes?|images?|argent|payer|euros?|menac\w*|publier|diffuser|balancer|envoyer|nue?s?|intimes?|chantage|sinon)\b/
const ONLINE_CONTEXT =
  /\b(?:sur|via|par) (?:instagram|insta|snap\w*|tiktok|whatsapp|discord|messenger|facebook|telegram|roblox|fortnite|internet|les reseaux)\b|\ben ligne\b/
const MUSIC_CONTEXT =
  /\b(?:chorale|chansons?|chant|karaoke|spectacle|concert|musique|micro|en choeur|choeur|solfege|comedie musicale|refrain|juste|faux)\b/
const STRANGER = /^(?:quelqu'un|un inconnu|une inconnue|un mec|un type|un gars|des gens|on)$/
function blackmail(m: RegExpMatchArray, victimOf: (m: RegExpMatchArray) => Who): Who {
  const t = m.input ?? ""
  if (MUSIC_CONTEXT.test(t)) return "other"
  if (BLACKMAIL_CONTEXT.test(t) || ONLINE_CONTEXT.test(t) || STRANGER.test(m.groups?.subj ?? "")) return victimOf(m)
  return "other"
}

/**
 * After « je me demande si », « j'ai peur que », « je crains que », the « ne …
 * pas » negates nothing: « je me demande si mon fils ne se fait pas harceler »
 * means he may be. Drop that « pas » so the phrase reads as it is meant. A
 * plain negation stays (« mon fils ne se fait pas harceler, je voulais juste
 * un film »): no lead-in, no change.
 */
function dropExpletiveNe(t: string): string {
  return t.replace(
    /\b(?:je me demande (?:si|s')|j'ai peur (?:que|qu')|je crains (?:que|qu')|j'ai peur (?:qu'il|qu'elle)|je crains (?:qu'il|qu'elle))[^.!?;]*/g,
    (clause) => clause.replace(/\b(ne\s+|n')((?:[a-z'-]+\s+){0,2}?[a-z'-]+)\s+pas\b/g, "$1$2"),
  )
}

const INTIMATE = "(?:nudes?|(?:photos?|videos?|images?)\\s+(?:intimes?|denudees?|nues?|sexuelles?|osees?))"
const SPREAD = "(?:circul\\w*|partag\\w*|publi\\w*|diffus\\w*|envoy\\w*|tourn\\w*|post\\w*|balanc\\w*|vend\\w*)"

interface Rule {
  kind: CrisisKind
  rx: RegExp
  /** Who the phrase is about; "before" = its subject, read before the match. */
  who?: (m: RegExpMatchArray) => Who | "before"
}

const g = (source: string) => new RegExp(source, "g")
const fromVictim = (m: RegExpMatchArray) => victim(m.groups?.victim)
const fromObj = (m: RegExpMatchArray): Who => {
  const who = victim(m.groups?.obj)
  // « ma fille me tape quand elle est fatiguée », « mon fils me harcèle »
  if (who === "personal" && m.groups?.kin && CHILD_OF_WRITER.test(m.groups.kin)) return "other"
  return who
}

const RULES: Rule[] = [
  // ---- suicide ----
  { kind: "suicide", rx: g(`\\b${WANT}\\s+${DIE}`) },
  {
    kind: "suicide",
    rx: g(
      "(?:\\b(?:n'|ne\\s+))?\\b(?:(?:a|ai|as|ait|aient|ont|avait|avais|aurait)\\s+)?(?:plus|pas)\\s+envie\\s+de\\s+vivre\\b|\\b(?:en (?:a|ai|as|ait|ont|avait|avais)\\s+)?marre de (?:vivre|la vie)\\b|\\bplus (?:aucune )?raison de vivre\\b" +
        // « elle ne voulait plus vivre » — not « ne veut plus vivre chez son père / sans sa console »
        "|(?:\\b(?:n'|ne\\s+))?\\b(?:veut|veux|voulait|voulais|voudrait|voudrais|veulent|voulaient|veuille|veuillent)\\s+plus\\s+vivre\\b(?!\\s+(?:chez|avec|ici|la-bas|la bas|a|au|aux|en|dans|sous|sans|pres|loin)\\b)",
    ),
  },
  { kind: "suicide", rx: g("\\b(?:serait|seraient|serais|serait-il|irait|iraient)\\s+mieux\\s+sans\\s+(?<victim>moi|lui|elle)\\b"), who: fromVictim },
  { kind: "suicide", rx: g("\\bmettre fin a (?<victim>ses|mes|tes) jours\\b"), who: (m) => (m.groups?.victim === "mes" ? "personal" : "before") },
  {
    kind: "suicide",
    rx: g(
      "\\b(?:a|ai|as|ait|aient|aies|ont|avait|avais|avaient|aurait|eu|eue|eues)\\s+(?:souvent\\s+|parfois\\s+|encore\\s+)?(?:des |de |d'|ses |mes |les )?(?:idees|pensees) (?:noires|suicidaires|de mort)\\b|\\b(?:a|ai|as|ait|ont|avait)\\s+(?:deja\\s+)?fait\\s+(?:une\\s+)?(?:tentative de suicide|ts)\\b|\\bs'est (?:suicide|suicidee|tue|tuee)\\b",
    ),
  },
  { kind: "suicide", rx: g("\\bparl(?:e|es|ent|ait|aient)\\s+(?:souvent\\s+|beaucoup\\s+|tout le temps\\s+|de plus en plus\\s+|encore\\s+)?(?:de|du)\\s+(?:suicide|mort)\\b") },

  // ---- self-harm ----
  {
    kind: "self_harm",
    rx: g(
      "(?:\\b(?:se\\s|s')(?:fait|font|faisait|faisaient|faire|fasse|fassent|est fait|est faite|sont faits?|soit fait|soit faite)|\\b(?:me\\s|m')(?:fais|faisais|faire|fasse|suis fait|suis faite)|\\b(?:te\\s|t')(?:fais|faisais|faire|fasses|es fait|es faite))\\s+du mal\\b(?!\\s+(?:en tombant|en jouant|au sport|au foot|au genou|a la cheville|au dos|au pied))",
    ),
    who: byPerson,
  },
  { kind: "self_harm", rx: g("\\b(?:se\\s|s'|me\\s|m'|te\\s|t')\\s?(?:scarifi\\w*|mutil\\w*|automutil\\w*)"), who: byPerson },
  { kind: "self_harm", rx: g("\\b(?:fait|fais|font|faisait)\\s+de\\s+(?:la\\s+scarification|l'automutilation)\\b") },
  // « mon fils a des marques sur les bras », « j'ai vu des cicatrices sur ses poignets »
  {
    kind: "self_harm",
    rx: g(`\\b(?:a|ai|as|ait|aient|ont|avait|avais)\\s+(?:des |plein de |de |de nombreuses |plusieurs )?${HARM_MARKS}\\s+(?:sur|aux?|a l'|au niveau des?)\\s+(?:les |ses |mes |son |sa |mon |ma )?${HARM_SITES}\\b${NOT_AN_ACCIDENT}`),
  },
  {
    kind: "self_harm",
    rx: g(
      `\\b(?:vu|remarque|remarquee|trouve|decouvert|apercu|vois|voit)\\s+(?:des |plein de |de |plusieurs )?${HARM_MARKS}\\s+(?:sur|aux?|a l')\\s+(?<owner>ses|son|sa|les|mes|mon|ma|leurs)\\s+${HARM_SITES}\\b(?:\\s+de\\s+(?<ownerNp>${PERSONAL_NP}))?${NOT_AN_ACCIDENT}`,
    ),
    who: (m) => (m.groups?.ownerNp || /^(?:mes|mon|ma)$/.test(m.groups?.owner ?? "") ? "personal" : "pronoun"),
  },
  {
    kind: "self_harm",
    rx: g(
      "\\b(?:se\\s|s'|me\\s|m'|te\\s|t')(?:coupe|coupent|couper|coupait|coupais|blesse|blesser|blessait|brule|bruler|brulait|griffe|griffer|griffait|tape la tete|frappe la tete|cogne la tete)\\b(?=[^.!?]{0,40}\\b(?:expres|volontairement|bras|poignets?|jambes?|cuisses?|ventre|lame|rasoir|cutter|compas|ciseaux|cigarettes?|murs?)\\b)",
    ),
    who: byPerson,
  },

  // ---- abuse ----
  // « on le frappe », « mes parents me tapent », « des élèves de sa classe l'ont frappé »
  { kind: "abuse", rx: g(`\\b${ABUSERS}\\s+${OBJ}\\s?${AUX}${HIT_ACTIVE}`), who: fromObj },
  // « mon père frappe ma mère »: violence at home, whoever it hits
  // (« mon frère bat tous mes records » is not a blow: « bat » needs a victim, below)
  {
    kind: "abuse",
    rx: g(`\\b${FAMILY_ABUSER}(?:\\s+(?:aussi|encore|toujours|souvent|parfois))?\\s+${AUX}(?!bat\\b|battent\\b|battait\\b|battaient\\b)${HIT_ACTIVE}`),
    who: () => "personal",
  },
  // « ils frappent mon fils », « mon père bat ma mère »
  { kind: "abuse", rx: g(`\\b${HIT_ACTIVE}\\s+(?<victim>${PERSONAL_NP})`), who: fromVictim },
  // « il se fait frapper », « mon fils s'est fait tabasser », « elle a été violée »
  { kind: "abuse", rx: g(`${PASSIVE_HEAD}${PASSIVE_HIT}`), who: byPerson },
  { kind: "abuse", rx: g(`\\b${ABUSERS}\\s+${OBJ}\\s?(?:fait|font|faisait|faisaient|a fait|ont fait|avait fait)\\s+(?:du\\s+)?mal\\b`), who: fromObj },
  {
    kind: "abuse",
    rx: g(
      "\\b(?:a|ai|as|ait|aient|ont|avait|avais|aurait)\\s+(?:ete\\s+)?(?:subi|victime d'?|victime de)\\s*(?:des |un |une |d'|de l'|de la )?(?:attouchements?|abus(?: sexuels?)?|agression(?: sexuelle)?|viol\\b|inceste|violences?(?: sexuelles)?|maltraitance)|\\bagressee?s? sexuellement\\b",
    ),
  },
  { kind: "abuse", rx: g(`\\b${OBJ}\\s?(?:fait|font|faisait|a fait|ont fait)\\s+des\\s+attouchements\\b`), who: fromObj },
  { kind: "abuse", rx: g(`\\battouchements\\s+(?:a|sur)\\s+(?<victim>moi|elle|lui|${PERSONAL_NP})\\b`), who: fromVictim },
  { kind: "abuse", rx: g("\\bil y a (?:de l'inceste|eu (?:un viol|des attouchements)) dans (?<victim>ma|notre|sa) famille\\b"), who: (m) => (m.groups?.victim === "sa" ? "pronoun" : "personal") },
  // Euphemisms: « des gestes déplacés envers ma fille », « un adulte du club
  // a eu des gestes déplacés », « le moniteur l'a touchée », « des caresses »
  {
    kind: "abuse",
    rx: g(
      `\\b(?:gestes?|comportements?|attitudes?|propos|caresses?|contacts?)\\s+(?:deplaces?|deplacees?|inappropriee?s?|inapproprie?s?|equivoques?|sexuels?|sexuelles?|douteux|douteuses)\\b[^.!?]{0,40}?\\b(?:envers|sur|avec|a l'egard de|vis-a-vis de|contre)\\s+(?<victim>moi|elle|lui|eux|${PERSONAL_NP})\\b`,
    ),
    who: fromVictim,
  },
  {
    kind: "abuse",
    rx: g(`\\b${ADULT}${ADULT_FROM}\\s+(?:a|avait|aurait|ont|avaient)\\s+(?:eu\\s+)?(?:des |un |une )?(?:gestes?|comportements?|attitudes?)\\s+(?:deplace\\w*|inapproprie\\w*|equivoques?|sexuels?|sexuelles?)`),
    who: () => "pronoun",
  },
  {
    kind: "abuse",
    rx: g(`\\b${ADULT}${ADULT_FROM}\\s+${OBJ}\\s?(?:(?:a|avait|aurait|ont)\\s+)?(?:touche|touchee|touches|touchees|touchait|tripot\\w*|pelot\\w*|caresse|caressee|caressait)\\b${NOT_A_PLAIN_TOUCH}`),
    who: fromObj,
  },
  {
    kind: "abuse",
    rx: g(
      `\\b${ADULT}${ADULT_FROM}\\s+${OBJ}\\s?(?:a\\s+)?(?:fait|faisait|faisaient|font)\\s+des\\s+(?:caresses|calins? (?:bizarres?|genants?|deplaces?|insistants?))\\b(?![^.!?]{0,20}\\b(?:sur la tete|dans les cheveux|sur la joue|dans le dos)\\b)`,
    ),
    who: fromObj,
  },
  {
    kind: "abuse",
    rx: g(
      "\\bcaresses?\\s+(?:deplacees?|inappropriees?|genantes?|sur (?:le|son|ses|sa) (?:corps|sexe|parties|seins|fesses|cuisses|poitrine)|sous (?:ses|les|son|sa) (?:vetements|habits|pull|t-shirt|culotte))",
    ),
    who: () => "pronoun",
  },
  // « un homme a touché ma fille dans le bus » — not « le film a touché ma
  // fille » nor « un homme a touché le ballon »
  {
    kind: "abuse",
    rx: g(
      `\\b(?:${ADULT}|quelqu'un|un mec|un type|un gars|un garcon|un grand)${ADULT_FROM}\\s+(?:a|avait|aurait|ont)\\s+(?:touche|tripote|pelote|caresse)\\s+(?<victim>${PERSONAL_NP}|moi)\\b${NOT_A_PLAIN_TOUCH}`,
    ),
    who: fromVictim,
  },
  // Grooming: an adult or someone met online asking a child for photos of
  // themself, a secret or a meeting (« le coach de mon fils lui demande des
  // photos de lui torse nu », « un inconnu sur Roblox veut la voir »)
  {
    kind: "abuse",
    rx: g(`\\b${GROOMER}\\s+${OBJ}\\s?(?:(?:a|avait|ont)\\s+)?(?:demande|demandent|demandait|reclame|reclamait|exige|exigeait|dit|disait|fait promettre|faisait promettre|propose|proposait|insiste pour)\\s+${GROOMING_ASK}`),
    who: fromObj,
  },
  {
    kind: "abuse",
    rx: g(`\\b${GROOMER}\\s+(?:(?:a|avait|ont)\\s+)?(?:demande|demandent|demandait|reclame|propose|proposait)\\s+a\\s+(?<victim>${PERSONAL_NP}|moi)\\s+${GROOMING_ASK}`),
    who: fromVictim,
  },
  {
    kind: "abuse",
    rx: g(`\\b${GROOMER}\\s+(?:(?:a|avait)\\s+)?(?:veut|voulait|voudrait|cherche a)\\s+(?:le|la|les|me|m'|te|t')\\s?(?:voir|rencontrer|retrouver)\\b`),
    who: () => "pronoun",
  },

  // ---- harassment ----
  { kind: "harassment", rx: g(`\\b${ABUSERS}\\s+${OBJ}\\s?${AUX}${HARASS_ACTIVE}`), who: fromObj },
  { kind: "harassment", rx: g(`\\b${HARASS}\\s+(?<victim>${PERSONAL_NP})`), who: fromVictim },
  { kind: "harassment", rx: g(`${PASSIVE_HEAD}${PASSIVE_HARASS}`), who: byPerson },
  {
    kind: "harassment",
    rx: g(
      "\\b(?:est|suis|es|sont|etait|etaient|soit|soient|sois|a ete|ont ete|ait ete|aient ete|devenu|devenue|devenus|se sent)\\s+(?:la |le |une |un |leur |sa )?(?:victime|cible|souffre-douleur|tete de turc|bouc emissaire)s?\\b(?!\\s+(?:de la mode|du succes|de son succes|d'une erreur|d'un bug|d'une arnaque|de violences?|de maltraitance|d'abus|d'attouchements|d'inceste|de viol|d'agression))",
    ),
    who: byPerson,
  },
  { kind: "abuse", rx: g("\\b(?:est|suis|es|sont|etait|soit|soient|sois|a ete|ont ete|ait ete)\\s+victimes?\\s+(?:de violences?|de maltraitance|d'abus|d'attouchements|d'inceste|de viol|d'agression)"), who: byPerson },
  {
    kind: "harassment",
    rx: g(`\\b${INTIMATE}\\s+(?:de|d')\\s*(?<victim>moi|elle|lui|${PERSONAL_NP})\\b[^.!?]{0,60}\\b${SPREAD}`),
    who: fromVictim,
  },
  {
    kind: "harassment",
    rx: g(`\\b(?:photos?|videos?)\\s+(?:de|d')\\s*(?<victim>moi|elle|lui|${PERSONAL_NP})\\s+(?:nue?s?|denudee?s?|tout nu|toute nue|en sous-vetements)\\b[^.!?]{0,60}\\b${SPREAD}`),
    who: fromVictim,
  },
  { kind: "harassment", rx: g(`\\b(?<victim>mes|ses|leurs)\\s+${INTIMATE}\\s+(?:circul\\w*|ont ete (?:partag|publi|diffus|envoy)\\w*|tourn\\w*)`), who: (m) => (m.groups?.victim === "mes" ? "personal" : "pronoun") },
  { kind: "harassment", rx: g(`\\bmenac\\w*\\s+de\\s+(?:publier|partager|diffuser|envoyer|balancer|poster|montrer)\\s+(?:des |mes |ses |les )?(?:nudes?|photos?|videos?)\\s+(?:intimes?\\s+|nues?\\s+)?(?:de|d')\\s*(?<victim>moi|elle|lui|${PERSONAL_NP})\\b`), who: fromVictim },
  {
    kind: "harassment",
    rx: g(
      `\\b${OBJ}\\s?(?:demande|demandent|demandait|a demande|ont demande|reclame|reclament|a reclame)\\s+(?:des |une |de |mes |ses )?(?:nudes?\\b|(?:photos?|videos?)\\s+(?:intimes?|nue?s?|denudee?s?|sexy|osees?|coquines?|de (?:moi|toi|elle|lui) (?:nue?|tout nu|toute nue|en sous-vetements)))`,
    ),
    who: fromObj,
  },
  { kind: "harassment", rx: g(`\\b${OBJ}\\s?(?:fait|font|faisait|faisaient|a fait|ont fait)\\s+(?:du |un )?chantage\\b`), who: fromObj },
  // « il la fait chanter » (sextortion), not « la prof la fait chanter à la chorale »
  {
    kind: "harassment",
    rx: g(`\\b${ABUSERS}\\s+${OBJ}\\s?(?:(?:a|ont|avait)\\s+)?(?:fait|font|faisait|faisaient)\\s+chanter\\b`),
    who: (m) => blackmail(m, fromObj),
  },
  // « quelqu'un fait chanter ma fille sur Instagram » — not « le prix fait
  // chanter les parents »
  {
    kind: "harassment",
    rx: g(
      `\\b(?<subj>quelqu'un|une? inconnue?|un mec|un type|un gars|des gens|on|il|elle|ils|elles|une? adulte|un homme|une femme|un garcon|une fille|des garcons|des filles|des eleves|une? eleve|son ex|un ex|une ex)(?:\\s+(?:de|d')\\s*(?:sa|ma|son|mon|leur|la|l')?\\s*(?:classe|ecole|college|lycee|equipe|club|quartier))?\\s+(?:(?:a|ont|avait)\\s+)?(?:fait|font|faisait|faisaient)\\s+chanter\\s+(?<victim>${PERSONAL_NP}|moi)\\b`,
    ),
    who: (m) => blackmail(m, fromVictim),
  },
  // The child sent them: « a envoyé des photos d'elle nue », « a envoyé des nudes »
  {
    kind: "harassment",
    rx: g(`\\b(?:envoy\\w*|partag\\w*|publi\\w*|post\\w*)\\s+(?:des |une |sa |ses |mes |les )?(?:photos?|videos?)\\s+(?:de|d')\\s*(?<victim>moi|elle|lui|${PERSONAL_NP})\\s+(?:nue?s?|denudee?s?|tout nu|toute nue|en sous-vetements)\\b`),
    who: fromVictim,
  },
  { kind: "harassment", rx: g("\\b(?:a|ai|as|ont|avait)\\s+(?:envoy\\w*|partag\\w*)\\s+(?:des |ses |mes |une )?nudes?\\b") },
  { kind: "harassment", rx: g(`\\bfai\\w*\\s+(?:du |un )?chantage\\s+(?:a|au|aux)\\s+(?<victim>moi|lui|elle|${PERSONAL_NP})\\b`), who: fromVictim },
  {
    kind: "harassment",
    rx: g(`\\b(?:tout le monde|toute la classe|ils|elles|on|des eleves|les eleves|ses camarades|mes camarades|les autres|des filles|des garcons)\\s+(?:se moque|se moquent|se moquait|se moquaient)\\s+(?:de|d')\\s*(?<victim>moi|lui|elle|eux|${PERSONAL_NP})\\b`),
    who: fromVictim,
  },
]

const KIND_ORDER: CrisisKind[] = ["suicide", "self_harm", "abuse", "harassment"]

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

/**
 * null when the message is not about a real person in distress.
 * `familyNames`: the household's first names, so « Inès se fait harceler »
 * reads as the writer's child (any other bare name is taken for a character).
 */
export function detectCrisis(
  text: string,
  opts: { familyNames?: readonly string[] } = {},
): CrisisSignal | null {
  const t = dropExpletiveNe(normalizeForCrisis(text))
  const names = new Set((opts.familyNames ?? []).map((n) => normalizeForCrisis(n).trim()).filter((n) => n.length > 1))
  const kinds = new Set<CrisisKind>()
  for (const rule of RULES) {
    if (kinds.has(rule.kind)) continue
    for (const m of t.matchAll(rule.rx)) {
      const read = rule.who ? rule.who(m) : "before"
      const who = read === "before" ? subjectBefore(t.slice(0, m.index), names) : read
      if (who === "personal" || (who === "pronoun" && !inScene(t, text, rule.kind))) {
        kinds.add(rule.kind)
        break
      }
    }
  }
  if (kinds.size === 0) return null
  return { kinds: KIND_ORDER.filter((k) => kinds.has(k)), childTyping: isChildTyping(text) }
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
