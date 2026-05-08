import { describe, expect, it } from "vitest"
import { getCompletionPercent } from "../profile-completion"

const baseMember = {
  birthYear: 2014,
  avatarEmoji: "🙂",
  avatarStyle: null,
  useCustomSettings: false,
  favoriteGenres: [],
  sensitivityViolence: 2,
  sensitivityScary: 2,
  sensitivitySexual: 3,
  sensitivityLanguage: 2,
  sensitivitySubstances: 2,
  avoidTopics: [],
  interests: [],
}

describe("profile completion", () => {
  it("does not count favorite genres as quiz preferences without custom settings", () => {
    const completion = getCompletionPercent(
      { ...baseMember, favoriteGenres: ["Animation"] },
      0,
    )

    expect(completion).toBe(15)
  })

  it("counts configured quiz preferences when custom settings are enabled", () => {
    const completion = getCompletionPercent(
      { ...baseMember, useCustomSettings: true, favoriteGenres: ["Animation"] },
      0,
    )

    expect(completion).toBe(40)
  })
})

