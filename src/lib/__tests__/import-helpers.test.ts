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

describe("false \"Tous publics\" floor", () => {
  it("prefers the genre heuristic for a TP thriller", () => {
    // "La fin d'Oak Street": CNC "Tous publics", genres Science-Fiction /
    // Mystère / Thriller. Stored at expertAgeRec 0 it sat below every age
    // filter on the site AND rendered with no badge on the family rail.
    const d = details({
      release_dates: frRelease("TP"),
      genres: [
        { id: 878, name: "Science Fiction" },
        { id: 9648, name: "Mystery" },
        { id: 53, name: "Thriller" },
      ],
    })
    const r = estimateProvisionalAge(d)
    expect(r.age).toBe(13)
    expect(r.source).toBe("genre")
    // The internal CSA code is still recorded — only the recommendation moves.
    expect(r.internalRating).toBe("TOUS_PUBLICS")
  })

  it("leaves a genuine all-ages title at 0", () => {
    const d = details({
      release_dates: frRelease("TP"),
      genres: [{ id: 16, name: "Animation" }, { id: 10751, name: "Family" }],
    })
    expect(estimateProvisionalAge(d)).toEqual({ age: 0, source: "csa", internalRating: "TOUS_PUBLICS" })
  })

  it("never touches a non-zero CSA rating", () => {
    const d = details({
      release_dates: frRelease("12"),
      genres: [{ id: 27, name: "Horror" }],
    })
    // 12 is a real signal; the floor only ever fires on the age-0 bucket.
    expect(estimateProvisionalAge(d).age).toBe(12)
    expect(estimateProvisionalAge(d).source).toBe("csa")
  })

  it("floors a TP drama the mature-genre list used to miss", () => {
    // « Seppuku : l'honneur d'un samouraï » (Drame / Histoire) was live at
    // "Dès 0 ans" — a film about ritual suicide. Neither genre is on the old
    // mature list, so the guard never fired, even though the genre heuristic
    // puts the title at 12. A lenient certification must never end up more
    // permissive than no certification at all.
    const d = details({
      release_dates: frRelease("TP"),
      genres: [{ id: 18, name: "Drama" }, { id: 36, name: "History" }],
    })
    const r = estimateProvisionalAge(d)
    expect(r.age).toBe(12)
    expect(r.source).toBe("genre")
    expect(r.internalRating).toBe("TOUS_PUBLICS")
  })

  it("floors a TP science-fiction drama", () => {
    // « Klara et le Soleil » — same shape, also shipped at 0.
    const d = details({
      release_dates: frRelease("TP"),
      genres: [
        { id: 878, name: "Science Fiction" },
        { id: 18, name: "Drama" },
        { id: 35, name: "Comedy" },
      ],
    })
    expect(estimateProvisionalAge(d).age).toBe(12)
  })

  it("keeps the 2-4 band intact: a TP animated adventure stays at 0", () => {
    // « L'Île des Souvenirs » — Aventure/Animation/Comédie/Familial/Fantastique.
    // The family discount in ageFromGenreNames puts it at 6, under the ceiling,
    // so the TP stays. This band is the one we are actively trying to grow;
    // flooring it would be a regression, not a fix.
    const d = details({
      release_dates: frRelease("TP"),
      genres: [
        { id: 12, name: "Adventure" },
        { id: 16, name: "Animation" },
        { id: 35, name: "Comedy" },
        { id: 10751, name: "Family" },
        { id: 14, name: "Fantasy" },
      ],
    })
    expect(estimateProvisionalAge(d)).toEqual({ age: 0, source: "csa", internalRating: "TOUS_PUBLICS" })
  })

  it("does not let a TP title with no genre data sit at 0", () => {
    // No genres means no information, and no information is not the same as
    // "safe from birth". Matches the uncertified path, which already floors at 10.
    const d = details({ release_dates: frRelease("TP"), genres: [] })
    expect(estimateProvisionalAge(d).age).toBe(10)
  })

  it("applies the same floor to the stored-data backfill", () => {
    expect(
      estimateProvisionalAgeFromStored({ officialRating: "TOUS_PUBLICS", genres: ["Science-Fiction", "Mystère", "Thriller"] }),
    ).toEqual({ age: 13, source: "genre" })
    expect(
      estimateProvisionalAgeFromStored({ officialRating: "TOUS_PUBLICS", genres: ["Animation", "Familial"] }),
    ).toEqual({ age: 0, source: "csa" })
    // Les deux fiches qui étaient publiées à « Dès 0 ans » en septembre 2026.
    expect(
      estimateProvisionalAgeFromStored({ officialRating: "TOUS_PUBLICS", genres: ["Drame", "Histoire"] }),
    ).toEqual({ age: 12, source: "genre" })
    expect(
      estimateProvisionalAgeFromStored({ officialRating: "TOUS_PUBLICS", genres: ["Science-Fiction", "Drame", "Comédie"] }),
    ).toEqual({ age: 12, source: "genre" })
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
