// Per-member preference vector — the Phase 2 behavioral signal layer.
//
// What it does
//   • Aggregates each member's reactions (organic + quiz_anchor) into a
//     small numeric vector of genre / topic / tone weights plus observed
//     content-metric tolerances.
//   • Powers a cosine-similarity ranker that lifts titles matching the
//     member's profile, alongside the existing rule-based scoring.
//   • Surfaces "learned" tolerances back into computeMatureContentPenalty
//     so a kid who LOVED Indiana Jones doesn't get re-flagged on the next
//     action film he could already handle.
//
// Perf contract
//   • Vector write on reaction mutation: <50ms synchronous (pure JS aggregate,
//     no joins beyond reaction rows themselves).
//   • Vector read inside a family-fit fetch: O(1) — already loaded with the
//     FamilyMember row.
//   • Cosine on the read path: O(|vocab|) per media item — bounded for the
//     batch fit endpoint.
//
// Scaling fallback (out of scope now, called out so the next contributor
// doesn't build the bottleneck)
//   • If evidenceCount exceeds ~500 reactions for a single member, the
//     synchronous-on-write recompute will exceed the 50ms budget. Either
//     limit aggregation to the last N reactions, or move recompute to a
//     queue job driven by lastVectorUpdateAt.

import { normalizeTag, normalizeTags } from "./vocabulary"

export interface MemberVector {
  genreWeights: Record<string, number>
  topicWeights: Record<string, number>
  toneWeights: Record<string, number>
  observedTolerances: {
    violence: number | null
    sexNudity: number | null
    language: number | null
    substanceUse: number | null
  }
  // Number of LOVED + LIKED reactions feeding the vector. Used as the gate
  // for `observedTolerances` (≥3 required) and exposed to the UI.
  evidenceCount: number
  computedAt: string
}

export const EMPTY_VECTOR: MemberVector = {
  genreWeights: {},
  topicWeights: {},
  toneWeights: {},
  observedTolerances: {
    violence: null,
    sexNudity: null,
    language: null,
    substanceUse: null,
  },
  evidenceCount: 0,
  computedAt: new Date(0).toISOString(),
}

// Weights applied per reaction type when aggregating. LOVED/LIKED count
// positively; SCARED/BORED/TOO_OLD/NOT_FOR_ME count negatively. WATCHED is a
// small positive nudge (completion is a real, if weaker, signal).
// WANTS_TO_WATCH is declared pre-watch interest — a genuine but soft taste
// signal (they liked the look/genre), weighted below a post-watch LIKED.
const REACTION_WEIGHTS: Record<string, number> = {
  LOVED: 2.0,
  LIKED: 1.0,
  WANTS_TO_WATCH: 0.75,
  WATCHED: 0.5,
  OK: 0.25,
  BORED: -1.0,
  TOO_OLD: -1.0,
  TOO_YOUNG: -0.5,
  SCARED: -1.5,
  NOT_FOR_ME: -2.0,
}

// Reactions that count toward the "I genuinely engaged with this title in a
// way that reveals tolerance" signal feeding observedTolerances. LIKED and
// WATCHED don't make the cut — a "watched" reaction without enthusiasm isn't
// strong enough evidence that the member's tolerance is comfortable.
const POSITIVE_TOLERANCE_REACTIONS = new Set(["LOVED", "LIKED"])
const TOLERANCE_EVIDENCE_THRESHOLD = 3

export interface ReactionForAggregation {
  reaction: string
  // organic | quiz_anchor — currently unused in aggregation (both contribute
  // to the vector by design) but passed so future tweaks have it on hand.
  source?: string
  media: {
    genres?: string[] | null
    topics?: string[] | null
    contentMetrics?: {
      violence?: number | null
      sexNudity?: number | null
      language?: number | null
      substanceUse?: number | null
      toneTags?: string[] | null
    } | null
  }
}

