import { describe, expect, it } from "vitest"
import {
  computeDataQualityScore,
  computeQuality,
  deriveIsEnriched,
  qualityUpdateFor,
  type QualityScoreInput,
} from "@/lib/quality-score"

const complete: QualityScoreInput = {
  title: "Vice-versa",
  posterUrl: "https://cdn.example/poster.jpg",
  backdropUrl: "https://cdn.example/backdrop.jpg",
  synopsisFr: "Au quartier général, le centre de contrôle situé dans la tête de Riley, cinq émotions s'activent.",
  releaseDate: new Date("2015-06-17"),
  genres: ["Animation", "Familial"],
  officialRating: "TOUS_PUBLICS",
  expertAgeRec: 6,
  director: "Pete Docter",
  originalLanguage: "en",
  hasContentMetrics: true,
  hasScreenshots: true,
  hasStreaming: true,
}

const bare: QualityScoreInput = {
  title: "",
  posterUrl: null,
  backdropUrl: null,
  synopsisFr: null,
  releaseDate: null,
  genres: [],
  officialRating: null,
  expertAgeRec: null,
  director: null,
  originalLanguage: null,
  hasContentMetrics: false,
  hasScreenshots: false,
  hasStreaming: false,
}

describe("computeDataQualityScore", () => {
  it("gives a complete fiche the full 100 points", () => {
    expect(computeDataQualityScore(complete)).toBe(100)
  })

  it("gives an empty fiche 0", () => {
    expect(computeDataQualityScore(bare)).toBe(0)
  })

  it("weights a short synopsis at about half a full one", () => {
    expect(computeDataQualityScore({ ...bare, synopsisFr: "Court." })).toBe(7)
    expect(computeDataQualityScore({ ...bare, synopsisFr: "x".repeat(51) })).toBe(15)
  })

  it("counts « Tous publics » (age 0) as a rating, not a gap", () => {
    expect(computeDataQualityScore({ ...bare, expertAgeRec: 0 })).toBe(10)
  })
})

describe("deriveIsEnriched", () => {
  it("needs both an age and a content analysis", () => {
    expect(deriveIsEnriched({ expertAgeRec: 6, hasContentMetrics: true })).toBe(true)
    expect(deriveIsEnriched({ expertAgeRec: 6, hasContentMetrics: false })).toBe(false)
    expect(deriveIsEnriched({ expertAgeRec: null, hasContentMetrics: true })).toBe(false)
  })
})

describe("qualityUpdateFor — the nightly job writes only what changed", () => {
  it("returns null when the stored row is already right (the common case)", () => {
    const computed = computeQuality(complete)
    expect(qualityUpdateFor({ dataQualityScore: 100, isEnriched: true }, computed)).toBeNull()
  })

  it("returns only the score when only the score moved", () => {
    expect(qualityUpdateFor({ dataQualityScore: 90, isEnriched: true }, computeQuality(complete))).toEqual({ dataQualityScore: 100 })
  })

  it("returns only the flag when only isEnriched moved", () => {
    expect(qualityUpdateFor({ dataQualityScore: 100, isEnriched: false }, computeQuality(complete))).toEqual({ isEnriched: true })
  })

  it("never writes lastVerifiedAt — scoring local data verifies nothing", () => {
    const patch = qualityUpdateFor({ dataQualityScore: 0, isEnriched: false }, computeQuality(complete))
    expect(patch).not.toBeNull()
    expect(Object.keys(patch!).sort()).toEqual(["dataQualityScore", "isEnriched"])
  })
})
