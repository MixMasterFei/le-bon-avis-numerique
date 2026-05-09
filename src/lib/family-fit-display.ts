import type { FitLevel } from "@/lib/family-fit-score"

export type FamilyFitBand = "veryAdapted" | "goodChoice" | "check" | "notYet"

export const FAMILY_FIT_LABELS: Record<FamilyFitBand, string> = {
  veryAdapted: "Tr\u00e8s adapt\u00e9",
  goodChoice: "Bon choix",
  check: "\u00c0 v\u00e9rifier",
  notYet: "Trop t\u00f4t",
}

export function familyFitBandFromLevel(level: FitLevel): FamilyFitBand {
  if (level === "excellent") return "veryAdapted"
  if (level === "good") return "goodChoice"
  if (level === "poor") return "notYet"
  return "check"
}

export function familyFitBandFromScore(score: number): FamilyFitBand {
  if (score >= 75) return "veryAdapted"
  if (score >= 66) return "goodChoice"
  if (score < 35) return "notYet"
  return "check"
}

export function familyFitLabelFromScore(score: number): string {
  return FAMILY_FIT_LABELS[familyFitBandFromScore(score)]
}