// Builds the vector from scratch given the full reactions list for one
// member. Deterministic and pure — safe for unit tests and for the on-write
// recompute path.
export function computeMemberVector(
  reactions: readonly ReactionForAggregation[],
): MemberVector {
  const genreWeights: Record<string, number> = {}
  const topicWeights: Record<string, number> = {}
  const toneWeights: Record<string, number> = {}

  // Buckets of metric values from POSITIVE_TOLERANCE_REACTIONS for the P75
  // computation below. Each axis collects independently because not every
  // title's content_metrics row has all four fields populated.
  const violenceObs: number[] = []
  const sexObs: number[] = []
  const langObs: number[] = []
  const substObs: number[] = []

  let evidenceCount = 0

  for (const r of reactions) {
    const w = REACTION_WEIGHTS[r.reaction] ?? 0
    if (w === 0) continue

    for (const g of normalizeTags(r.media.genres ?? [])) {
      genreWeights[g] = (genreWeights[g] ?? 0) + w
    }
    for (const t of normalizeTags(r.media.topics ?? [])) {
      topicWeights[t] = (topicWeights[t] ?? 0) + w
    }
    for (const t of normalizeTags(r.media.contentMetrics?.toneTags ?? [])) {
      // SCARED is interpreted as "this tone (often 'Effrayant et angoissant')
      // was too much" — the negative weight is already in REACTION_WEIGHTS,
      // but we also tag the tone axis specifically so the reverse direction
      // shows up in the vector.
      toneWeights[t] = (toneWeights[t] ?? 0) + w
    }

    if (POSITIVE_TOLERANCE_REACTIONS.has(r.reaction)) {
      evidenceCount++
      const m = r.media.contentMetrics
      if (m?.violence != null) violenceObs.push(m.violence)
      if (m?.sexNudity != null) sexObs.push(m.sexNudity)
      if (m?.language != null) langObs.push(m.language)
      if (m?.substanceUse != null) substObs.push(m.substanceUse)
    }
  }

  return {
    genreWeights,
    topicWeights,
    toneWeights,
    observedTolerances: {
      violence: tolerancePercentile(violenceObs),
      sexNudity: tolerancePercentile(sexObs),
      language: tolerancePercentile(langObs),
      substanceUse: tolerancePercentile(substObs),
    },
    evidenceCount,
    computedAt: new Date().toISOString(),
  }
}

// 75th-percentile of a metric across qualifying reactions. Requires
// TOLERANCE_EVIDENCE_THRESHOLD (3) observations before it returns anything —
// otherwise a single outlier (one LOVED John Wick) would lift the bar for
// the entire member. Returns null when below threshold.
function tolerancePercentile(values: number[]): number | null {
  if (values.length < TOLERANCE_EVIDENCE_THRESHOLD) return null
  const sorted = [...values].sort((a, b) => a - b)
  const idx = Math.floor(0.75 * (sorted.length - 1))
  return sorted[idx]
}

// ---------------------------------------------------------------------------
// Cosine similarity (the Phase 2.2 personalized score)
// ---------------------------------------------------------------------------

// Builds a vector from the media item itself — the "what is this title?"
// side of the cosine comparison. Each present tag contributes 1.0 to its
// axis, so the magnitude scales with how richly tagged the item is.
export function buildMediaVector(media: {
  genres?: string[] | null
  topics?: string[] | null
  toneTags?: string[] | null
}): Record<string, number> {
  const v: Record<string, number> = {}
  for (const g of normalizeTags(media.genres ?? [])) {
    v[`g:${g}`] = (v[`g:${g}`] ?? 0) + 1
  }
  for (const t of normalizeTags(media.topics ?? [])) {
    v[`t:${t}`] = (v[`t:${t}`] ?? 0) + 1
  }
  for (const t of normalizeTags(media.toneTags ?? [])) {
    v[`n:${t}`] = (v[`n:${t}`] ?? 0) + 1
  }
  return v
}

// Flattens the member vector to the same prefixed key space as buildMediaVector
// so the two can be cosine-compared on a shared axis.
export function flattenMemberVector(mv: MemberVector): Record<string, number> {
  const out: Record<string, number> = {}
  for (const [k, v] of Object.entries(mv.genreWeights)) out[`g:${k}`] = v
  for (const [k, v] of Object.entries(mv.topicWeights)) out[`t:${k}`] = v
  for (const [k, v] of Object.entries(mv.toneWeights)) out[`n:${k}`] = v
  return out
}

