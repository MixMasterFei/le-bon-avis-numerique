/**
 * Expectations registry — the site's behavioral "contract", expressed as small
 * pure checks over the LIVE code constants (never copies of them). This is the
 * single oracle shared by two consumers:
 *
 *   1. `expectations.test.ts` asserts every `invariant` holds → blocks CI on a
 *      regression.
 *   2. The weekly debt digest (`debt-digest.ts`) renders `runExpectationChecks()`
 *      under "## Conformité aux attentes" so any divergence reaches Xavier's
 *      inbox and becomes a triage item.
 *
 * Severity:
 *   • "invariant" — a hard contract. If it breaks, the build should go red.
 *   • "report"   — a soft expectation / judgment call. Surfaced in the weekly
 *      digest for review, but NOT asserted in CI (this is what lets the weekly
 *      statement carry divergences we want to decide on rather than auto-fail).
 *
 * IMPORTANT: each `check` must READ an exported constant. If you find yourself
 * writing a literal here that duplicates a magic number, extract the constant
 * to its module first and import it — otherwise this file becomes a second
 * source of truth that drifts in its own right.
 *
 * Out of scope for v1 (intentionally NOT modeled here):
 *   • "the age recommendation stays visible while the content analysis is
 *     hidden" — that lives in the fiche page / family-fit route, not in a pure
 *     constant, so it can't be a code invariant. Covered by release-status tests
 *     + e2e; a DB-backed conformance audit is deferred to a v2 digest section.
 */

import { FIT_WEIGHTS } from "@/lib/family-fit-score"
import { COMMUNITY_CONSENSUS } from "@/lib/sensitive-warnings"
import { RECS_THRESHOLDS } from "@/lib/recs-constants"
import { MAX_FAMILY_MEMBERS, MAX_FAMILY_INTERESTS } from "@/lib/family-constants"
import { UNRELEASED_TMDB_STATUSES } from "@/lib/release-status"

export type ExpectationSeverity = "invariant" | "report"

export interface Expectation {
  id: string
  label: string
  severity: ExpectationSeverity
  check: () => { ok: boolean; detail: string }
}

export interface ExpectationResult {
  id: string
  label: string
  severity: ExpectationSeverity
  ok: boolean
  detail: string
}

function sameSet(a: readonly string[], b: readonly string[]): boolean {
  if (a.length !== b.length) return false
  const sb = new Set(b)
  return a.every((x) => sb.has(x))
}

export const EXPECTATIONS: Expectation[] = [
  {
    id: "fit-weights-sum",
    label: "Les poids du score Family Fit forment une partition de 1.0",
    severity: "invariant",
    check: () => {
      const total = Object.values(FIT_WEIGHTS).reduce((s, w) => s + w, 0)
      return {
        ok: Math.abs(total - 1) < 1e-9,
        detail: `somme des poids = ${total.toFixed(4)} (attendu 1.0000)`,
      }
    },
  },
  {
    id: "community-consensus",
    label: "Le seuil de consensus communautaire est 5 votes / 70 %",
    severity: "invariant",
    check: () => {
      const ok = COMMUNITY_CONSENSUS.minVotes === 5 && COMMUNITY_CONSENSUS.minPercent === 70
      return {
        ok,
        detail: `minVotes=${COMMUNITY_CONSENSUS.minVotes}, minPercent=${COMMUNITY_CONSENSUS.minPercent}`,
      }
    },
  },
  {
    id: "recs-thresholds",
    label: "Les seuils de recommandation sont minMemberFit=66 / qualityFloor=70",
    severity: "invariant",
    check: () => {
      const ok = RECS_THRESHOLDS.minMemberFit === 66 && RECS_THRESHOLDS.qualityFloor === 70
      return {
        ok,
        detail: `minMemberFit=${RECS_THRESHOLDS.minMemberFit}, qualityFloor=${RECS_THRESHOLDS.qualityFloor}`,
      }
    },
  },
  {
    id: "family-caps",
    label: "Les limites famille sont 10 membres / 20 centres d'intérêt",
    severity: "invariant",
    check: () => {
      const ok = MAX_FAMILY_MEMBERS === 10 && MAX_FAMILY_INTERESTS === 20
      return {
        ok,
        detail: `maxMembers=${MAX_FAMILY_MEMBERS}, maxInterests=${MAX_FAMILY_INTERESTS}`,
      }
    },
  },
  {
    id: "unreleased-tmdb-statuses",
    label: "La liste des statuts TMDB pré-sortie est exactement les 4 attendus",
    severity: "invariant",
    check: () => {
      const expected = ["Planned", "In Production", "Post Production", "Rumored"]
      return {
        ok: sameSet(UNRELEASED_TMDB_STATUSES, expected),
        detail: `[${UNRELEASED_TMDB_STATUSES.join(", ")}]`,
      }
    },
  },
  {
    id: "safety-dominates-personalized",
    label: "Le poids comportemental ne domine pas les signaux de sécurité (âge + sensibilité)",
    severity: "report",
    check: () => {
      const safety = FIT_WEIGHTS.ageScore + FIT_WEIGHTS.sensitivityScore
      const ok = FIT_WEIGHTS.personalizedScore <= safety
      return {
        ok,
        detail: `personalized=${FIT_WEIGHTS.personalizedScore} vs âge+sensibilité=${safety.toFixed(2)}`,
      }
    },
  },
]

/** Run every registered expectation and return its current status. Pure, no DB. */
export function runExpectationChecks(): ExpectationResult[] {
  return EXPECTATIONS.map((e) => {
    const { ok, detail } = e.check()
    return { id: e.id, label: e.label, severity: e.severity, ok, detail }
  })
}
