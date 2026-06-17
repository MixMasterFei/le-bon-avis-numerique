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
  it("counts favorite genres as configured preferences even without the custom-settings flag", () => {
    // Genres set via the member-edit card (useCustomSettings still false) are
    // now actionable preferences → the 25% quiz-prefs criterion counts.
    const completion = getCompletionPercent(
      { ...baseMember, favoriteGenres: ["Animation"] },
      0,
    )

    // 10 (birth year) + 5 (avatar) + 25 (configured prefs) = 40
    expect(completion).toBe(40)
  })

  it("counts configured quiz preferences when custom settings are enabled", () => {
    const completion = getCompletionPercent(
      { ...baseMember, useCustomSettings: true, favoriteGenres: ["Animation"] },
      0,
    )

    expect(completion).toBe(40)
  })
})