// Returns a value in [-1, 1] for ordinary cosine. We then map to [0, 1] so
// it can plug into the existing 0..1 weighted-score components. Empty vectors
// (cold start) yield 0.5 = neutral, no impact on rank.
export function personalizedScore(
  memberVector: MemberVector,
  media: { genres?: string[] | null; topics?: string[] | null; toneTags?: string[] | null },
): number {
  if (memberVector.evidenceCount === 0) return 0.5

  const a = flattenMemberVector(memberVector)
  const b = buildMediaVector(media)

  let dot = 0
  let na = 0
  let nb = 0
  // The member vector usually has more axes than the media; iterate the
  // shorter one to stay O(|media tags|).
  for (const [k, vb] of Object.entries(b)) {
    nb += vb * vb
    const va = a[k] ?? 0
    if (va !== 0) dot += va * vb
  }
  for (const va of Object.values(a)) na += va * va

  if (na === 0 || nb === 0) return 0.5
  const cos = dot / (Math.sqrt(na) * Math.sqrt(nb))
  // Map [-1, 1] → [0, 1] so it composes with the other 0..1 components.
  return Math.max(0, Math.min(1, (cos + 1) / 2))
}

// ---------------------------------------------------------------------------
// Phase 2.3 — observedTolerances → effective sensitivity
// ---------------------------------------------------------------------------
//
// Scales involved:
//   • metric.violence etc.: 0–5 (content_metrics).
//   • member.sensitivity* : 0–3 (quiz output, 0 = tolerant, 3 = strict).
//   • observedToleranceP75: 0–5 (same scale as the metric).
//
// learnedTolerance_03 = clamp(0, 3, 4 - observedToleranceP75)
//   observedP75=5 → -1 → clamp 0 (very tolerant)
//   observedP75=4 → 0
//   observedP75=3 → 1
//   observedP75=2 → 2
//   observedP75=1 → 3
//   observedP75=0 → 4 → clamp 3 (no relaxation)
//
// effectiveSensitivity = max(stated - 1, min(stated, learnedTolerance_03))
//   - behavioral evidence can lower the stated sensitivity by at most one
//     step (defensible to the parent: "we relaxed by one notch")
//   - if behavior suggests *more* strictness than declared, we cap at
//     stated — declared remains the upper bound on strictness
export function effectiveSensitivity(
  stated: number,
  observedToleranceP75: number | null,
): number {
  if (observedToleranceP75 == null) return stated
  const learned = Math.max(0, Math.min(3, 4 - observedToleranceP75))
  return Math.max(stated - 1, Math.min(stated, learned))
}

// Convenience wrapper — derives all four axes at once, returning undefined
// fields when the member vector has no observation for that axis. Shape
// matches `MatureContentMemberSensitivity` so the result can be spread.
export function effectiveSensitivityVector(
  stated: {
    violence: number
    sexual: number
    language: number
    substances: number
  },
  observed: MemberVector["observedTolerances"],
): { violence: number; sexual: number; language: number; substances: number } {
  return {
    violence: effectiveSensitivity(stated.violence, observed.violence),
    sexual: effectiveSensitivity(stated.sexual, observed.sexNudity),
    language: effectiveSensitivity(stated.language, observed.language),
    substances: effectiveSensitivity(stated.substances, observed.substanceUse),
  }
}

// ---------------------------------------------------------------------------
// Transparency helpers (Phase 2.4 UI consumer)
// ---------------------------------------------------------------------------

export interface InferredPreference {
  axis: "genre" | "topic" | "tone"
  key: string
  weight: number
}

// Top-K positive signals from the vector — used by the Member Corner
// transparency panel to render "Comment {name} a évolué".
export function topInferredPreferences(
  mv: MemberVector,
  k: number = 3,
): InferredPreference[] {
  const all: InferredPreference[] = []
  for (const [key, weight] of Object.entries(mv.genreWeights)) {
    if (weight > 0) all.push({ axis: "genre", key, weight })
  }
  for (const [key, weight] of Object.entries(mv.topicWeights)) {
    if (weight > 0) all.push({ axis: "topic", key, weight })
  }
  for (const [key, weight] of Object.entries(mv.toneWeights)) {
    if (weight > 0) all.push({ axis: "tone", key, weight })
  }
  all.sort((a, b) => b.weight - a.weight)
  return all.slice(0, k)
}

// Re-export the vocab helpers so consumers don't have to import from two paths.
export { normalizeTag, normalizeTags }
