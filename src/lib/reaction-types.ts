/**
 * Single source of truth for the per-member reaction vocabulary.
 *
 * The reaction pipe is the site's most valuable data: every tap on a poster
 * bar or a fiche writes one of these values through /api/user/reaction, feeds
 * the member's preference vector, and shows up in the Member Corner history.
 * Keeping the list here — instead of inlined per-surface — lets a sync test
 * (src/lib/__tests__/reaction-types.test.ts) prove that the Prisma enum, the
 * API allow-list, the vector weights and every UI label stay in agreement.
 * Add a new reaction type HERE first; the tests will point at every other
 * place that must learn about it.
 */

// Mirrors `enum ReactionType` in prisma/schema.prisma (asserted by test).
export const VALID_REACTIONS = [
  "WATCHED",
  "LOVED",
  "LIKED",
  "OK",
  "SCARED",
  "BORED",
  "TOO_YOUNG",
  "TOO_OLD",
  "NOT_FOR_ME",
  "WANTS_TO_WATCH",
] as const

export type ReactionValue = (typeof VALID_REACTIONS)[number]

export function isValidReaction(value: unknown): value is ReactionValue {
  return typeof value === "string" && (VALID_REACTIONS as readonly string[]).includes(value)
}

/**
 * Base French labels, one per reaction type. WATCHED is the only label that
 * varies by media type (vu / joué / lu) — use `reactionLabelFr(value, type)`
 * anywhere a media type is known.
 */
export const REACTION_FR_LABELS: Record<ReactionValue, string> = {
  WATCHED: "Déjà vu",
  LOVED: "Adoré",
  LIKED: "Bien aimé",
  OK: "Bof",
  SCARED: "A eu peur",
  BORED: "S'est ennuyé",
  TOO_YOUNG: "Trop jeune",
  TOO_OLD: "Pas intéressé",
  NOT_FOR_ME: "Pas pour nous",
  WANTS_TO_WATCH: "À voir",
}

/** Per-type wording for "seen it" — a game is *joué*, a book *lu*. */
export function seenLabelFr(mediaType?: string): string {
  switch (mediaType) {
    case "GAME":
      return "Déjà joué"
    case "BOOK":
    case "MANGA":
      return "Déjà lu"
    default:
      return "Déjà vu"
  }
}

/** French label for a reaction, with WATCHED adapted to the media type. */
export function reactionLabelFr(value: string, mediaType?: string): string {
  if (value === "WATCHED") return seenLabelFr(mediaType)
  return REACTION_FR_LABELS[value as ReactionValue] ?? value
}

// A parent-written note on a reaction is free text; cap it so a paste bomb
// can't bloat the row (the UI never renders more than a short remark anyway).
export const MAX_REACTION_NOTE_LENGTH = 500
