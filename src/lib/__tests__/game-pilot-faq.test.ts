import { describe, expect, it } from "vitest"
import { buildAgeRationale, buildPegiComparison } from "@/lib/age-rationale"
import { buildPilotPegiFaq, pegiFaqQuestion } from "@/lib/game-pilot-faq"
import { GAME_PILOT_CONTROL_IDS, GAME_PILOT_TREATED_IDS } from "@/lib/game-pilot"

const TREATED = GAME_PILOT_TREATED_IDS[0]
const CONTROL = GAME_PILOT_CONTROL_IDS[0]
const metrics = { violence: 4, sexNudity: 0, language: 3, consumerism: 1, substanceUse: 0, positiveMessages: 2, roleModels: 2 }

function game(over: Partial<Parameters<typeof buildPilotPegiFaq>[0]> = {}) {
  return {
    id: TREATED,
    title: "Jeu pilote",
    type: "GAME",
    expertAgeRec: 12,
    officialRating: "PEGI_7",
    genres: ["Aventure"],
    topics: [],
    contentMetrics: metrics,
    hideContentAnalysis: false,
    ...over,
  }
}

describe("buildPilotPegiFaq", () => {
  it("adds the PEGI comparison Q/A on a treated pilot game", () => {
    const faq = buildPilotPegiFaq(game())
    expect(faq).not.toBeNull()
    expect(faq!.question).toBe(pegiFaqQuestion("Jeu pilote"))
    expect(faq!.answer).toMatch(/^PEGI 7 ; Totem Avisé conseille dès 12 ans en raison de : /)
  })

  it("answers with exactly the sentence the fiche shows", () => {
    const input = game()
    const drivers = buildAgeRationale(input).drivers
    expect(buildPilotPegiFaq(input)!.answer).toBe(
      buildPegiComparison({ expertAgeRec: 12, officialRating: "PEGI_7", drivers, hideContentAnalysis: false }),
    )
  })

  it("is for treated pilot games only — never controls, other games or other types", () => {
    expect(buildPilotPegiFaq(game({ id: CONTROL }))).toBeNull()
    expect(buildPilotPegiFaq(game({ id: "00000000-0000-0000-0000-000000000000" }))).toBeNull()
    expect(buildPilotPegiFaq(game({ type: "MOVIE" }))).toBeNull()
  })

  it("is hidden when the content analysis is hidden", () => {
    expect(buildPilotPegiFaq(game({ hideContentAnalysis: true }))).toBeNull()
  })

  it("says nothing without a stored PEGI code or a stored age", () => {
    expect(buildPilotPegiFaq(game({ officialRating: null }))).toBeNull()
    expect(buildPilotPegiFaq(game({ officialRating: "ESRB_T" }))).toBeNull()
    expect(buildPilotPegiFaq(game({ expertAgeRec: null }))).toBeNull()
  })

  it("never states an age other than the stored one (besides the PEGI code)", () => {
    for (const [age, pegi] of [
      [0, 3],
      [7, 7],
      [10, 12],
      [14, 12],
      [16, 18],
    ] as const) {
      const faq = buildPilotPegiFaq(game({ expertAgeRec: age, officialRating: `PEGI_${pegi}` }))!
      const text = `${faq.question} ${faq.answer}`
      const numbers = (text.match(/\d+/g) ?? []).map(Number)
      for (const n of numbers) expect([age, pegi]).toContain(n)
      if (age === 0) expect(faq.answer).toMatch(/tous publics/)
      else expect(faq.answer).toContain(`dès ${age} ans`)
    }
  })

  it("names no internal service", () => {
    for (const [age, pegi] of [
      [12, 7],
      [7, 7],
      [7, 12],
    ] as const) {
      const faq = buildPilotPegiFaq(game({ expertAgeRec: age, officialRating: `PEGI_${pegi}` }))!
      expect(JSON.stringify(faq)).not.toMatch(/IGDB|TMDB|Twitch|OpenAI|GPT|Claude|Anthropic|Haiku|Sonnet/i)
    }
  })
})
