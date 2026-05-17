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

// ---------------------------------------------------------------------------
// Two-axis verdicts (Phase 0.2)
//
// The family-fit card surfaces two independent badges per member:
//   - AGE        : is this member chronologically in range?
//   - PRÉFÉRENCES: does this match their tolerance + tastes?
//
// Splitting them removes the old conflation where Erwan (14) on Avengers (10+)
// was tagged "Trop tôt" because the single conflated score dipped under 35 due
// to mature-content metrics — the age axis is actually fine.
// ---------------------------------------------------------------------------

export type AgePillar =
  | "ok"          // memberAge >= expertAgeRec; safe to recommend
  | "borderline"  // memberAge is within 1 year above expertAgeRec
  | "tooEarly"    // memberAge < expertAgeRec by ≥1 year
  | "tooLate"     // content is far too young (gap < -5) for an older member
  | "unknown"     // either age missing → confirm with parent

export type PreferencePillar =
  | "love"        // matches favorite genres + interests strongly
  | "good"        // matches preferences with no concerns
  | "check"       // mature content caution / borderline sensitivity / missing signal
  | "avoid"       // disliked genre / avoid topic / sensitivity hit
  | "noProfile"   // member hasn't done the quiz yet

export interface AgeVerdict {
  pillar: AgePillar
  label: string
  detail: string | null
}

export interface PreferenceVerdict {
  pillar: PreferencePillar
  label: string
  reasons: string[]
}

export const AGE_PILLAR_LABELS: Record<AgePillar, string> = {
  ok: "\u00c2ge OK",
  borderline: "Limite d'\u00e2ge",
  // "Trop tôt" reads correctly only when the *member* is too young for the
  // *content*. Reserved strictly for that direction.
  tooEarly: "Trop t\u00f4t",
  // Inverted case — content is years younger than the member. Use neutral
  // wording so a parent reading "Mathis · Trop tôt" on a kid game stops
  // wondering whether it's the kid or the content that's the problem.
  tooLate: "Un peu jeune",
  unknown: "\u00c2ge \u00e0 confirmer",
}

export const PREFERENCE_PILLAR_LABELS: Record<PreferencePillar, string> = {
  love: "Correspond \u00e0 ses go\u00fbts",
  good: "Bon choix",
  check: "\u00c0 v\u00e9rifier",
  avoid: "Pas pour ce profil",
  noProfile: "Profil \u00e0 compl\u00e9ter",
}

// Maps the two pillars back to the legacy FitLevel so consumers that still
// read `member.level` keep working unchanged. Top-down evaluation, first
// match wins — the 25-cell matrix is exhaustive.
export function legacyLevelFromPillars(
  age: AgePillar,
  pref: PreferencePillar,
): FitLevel {
  // Hard rejects: explicit dislike OR member too young for the content.
  // tooLate is *not* in this list — content being years younger than the
  // member is a taste signal, not a safety one. A 14yo enjoying a 7+
  // Nintendo title shouldn't be flagged "poor" / "Trop tôt".
  if (age === "tooEarly" || pref === "avoid") return "poor"

  // No information either side — defer to "moderate" review band
  if (age === "unknown" && pref === "noProfile") return "moderate"

  // Borderline age or generic caution — moderate
  if (age === "borderline" || pref === "check") return "moderate"

  // Best case
  if (age === "ok" && pref === "love") return "excellent"

  // Age OK + reasonable preference match
  if (age === "ok" && pref === "good") return "good"
  if (age === "ok" && pref === "noProfile") return "good"

  // Age unknown but the preference path was clear
  if (age === "unknown" && pref === "love") return "good"
  if (age === "unknown" && pref === "good") return "moderate"

  // tooLate (content is years younger than member). Treat the pref pillar
  // as the deciding axis — never auto-poor, only auto-poor was via the
  // avoid pref which is handled by the first rule.
  if (age === "tooLate" && pref === "love") return "good"
  if (age === "tooLate" && pref === "good") return "good"
  if (age === "tooLate" && pref === "noProfile") return "good"

  // Fallback — should be unreachable given the matrix above
  return "moderate"
}

export function ageVerdictFromAges(
  memberAge: number | null,
  expertAgeRec: number | null,
): AgeVerdict {
  if (memberAge == null || expertAgeRec == null) {
    return {
      pillar: "unknown",
      label: AGE_PILLAR_LABELS.unknown,
      detail: memberAge != null && expertAgeRec == null
        ? "\u00c2ge expert \u00e0 confirmer"
        : null,
    }
  }
  const gap = expertAgeRec - memberAge
  if (gap <= -6) {
    return {
      pillar: "tooLate",
      label: AGE_PILLAR_LABELS.tooLate,
      detail: `${memberAge} ans \u00b7 d\u00e8s ${expertAgeRec} ans`,
    }
  }
  if (gap >= 2) {
    return {
      pillar: "tooEarly",
      label: AGE_PILLAR_LABELS.tooEarly,
      detail: `${memberAge} ans \u00b7 d\u00e8s ${expertAgeRec} ans`,
    }
  }
  if (gap === 1) {
    return {
      pillar: "borderline",
      label: AGE_PILLAR_LABELS.borderline,
      detail: `${memberAge} ans \u00b7 d\u00e8s ${expertAgeRec} ans`,
    }
  }
  return {
    pillar: "ok",
    label: AGE_PILLAR_LABELS.ok,
    detail: `${memberAge} ans \u00b7 d\u00e8s ${expertAgeRec} ans`,
  }
}
