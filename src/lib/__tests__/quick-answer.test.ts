import { describe, it, expect } from "vitest"
import { buildQuickAnswer } from "../quick-answer"

const zeroMetrics = {
  violence: 0,
  sexNudity: 0,
  language: 0,
  consumerism: 0,
  substanceUse: 0,
  positiveMessages: 0,
  roleModels: 0,
}

describe("buildQuickAnswer", () => {
  it("phrases the question around the dominant 'à partir de quel âge' intent", () => {
    const qa = buildQuickAnswer({ title: "Kraken", type: "MOVIE", expertAgeRec: 12, contentMetrics: zeroMetrics })
    expect(qa.question).toContain("à partir de quel âge")
    expect(qa.question).toContain("Kraken")
  })

  it("released fiche: states the age and surfaces real content signals", () => {
    const qa = buildQuickAnswer({
      title: "Kraken",
      type: "MOVIE",
      expertAgeRec: 12,
      contentMetrics: { ...zeroMetrics, violence: 4 },
    })
    expect(qa.answer).toContain("à partir de 12 ans")
    expect(qa.answer.toLowerCase()).toContain("violence")
  })

  it("hideContentAnalysis + unreleased: defers to the release date", () => {
    const qa = buildQuickAnswer({
      title: "L'Odyssée",
      type: "MOVIE",
      expertAgeRec: 12,
      contentMetrics: zeroMetrics,
      hideContentAnalysis: true,
      hiddenReason: "unreleased",
    })
    expect(qa.age).toContain("à confirmer")
    expect(qa.answer).toContain("à confirmer")
    expect(qa.answer.toLowerCase()).toContain("après sa sortie")
    // Must NOT imply an evaluation exists.
    expect(qa.answer).not.toContain("Aucun signal sensible")
    expect(qa.answer.toLowerCase()).not.toContain("points à vérifier")
  })

  it("hideContentAnalysis + already released: NEVER defers to the release date", () => {
    // The regression: L'Odyssée was in cinemas from 15/07/2026 while its fiche
    // still promised the analysis "après sa sortie" — on the page carrying the
    // large majority of site traffic.
    const qa = buildQuickAnswer({
      title: "L'Odyssée",
      type: "MOVIE",
      expertAgeRec: 12,
      contentMetrics: zeroMetrics,
      hideContentAnalysis: true,
      hiddenReason: "awaiting-analysis",
    })
    expect(qa.age).toContain("à confirmer")
    expect(qa.answer.toLowerCase()).not.toContain("après sa sortie")
    expect(qa.answer.toLowerCase()).not.toContain("après la sortie")
    // Still makes zero content claims.
    expect(qa.answer).not.toContain("Aucun signal sensible")
    expect(qa.answer.toLowerCase()).not.toContain("points à vérifier")
  })

  it("hideContentAnalysis without a reason: neutral, never asserts a future release", () => {
    const qa = buildQuickAnswer({
      title: "Sans raison",
      type: "MOVIE",
      expertAgeRec: 12,
      contentMetrics: zeroMetrics,
      hideContentAnalysis: true,
    })
    expect(qa.answer.toLowerCase()).not.toContain("après sa sortie")
    expect(qa.answer).not.toContain("Aucun signal sensible")
  })

  it("hideContentAnalysis without an age stays honest", () => {
    const qa = buildQuickAnswer({
      title: "Projet mystère",
      type: "MOVIE",
      expertAgeRec: null,
      contentMetrics: zeroMetrics,
      hideContentAnalysis: true,
    })
    expect(qa.answer).not.toContain("Aucun signal sensible")
    expect(qa.answer).toContain("à confirmer")
  })
})
