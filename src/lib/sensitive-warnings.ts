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

// Community-consensus rule for Phase 2 trigger votes, mirroring the age-vote
// threshold (>5 votes & >70% agreement). A category needs at least `minVotes`
// votes; >= minPercent "present" promotes it to confirmed, <= (100-minPercent)
// "present" marks it community-rejected. Read by both the API and the UI so the
// rule never drifts.
export const TRIGGER_CONSENSUS = { minVotes: 5, minPercent: 70 } as const

