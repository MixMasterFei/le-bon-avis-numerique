import { buildAgeRationale, buildPegiComparison, type AgeRationaleInput } from "@/lib/age-rationale"
import { isGamePilot } from "@/lib/game-pilot"

/**
 * Game « augmentation » pilot (src/lib/game-pilot.ts) — the extra FAQPage
 * Q/A that carries the PEGI comparison sentence (Xavier, 21 Nov 2026).
 *
 * TREATED pilot games only: control fiches and every other game keep the
 * same FAQ as before, so the two groups stay comparable in Search Console.
 *
 * Same rules as the on-page sentence (MediaDashboard → buildPegiComparison):
 *   - the answer IS buildPegiComparison, fed with the same rationale drivers,
 *     so it cannot say something the page doesn't;
 *   - nothing when the content analysis is hidden (pre-release / provisional)
 *     or when there is no stored PEGI code or age;
 *   - it only restates the stored age, never computes one;
 *   - it names no internal service.
 *
 * The caller must also only emit it when the V3 body (the only body showing
 * the sentence) is rendered — FAQ markup must match visible content.
 */

export interface PilotPegiFaq {
  question: string
  answer: string
}

export function pegiFaqQuestion(title: string): string {
  return `${title} : comment l'âge conseillé par Totem Avisé se situe-t-il par rapport à la classification PEGI ?`
}

export function buildPilotPegiFaq(input: AgeRationaleInput & { id: string }): PilotPegiFaq | null {
  if (input.type !== "GAME" || !isGamePilot(input.id)) return null
  if (input.hideContentAnalysis) return null
  const rationale = buildAgeRationale(input)
  if (!rationale.show || rationale.isProvisional) return null
  const answer = buildPegiComparison({
    expertAgeRec: input.expertAgeRec,
    officialRating: input.officialRating,
    drivers: rationale.drivers,
    hideContentAnalysis: input.hideContentAnalysis,
  })
  if (!answer) return null
  return { question: pegiFaqQuestion(input.title), answer }
}
