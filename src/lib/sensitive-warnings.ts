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

