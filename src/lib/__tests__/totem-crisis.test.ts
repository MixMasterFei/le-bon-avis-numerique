import { describe, expect, it } from "vitest"
import { ESCALATION_MODEL } from "@/lib/anthropic"
import { buildCareBlock, detectCrisis, isChildTyping } from "../totem/crisis"
import { pickModel } from "../totem/model-router"
import { EVAL_SCENARIOS } from "../totem/eval/scenarios"

describe("detectCrisis — a person in distress, not a topic", () => {
  it.each([
    ["Ma fille de 13 ans dit qu'elle veut mourir.", "suicide"],
    ["Mon ado a des idées suicidaires depuis la rentrée", "suicide"],
    ["Il dit qu'il n'a plus envie de vivre", "suicide"],
    ["j'ai 11 ans et des fois je me fais du mal exprès", "self_harm"],
    ["Ma fille se scarifie, j'ai vu ses bras", "self_harm"],
    ["Mon fils dit qu'on le frappe.", "abuse"],
    ["mes parents me tapent quand j'ai des mauvaises notes", "abuse"],
    ["Mon fils s'est fait frapper à la récré", "abuse"],
    ["Ma fille de 12 ans se fait harceler sur les réseaux sociaux, je ne sais plus quoi faire.", "harassment"],
    ["Des élèves le harcèlent tous les jours au collège", "harassment"],
    ["Elle est victime de cyberharcèlement", "harassment"],
    ["Quelqu'un fait du chantage à mon fils avec des photos", "harassment"],
  ])("« %s » → %s", (text, kind) => {
    expect(detectCrisis(text)?.kinds).toContain(kind)
  })

  it.each([
    "Un film qui aborde le suicide, pour en parler en classe ?",
    "Une série sur le harcèlement scolaire pour Inès ?",
    "Mon fils fait des cauchemars depuis ce film",
    "Ce film m'a fait du mal tellement il était triste",
    "Il me tape sur les nerfs avec ses jeux vidéo",
    "Hugo le bat à Mario Kart à chaque fois",
    "Spider-Man se fait frapper dans le film ?",
    "Quel film pour ce soir ?",
    "Interstellar, c'est pour quel âge ?",
  ])("« %s » is not a crisis", (text) => {
    expect(detectCrisis(text)).toBeNull()
  })

  it("spots a child typing", () => {
    expect(isChildTyping("j'ai 11 ans et des fois je me fais du mal")).toBe(true)
    expect(isChildTyping("mes parents me frappent")).toBe(true)
    expect(isChildTyping("je suis en 5e et on me harcèle")).toBe(true)
    expect(isChildTyping("Ma fille de 13 ans dit qu'elle veut mourir")).toBe(false)
    expect(isChildTyping("j'ai 42 ans et ma fille se fait harceler")).toBe(false)
  })
})

describe("the care block", () => {
  it("gives the helpline matching the situation and forbids the brush-off and any title", () => {
    const suicide = buildCareBlock({ kinds: ["suicide"], childTyping: false })
    expect(suicide).toContain("3114")
    expect(suicide).toContain("112")
    expect(suicide).toContain("JAMAIS « ce n'est pas mon rayon »")
    expect(suicide).toContain("AUCUN film")
    expect(suicide).toContain("vouvoie")

    expect(buildCareBlock({ kinds: ["abuse"], childTyping: false })).toContain("119")
    const harassment = buildCareBlock({ kinds: ["harassment"], childTyping: false })
    expect(harassment).toContain("3018")
    expect(harassment).toContain("0 800 235 236")
  })

  it("lets Totem say « tu » to a child, and adds the 119 for a child who hurts themself", () => {
    const child = buildCareBlock({ kinds: ["self_harm"], childTyping: true })
    expect(child).toContain("tutoie-le")
    expect(child).toContain("3114")
    expect(child).toContain("119")
  })
})

describe("routing", () => {
  const crisisScenarios = EVAL_SCENARIOS.filter((s) => s.category === "crisis")

  it("sends every crisis scenario of the bench to the stronger model", () => {
    expect(crisisScenarios.length).toBeGreaterThanOrEqual(4)
    for (const s of crisisScenarios) {
      const d = pickModel({ turnCount: 1, lastTurnToolCount: 0, userText: s.turns[0].user })
      expect(d, s.id).toEqual({ model: ESCALATION_MODEL, reason: "crisis" })
    }
  })

  it("leaves topic questions on the default router", () => {
    expect(pickModel({ turnCount: 1, lastTurnToolCount: 0, userText: "Un film sur le harcèlement pour Inès ?" }).reason).not.toBe("crisis")
  })
})
