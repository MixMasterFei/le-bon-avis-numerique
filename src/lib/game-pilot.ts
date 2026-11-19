/**
 * The game « augmentation » pilot (approved by Xavier on 19 Nov 2026) —
 * phase 1: 100 treated game fiches get the « Fiche pratique » block, a visible
 * « Pourquoi cet âge ? », every parent point and younger alternatives; 100
 * matched control fiches get NOTHING, so the two groups can be compared in
 * Search Console.
 *
 * Pure and dependency-free: imported by the fiche (server) and the
 * game-facts writer. Ids are media_items ids.
 *
 * Selection: see the comment above GAME_PILOT_TREATED_IDS.
 */

// Filled by the selection query (step 4).
export const GAME_PILOT_TREATED_IDS: readonly string[] = []

export const GAME_PILOT_CONTROL_IDS: readonly string[] = []

const TREATED = new Set(GAME_PILOT_TREATED_IDS)
const CONTROL = new Set(GAME_PILOT_CONTROL_IDS)

/** True for a TREATED pilot fiche (the only ones that change). */
export function isGamePilot(id: string | null | undefined): boolean {
  return typeof id === "string" && TREATED.has(id)
}

/** True for a CONTROL fiche — kept exactly as it is, for comparison. */
export function isGamePilotControl(id: string | null | undefined): boolean {
  return typeof id === "string" && CONTROL.has(id)
}
