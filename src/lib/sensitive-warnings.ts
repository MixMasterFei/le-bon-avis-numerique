// Closed vocabulary for the "Ce qui peut marquer" sensitive-warning flags.
//
// These are HEDGED, AI-generated *category* flags — never verified scene facts.
// Keeping them to a fixed list (rather than free text) structurally prevents the
// model from fabricating specific scenes ("à 0:47, un personnage meurt"), keeps
// the labels consistent/filterable, and lets us validate enrichment output with
// the shared `filterToValidList` helper exactly like toneTags / emotionalThemes.
//
// The "à vérifier" framing lives once in the card header (SensitiveWarnings.tsx),
// not in each item — so each entry is a short neutral noun-phrase.
//
// Single source of truth: consumed by the basic + deep enrich routes (prompt and
// validation) and by the Phase-2 community trigger-vote UI.
export const VALID_SENSITIVE_WARNINGS = [
  "Scènes effrayantes ou angoissantes",
  "Violence",
  "Violence intense ou graphique",
  "Sang ou blessures",
  "Thèmes de mort ou de deuil",
  "Séparation ou abandon",
  "Langage grossier",
  "Références ou contenu sexuel",
  "Nudité",
  "Consommation d'alcool ou de tabac",
  "Consommation de drogues",
  "Détresse émotionnelle",
  "Maltraitance ou harcèlement",
  "Images dérangeantes",
  "Suspense ou tension intense",
  "Thèmes matures ou complexes",
  "Comportements à risque imités",
  // ── Specific triggers (community-votable, doesthedogdie-style) ──
  // Added for the fiche "Signaler un élément" picker; the AI may also flag
  // them at enrichment when the synopsis supports it. Same closed-vocabulary
  // rule as above: short neutral noun-phrases, no scene claims.
  "Mort d'un animal",
  "Maladie grave ou cancer",
  "Hôpital ou scènes médicales",
  "Automutilation ou suicide",
  "Violence domestique",
  "Harcèlement scolaire",
  "Accident de voiture",
  "Noyade",
  "Divorce ou séparation des parents",
  "Guerre",
  "Catastrophe naturelle",
  "Aiguilles ou piqûres",
  "Vomissements",
  "Araignées, serpents ou insectes",
  "Clowns effrayants",
  // ── Contenu d'époque ──
  // Beaucoup de classiques familiaux (de Funès, Rabbi Jacob, comédies des
  // années 60-80) reposent sur des ressorts comiques aujourd'hui datés :
  // stéréotypes de genre, d'origine ou de religion joués pour le rire. Les
  // parents veulent le savoir AVANT de lancer le film avec un enfant — c'est
  // un repère de contexte, pas un jugement sur l'œuvre ni un appel à la
  // censurer. Sans ces catégories, l'enrichissement n'avait aucun moyen de
  // signaler l'information : elle se diluait dans un « ton d'époque » vague
  // au milieu de whatParentsNeedToKnow.
  "Stéréotypes datés",
  "Humour à connotation ethnique ou religieuse",
] as const

export type SensitiveWarning = (typeof VALID_SENSITIVE_WARNINGS)[number]

// Community-consensus rule shared by every community vote (age votes AND
// Phase 2 trigger votes): a claim needs at least `minVotes` votes; >= minPercent
// agreement promotes it to confirmed, <= (100-minPercent) marks it
// community-rejected. This is the single source of truth — read by the APIs, the
// UI badges, and the expectations registry so the rule never drifts.
export const COMMUNITY_CONSENSUS = { minVotes: 5, minPercent: 70 } as const

/** @deprecated Use {@link COMMUNITY_CONSENSUS}. Kept as an alias for trigger-vote call sites. */
export const TRIGGER_CONSENSUS = COMMUNITY_CONSENSUS


/** Below this enrichment confidence the AI flags are not shown (fiche and /md layer alike). */
export const WARNINGS_MIN_CONFIDENCE = 0.6

/**
 * What « Ce qui peut marquer » may honestly say about the AI flags:
 *  - "flagged": at least one category to show;
 *  - "nothing_flagged": a confident automated pass ran and flagged nothing —
 *    still NOT « rien à signaler »: it reads a synopsis, not every scene;
 *  - "no_data": never computed (no analysis / legacy row), or computed below
 *    the confidence gate — we know nothing yet.
 * An empty list must never read as an affirmative « no concern » (« Amélie et
 * la métaphysique des tubes » showed « Aucun point signalé » over two
 * near-drownings, a wartime bereavement and a grandmother's death).
 * A confident legacy row whose flags predate `sensitiveWarningsAt` still counts.
 */
export type AiWarningsState = "flagged" | "nothing_flagged" | "no_data"

export function aiWarningsState(input: {
  warnings: readonly string[] | null | undefined
  assessedAt: Date | string | null | undefined
  confidence: number | null | undefined
}): { state: AiWarningsState; items: string[] } {
  const warnings = [...(input.warnings ?? [])]
  const confident = (input.confidence ?? 0) >= WARNINGS_MIN_CONFIDENCE
  if (!confident || (!input.assessedAt && warnings.length === 0)) return { state: "no_data", items: [] }
  return warnings.length > 0 ? { state: "flagged", items: warnings } : { state: "nothing_flagged", items: [] }
}
