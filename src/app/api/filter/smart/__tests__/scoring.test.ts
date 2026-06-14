import { describe, expect, it } from "vitest"
import {
  buildSmartFilterWhere,
  calculateMemberScore,
  type MemberPreferences,
} from "../scoring"

// Derive the birth year from the current year so the member is ALWAYS
// exactly 10, independent of when the suite runs. A hard-coded year +
// month (was 2015/June) made the member silently turn 11 once the real
// calendar passed that birthday, flipping the "one year above age"
// assertions. January birthMonth means the birthday has always already
// happened this year, so getMemberAge() returns a stable `currentYear -
// birthYear` with no month-boundary ambiguity.
const TEST_MEMBER_AGE = 10
const baseMember: MemberPreferences = {
  id: "m1",
  name: "Test",
  birthYear: new Date().getFullYear() - TEST_MEMBER_AGE,
  birthMonth: 1,
  sensitivityViolence: 2,
  sensitivityScary: 2,
  sensitivitySexual: 2,
  sensitivityLanguage: 2,
  sensitivitySubstances: 2,
  preferPositiveMessages: 1,
  preferRoleModels: 1,
  preferEducational: 1,
  favoriteGenres: [],
  dislikedGenres: [],
  avoidTopics: [],
  interests: [],
}

const neutralMedia = {
  expertAgeRec: 10,
  violence: 0,
  sexNudity: 0,
  language: 0,
  substanceUse: 0,
  positiveMessages: 3,
  roleModels: 3,
  genres: ["Animation"],
  topics: [],
  emotionalThemes: [],
}

describe("calculateMemberScore — strictMode age behavior", () => {
  it("does not penalise content one year above member age outside strict mode", () => {
    // Member age 10 (birthYear 2015 in 2026), expertAgeRec 11
    const { score } = calculateMemberScore(
      baseMember,
      { ...neutralMedia, expertAgeRec: 11 },
      false,
    )
    expect(score).toBeGreaterThan(85)
  })

  it("penalises content one year above member age in strict mode", () => {
    const { score, concerns } = calculateMemberScore(
      baseMember,
      { ...neutralMedia, expertAgeRec: 11 },
      true,
    )
    expect(score).toBeLessThanOrEqual(85)
    expect(concerns.some(c => c.includes("Un peu mature"))).toBe(true)
  })

  it("penalises content multiple years above member age regardless of strictMode", () => {
    const out = calculateMemberScore(
      baseMember,
      { ...neutralMedia, expertAgeRec: 13 },
      false,
    )
    expect(out.score).toBeLessThanOrEqual(80)
  })
})

describe("calculateMemberScore — disliked genre", () => {
  it("penalises horror via dislikedGenres", () => {
    const member: MemberPreferences = { ...baseMember, dislikedGenres: ["Horreur"] }
    const { score, concerns } = calculateMemberScore(
      member,
      { ...neutralMedia, genres: ["Horreur"] },
      true,
    )
    // Genre penalty (-15) + scary content (-25 since sensitivityScary=2) → 60 ish
    expect(score).toBeLessThanOrEqual(65)
    expect(concerns.some(c => c.toLowerCase().includes("genre non apprécié"))).toBe(true)
  })

  it("still penalises horror when sensitivityScary is 0 (scary check skipped)", () => {
    const member: MemberPreferences = {
      ...baseMember,
      sensitivityScary: 0,
      dislikedGenres: ["Horreur"],
    }
    const { score } = calculateMemberScore(
      member,
      { ...neutralMedia, genres: ["Horreur"] },
      true,
    )
    // Only -15 from disliked genre; SQL hard-filter in strictMode is what
    // really blocks these items at listing time.
    expect(score).toBe(85)
  })
})

describe("buildSmartFilterWhere", () => {
  const baseInput = {
    mediaType: "MOVIE",
    members: [{ dislikedGenres: [] as string[] }],
    youngestAge: 10,
    strictMode: false,
  }

  it("uses explicit maxAge when provided", () => {
    const where = buildSmartFilterWhere({ ...baseInput, maxAge: 8 })
    expect(where.expertAgeRec).toEqual({ lte: 8 })
  })

  it("falls back to youngestAge + 3 when maxAge is absent", () => {
    const where = buildSmartFilterWhere({ ...baseInput })
    expect(where.expertAgeRec).toEqual({ lte: 13 })
  })

  it("hard-excludes disliked genres in strict mode", () => {
    const where = buildSmartFilterWhere({
      ...baseInput,
      strictMode: true,
      members: [
        { dislikedGenres: ["Horreur", "Thriller"] },
        { dislikedGenres: ["Horreur"] },
      ],
    })
    expect(where.NOT).toBeDefined()
    const notArr = where.NOT as Array<{ genres: { hasSome: string[] } }>
    expect(notArr).toHaveLength(1)
    const blocked = notArr[0].genres.hasSome
    expect(blocked).toContain("Horreur")
    expect(blocked).toContain("Thriller")
  })

  it("does not add a NOT clause outside strict mode", () => {
    const where = buildSmartFilterWhere({
      ...baseInput,
      strictMode: false,
      members: [{ dislikedGenres: ["Horreur"] }],
    })
    expect(where.NOT).toBeUndefined()
  })

  it("applies both lte (from maxAge) and gte (from minAge)", () => {
    const where = buildSmartFilterWhere({ ...baseInput, minAge: 6, maxAge: 12 })
    expect(where.expertAgeRec).toEqual({ lte: 12, gte: 6 })
  })

  it("merges a topics filter with hasSome on both topics and genres", () => {
    const where = buildSmartFilterWhere({ ...baseInput, topics: ["Aventure"] })
    expect(where.AND).toBeDefined()
    const andArr = where.AND as Array<{ OR: Array<Record<string, unknown>> }>
    expect(andArr[0].OR).toEqual([
      { topics: { hasSome: ["Aventure"] } },
      { genres: { hasSome: ["Aventure"] } },
    ])
  })

  it("applies a language filter when provided", () => {
    const where = buildSmartFilterWhere({ ...baseInput, language: "fr,en" })
    expect(where.originalLanguage).toEqual({ in: ["fr", "en"] })
  })

  it("searches BOTH title and originalTitle (so 'Spirited Away' finds 'Le Voyage de Chihiro')", () => {
    const where = buildSmartFilterWhere({ ...baseInput, search: "Spirited Away" })
    const andArr = (where.AND as Array<{ OR?: Array<Record<string, unknown>> }>) || []
    const searchClause = andArr.find((c) =>
      c.OR?.some((o) => "originalTitle" in o)
    )
    expect(searchClause).toBeDefined()
    expect(searchClause!.OR).toEqual([
      { title: { contains: "Spirited Away", mode: "insensitive" } },
      { originalTitle: { contains: "Spirited Away", mode: "insensitive" } },
    ])
  })

  it("ignores a too-short search term (<2 chars)", () => {
    const where = buildSmartFilterWhere({ ...baseInput, search: "a" })
    const andArr = (where.AND as Array<{ OR?: Array<Record<string, unknown>> }>) || []
    const searchClause = andArr.find((c) => c.OR?.some((o) => "originalTitle" in o))
    expect(searchClause).toBeUndefined()
  })
})
