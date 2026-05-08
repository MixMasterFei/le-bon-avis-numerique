import type { FitLevel } from "@/lib/family-fit-score"

export type FamilyFitBand = "veryAdapted" | "goodChoice" | "check"

export const FAMILY_FIT_LABELS: Record<FamilyFitBand, string> = {
  veryAdapted: "Très adapté",
  goodChoice: "Bon choix",
  check: "À vérifier",
}

export function familyFitBandFromLevel(level: FitLevel): FamilyFitBand {
  if (level === "excellent") return "veryAdapted"
  if (level === "good") return "goodChoice"
  return "check"
}

export function familyFitBandFromScore(score: number): FamilyFitBand {
  if (score >= 75) return "veryAdapted"
  if (score >= 60) return "goodChoice"
  return "check"
}

export function familyFitLabelFromScore(score: number): string {
  return FAMILY_FIT_LABELS[familyFitBandFromScore(score)]
}
