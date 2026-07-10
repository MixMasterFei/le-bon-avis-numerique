import { describe, expect, it } from "vitest"
import { totemVoiceLine } from "../totem-voice"

describe("totemVoiceLine", () => {
  it("is deterministic for the same day + title", () => {
    const a = totemVoiceLine({ title: "Vice-versa", genres: ["animation"], daySeed: 20260711 })
    const b = totemVoiceLine({ title: "Vice-versa", genres: ["animation"], daySeed: 20260711 })
    expect(a).toBe(b)
  })

  it("varies across days", () => {
    const days = new Set(
      [20260711, 20260712, 20260713, 20260714].map((daySeed) =>
        totemVoiceLine({ title: "Vice-versa", genres: ["animation"], daySeed }),
      ),
    )
    expect(days.size).toBeGreaterThan(1)
  })

  it("names the member and includes the genre", () => {
    const line = totemVoiceLine({
      memberName: "Erwan",
      title: "Ori and the Blind Forest",
      genres: ["Aventure"],
      daySeed: 20260711,
    })
    expect(line).toContain("Erwan")
    expect(line.toLowerCase()).toContain("aventure")
    expect(line).not.toContain("{")
  })

  it("never leaks placeholders, whatever the input shape", () => {
    for (const daySeed of [1, 2, 3, 4, 5, 6]) {
      for (const genres of [[], ["Animation"], ["Animation", "Famille"]]) {
        for (const memberName of [undefined, "Léo"]) {
          const line = totemVoiceLine({ memberName, title: "X", genres, daySeed })
          expect(line).not.toContain("{")
          expect(line.length).toBeGreaterThan(20)
        }
      }
    }
  })
})
