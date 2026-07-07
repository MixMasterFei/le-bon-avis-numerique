// Signed per-title affinity — "the more you fill, the better the system".
//
// A member's reactions on titles SIMILAR to the current one (via the
// pre-computed MediaSimilarity graph) are averaged into one signed signal:
// positives (Adoré / Bien aimé) pull the current title up, negatives (Pas
// intéressé / S'est ennuyé / Bof…) pull it down, and a mixed history lands in
// the middle. Example the product promise is built on: Stéphanie LOVED GTA V
// but marked GTA IV "pas intéressé" → another GTA scores ~neutral, not
// "Bon choix".
//
// Used by both fit routes (fiche panel + homepage/batch card avatars) so the
// two surfaces never disagree about what a reaction meant.

// Taste value of each reaction type, in [-1, 1]. WATCHED is presence-only
// (no valence) and TOO_YOUNG is an age signal, not a taste one — both weak.
const REACTION_VALUE: Record<string, number> = {
  LOVED: 1.0,
  LIKED: 0.6,
  WATCHED: 0,
  OK: -0.3, // "Bof"
  SCARED: -0.5,
  BORED: -0.7,
  TOO_YOUNG: -0.2,
  TOO_OLD: -1.0, // "Pas intéressé"
  NOT_FOR_ME: -1.0,
}

/** Reaction types worth fetching for affinity (everything with a valence). */
export const AFFINITY_REACTIONS = Object.keys(REACTION_VALUE).filter(
  (r) => REACTION_VALUE[r] !== 0,
)

/** Explicit per-title dismissals — hard "never show as a fit" signals. */
export const DISMISSAL_REACTIONS = ["TOO_OLD", "NOT_FOR_ME"] as const

export interface AffinityReaction {
  mediaId: string
  reaction: string
  mediaTitle?: string | null
}

export interface SignedAffinityConnection {
  title: string
  reaction: string
  positive: boolean
}

export interface SignedAffinity {
  /** 0..1 — 0.5 is neutral, >0.5 similar titles were liked, <0.5 disliked. */
  score: number
  /** Strongest positive and negative links, for the reason string. */
  bestPositive: SignedAffinityConnection | null
  bestNegative: SignedAffinityConnection | null
  /** Human reason, e.g. "A adoré GTA V · pas intéressé par GTA IV". */
  reason: string | null
  /** How many similar reacted titles fed the mean. */
  evidence: number
}

function frLabel(reaction: string): string {
  switch (reaction) {
    case "LOVED": return "a adoré"
    case "LIKED": return "a bien aimé"
    case "OK": return "a trouvé bof"
    case "SCARED": return "a eu peur de"
    case "BORED": return "s'est ennuyé devant"
    case "TOO_OLD":
    case "NOT_FOR_ME": return "pas intéressé par"
    case "TOO_YOUNG": return "trop jeune pour"
    default: return "a vu"
  }
}

/**
 * Average a member's reactions over the similarity graph of the current title.
 * `similarMediaMap` maps similar-media id → similarity score (0..1); only
 * reactions on titles present in the map contribute, weighted by similarity.
 * Returns null when no similar title has a reaction (caller keeps its
 * genre-history fallback).
 */
export function computeSignedAffinity(
  reactions: AffinityReaction[],
  similarMediaMap: Map<string, number>,
): SignedAffinity | null {
  let weighted = 0
  let totalWeight = 0
  let evidence = 0
  let bestPositive: (SignedAffinityConnection & { strength: number }) | null = null
  let bestNegative: (SignedAffinityConnection & { strength: number }) | null = null

  for (const r of reactions) {
    const sim = similarMediaMap.get(r.mediaId)
    if (sim === undefined) continue
    const value = REACTION_VALUE[r.reaction] ?? 0
    if (value === 0) continue

    weighted += value * sim
    totalWeight += sim
    evidence++

    const strength = Math.abs(value) * sim
    const conn: SignedAffinityConnection & { strength: number } = {
      title: r.mediaTitle ?? "",
      reaction: r.reaction,
      positive: value > 0,
      strength,
    }
    if (value > 0) {
      if (!bestPositive || strength > bestPositive.strength) bestPositive = conn
    } else {
      if (!bestNegative || strength > bestNegative.strength) bestNegative = conn
    }
  }

  if (evidence === 0 || totalWeight === 0) return null

  // Signed mean in [-1, 1] → [0, 1] with 0.5 neutral.
  const score = Math.max(0, Math.min(1, (weighted / totalWeight + 1) / 2))

  const parts: string[] = []
  if (bestPositive?.title) {
    parts.push(`${frLabel(bestPositive.reaction).charAt(0).toUpperCase()}${frLabel(bestPositive.reaction).slice(1)} ${bestPositive.title}`)
  }
  if (bestNegative?.title) {
    parts.push(`${frLabel(bestNegative.reaction)} ${bestNegative.title}`)
  }

  return {
    score,
    bestPositive: bestPositive ? { title: bestPositive.title, reaction: bestPositive.reaction, positive: true } : null,
    bestNegative: bestNegative ? { title: bestNegative.title, reaction: bestNegative.reaction, positive: false } : null,
    reason: parts.length > 0 ? parts.join(" · ") : null,
    evidence,
  }
}
