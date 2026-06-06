import { describe, expect, it } from "vitest"
import {
  estimateProvisionalAge,
  estimateAgeFromTmdbGenreIds,
  estimateProvisionalAgeFromStored,
  certificationToAge,
} from "../import-helpers"
import type { TMDBMovieDetails } from "../tmdb"

// Minimal TMDBMovieDetails factory — only the fields the estimator reads.
function details(over: Partial<TMDBMovieDetails>): TMDBMovieDetails {
  return { genres: [], ...over } as TMDBMovieDetails
}

function frRelease(cert: string): TMDBMovieDetails["release_dates"] {
  return { results: [{ iso_3166_1: "FR", release_dates: [{ certification: cert, release_date: "", type: 3 }] }] }
}

describe("certificationToAge", () => {
  it("maps French CSA certs", () => {
    expect(certificationToAge("TP")).toBe(0)
    expect(certificationToAge("12")).toBe(12)
    expect(certificationToAge(null)).toBeNull()
    expect(certificationToAge("???")).toBeNull()
  })
})

describe("estimateProvisionalAge", () => {
  it("prefers French CSA certification", () => {
    expect(estimateProvisionalAge(details({ release_dates: frRelease("12") }))).toEqual({
      age: 12,
      source: "csa",
      internalRating: "CSA_12",
    })
  })

  it("falls back to a foreign certification (US MPAA)", () => {
    const d = details({
      release_dates: {
        results: [{ iso_3166_1: "US", release_dates: [{ certification: "PG-13", release_date: "", type: 3 }] }],
      },
    })
    const r = estimateProvisionalAge(d)
    expect(r.age).toBe(13)
    expect(r.source).toBe("foreign")
  })

  it("falls back to the genre heuristic when no cert exists", () => {
    expect(estimateProvisionalAge(details({ genres: [{ id: 27, name: "Horror" }] })).age).toBe(16)
    // animation+adventure leans young even with adventure present
    expect(
      estimateProvisionalAge(details({ genres: [{ id: 16, name: "Animation" }, { id: 12, name: "Adventure" }] })).age,
    ).toBe(6)
    expect(estimateProvisionalAge(details({ genres: [{ id: 35, name: "Comédie" }] })).age).toBe(8)
    expect(estimateProvisionalAge(details({ genres: [] })).age).toBe(10) // default floor
  })
})

describe("estimateAgeFromTmdbGenreIds", () => {
  it("maps numeric genre ids with the same heuristic", () => {
    expect(estimateAgeFromTmdbGenreIds([16, 12])).toBe(6) // Animation + Adventure → family lean
    expect(estimateAgeFromTmdbGenreIds([27])).toBe(16) // Horror
    expect(estimateAgeFromTmdbGenreIds([])).toBe(10) // default
    expect(estimateAgeFromTmdbGenreIds([16, 27])).toBe(16) // family + mature → not capped
  })
})

describe("estimateProvisionalAgeFromStored", () => {
  it("uses stored officialRating before genres", () => {
    expect(estimateProvisionalAgeFromStored({ officialRating: "CSA_12", genres: ["Animation"] })).toEqual({
      age: 12,
      source: "csa",
    })
  })

  it("falls back to genres when no rating is stored", () => {
    expect(estimateProvisionalAgeFromStored({ officialRating: null, genres: ["Comédie"] })).toEqual({
      age: 8,
      source: "genre",
    })
  })
})
