import { describe, it, expect } from "vitest"
import { scoreUpcomingForMember, type UpcomingMemberProfile } from "./upcoming-fit"
import { EMPTY_VECTOR } from "@/lib/preference-vector"

const baseMember: UpcomingMemberProfile = {
  favoriteGenres: ["Aventure"],
  dislikedGenres: [],
  interests: [],
  memberVector: EMPTY_VECTOR,
  age: 6,
}

describe("scoreUpcomingForMember — hard age gate (upcoming titles have no metrics)", () => {
  it("excludes a mature title for a young minor even on a strong genre match", () => {
    const result = scoreUpcomingForMember(
      { genres: ["Aventure"], topics: [], expertAgeRec: 16 },
      baseMember, // age 6, loves Aventure
    )
    expect(result.excluded).toBe(true)
    expect(result.fit).toBe(0)
  })

  it("excludes an UNRATED upcoming title for a minor (can't verify safety)", () => {
    const result = scoreUpcomingForMember(
      { genres: ["Aventure"], topics: [], expertAgeRec: null },
      baseMember,
    )
    expect(result.excluded).toBe(true)
  })

  it("includes a title within the member's age + 2 margin", () => {
    const result = scoreUpcomingForMember(
      { genres: ["Aventure"], topics: [], expertAgeRec: 8 }, // 6 + 2
      baseMember,
    )
    expect(result.excluded).toBe(false)
    expect(result.fit).toBeGreaterThan(0)
  })

  it("still hard-excludes a disliked genre regardless of age", () => {
    const member: UpcomingMemberProfile = { ...baseMember, dislikedGenres: ["Horreur"], age: 15 }
    const result = scoreUpcomingForMember(
      { genres: ["Horreur"], topics: [], expertAgeRec: 12 },
      member,
    )
    expect(result.excluded).toBe(true)
  })

  it("does not apply the upper age gate to an adult member (age >= 18)", () => {
    const adult: UpcomingMemberProfile = { ...baseMember, age: 40 }
    const result = scoreUpcomingForMember(
      { genres: ["Aventure"], topics: [], expertAgeRec: 16 },
      adult,
    )
    expect(result.excluded).toBe(false)
  })

  it("skips the per-member upper gate when the age is unknown (family-level gate handles it)", () => {
    const unknownAge: UpcomingMemberProfile = { ...baseMember, age: null }
    const result = scoreUpcomingForMember(
      { genres: ["Aventure"], topics: [], expertAgeRec: 16 },
      unknownAge,
    )
    expect(result.excluded).toBe(false)
  })
})
