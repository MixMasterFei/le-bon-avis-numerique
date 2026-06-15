import type { FamilyFitBand } from "@/lib/family-fit-display"

/**
 * Per-member identity colors for the V2 "POUR" appreciation meters
 * (FamilyFitMeter) and the catalogue "Adapter à" selected rows. The design
 * colors the meter by *who* the member is (identity), while the fill height
 * conveys the verdict (band). Assigned by member order so a family reads as
 * a stable, distinguishable set. Pulled from the catalogue mock palette
 * (terra / blue / green / gold / pine / plum…), extended to cover up to 10
 * members without repeats becoming confusing.
 */
export const V2_MEMBER_COLORS = [
  "#C5512C", // terra
  "#2C6FA8", // blue
  "#2E7D5B", // green
  "#D99524", // gold
  "#7A4FA0", // plum
  "#23493D", // pine
  "#B83A5E", // rose
  "#3E7C8C", // teal
  "#9A6A2C", // bronze
  "#5C6BC0", // indigo
] as const

/** Stable identity color for a member by its position in the family list. */
export function memberColor(index: number): string {
  return V2_MEMBER_COLORS[index % V2_MEMBER_COLORS.length]
}

/**
 * Deterministic identity color from a name — used where we render a member
 * monogram without knowing its position in the family list (e.g. the global
 * MemberAvatar's V2 fallback). Same name always maps to the same palette color.
 */
export function memberColorFromName(name: string): string {
  let hash = 0
  for (let i = 0; i < name.length; i++) {
    hash = (hash * 31 + name.charCodeAt(i)) >>> 0
  }
  return V2_MEMBER_COLORS[hash % V2_MEMBER_COLORS.length]
}

/**
 * Verdict band → number of lit segments on the 3-segment vertical meter.
 * Mirrors BAND_TO_HEARTS in FamilyFitAvatars so the V2 meter and the classic
 * heart gauge encode the exact same verdict for a given title.
 */
export const BAND_TO_SEGMENTS: Record<FamilyFitBand, number> = {
  veryAdapted: 3,
  goodChoice: 2,
  check: 1,
  notYet: 0,
}
