import { describe, expect, it } from "vitest"
import { buildPlan, fallbackPlan, splitTitleForEm } from "../blocks"
import { validateNlIntent } from "../validate"
import type { NlIntent } from "../types"

/** A normal "filtre" intent: films, age 8, one theme. */
function intentOf(overrides: Partial<NlIntent> = {}): NlIntent {
  return { ...validateNlIntent({ mediaType: "MOVIE", maxAge: 8, themes: ["Animaux"] }), ...overrides }
}

const block = (block: string, extra: Record<string, unknown> = {}) => ({ block, ...extra })

describe("buildPlan — whitelisting", () => {
  it("drops block keys that are not in the registry", () => {
    const plan = buildPlan([block("mediaGrid"), block("dropTables"), block("<script>")], intentOf())
    expect(plan.map((b) => b.block)).toEqual(["mediaGrid"])
  })

  it("canonicalizes rail themes and drops invented ones", () => {
    const plan = buildPlan(
      [block("mediaGrid"), block("mediaRail", { themes: ["animaux", "Licornes de l'espace"] })],
      intentOf(),
    )
    const rail = plan.find((b) => b.block === "mediaRail")
    expect(rail?.themes).toEqual(["Animaux"])
  })

  it("sanitizes and length-caps the display copy", () => {
    const plan = buildPlan(
      [block("mediaGrid", { title: "x".repeat(400), eyebrow: "y".repeat(200) })],
      intentOf(),
    )
    expect(plan[0].title!.length).toBeLessThanOrEqual(70)
    expect(plan[0].eyebrow!.length).toBeLessThanOrEqual(28)
  })
})

describe("buildPlan — structural rules", () => {
  it("caps the board at 7 blocks", () => {
    const proposal = Array.from({ length: 20 }, () => block("mediaRail"))
    expect(buildPlan([block("mediaGrid"), ...proposal], intentOf()).length).toBeLessThanOrEqual(7)
  })

  it("allows mediaRail twice but every other content block once", () => {
    const plan = buildPlan(
      [block("mediaGrid"), block("mediaRail"), block("mediaRail"), block("mediaRail"), block("cinemaNow"), block("cinemaNow")],
      intentOf(),
    )
    expect(plan.filter((b) => b.block === "mediaRail")).toHaveLength(2)
    expect(plan.filter((b) => b.block === "cinemaNow")).toHaveLength(1)
  })

  it("drops a hero proposed below the top of the board", () => {
    const plan = buildPlan(
      [block("mediaGrid"), block("cinemaNow"), block("heroMatch")],
      intentOf(),
    )
    expect(plan.some((b) => b.block === "heroMatch")).toBe(false)
  })

  it("keeps a hero proposed first", () => {
    const plan = buildPlan([block("heroMatch"), block("mediaGrid")], intentOf())
    expect(plan[0].block).toBe("heroMatch")
  })

  it("never opens the board with an editorial block", () => {
    const plan = buildPlan(
      [block("displayTitle", { title: "Un grand titre" }), block("mediaGrid")],
      intentOf(),
    )
    expect(plan[0].block).toBe("mediaGrid")
  })

  it("never places two editorial blocks back to back", () => {
    const plan = buildPlan(
      [
        block("mediaGrid"),
        block("displayTitle", { title: "Premier titre" }),
        block("interstitial", { title: "Deuxième titre" }),
        block("cinemaNow"),
      ],
      intentOf(),
    )
    const editorials = plan.filter((b) => b.block === "displayTitle" || b.block === "interstitial")
    expect(editorials).toHaveLength(1)
  })

  it("drops an editorial block with no words in it", () => {
    const plan = buildPlan([block("mediaGrid"), block("displayTitle")], intentOf())
    expect(plan.some((b) => b.block === "displayTitle")).toBe(false)
  })

  it("puts the results back when the proposal forgot them", () => {
    const plan = buildPlan([block("heroMatch"), block("cinemaNow")], intentOf())
    expect(plan.map((b) => b.block)).toEqual(["heroMatch", "mediaGrid", "cinemaNow"])
  })
})

describe("buildPlan — blocks that could only render empty", () => {
  it("forces crossType to a different medium than the one asked for", () => {
    const plan = buildPlan(
      [block("mediaGrid"), block("crossType", { mediaType: "MOVIE" })],
      intentOf({ mediaType: "MOVIE" }),
    )
    expect(plan.find((b) => b.block === "crossType")?.mediaType).toBe("GAME")
  })

  it("pivots a games search towards films", () => {
    const gameIntent = validateNlIntent({ mediaType: "GAME", maxAge: 10 })
    const plan = buildPlan([block("mediaGrid"), block("crossType")], gameIntent)
    expect(plan.find((b) => b.block === "crossType")?.mediaType).toBe("MOVIE")
  })

  it("drops a series rail hanging off a games search", () => {
    const gameIntent = validateNlIntent({ mediaType: "GAME", maxAge: 10 })
    const plan = buildPlan([block("mediaGrid"), block("mediaRail", { mediaType: "TV" })], gameIntent)
    expect(plan.some((b) => b.block === "mediaRail")).toBe(false)
  })

  it("drops the younger-siblings rail when no age was given", () => {
    const noAge = validateNlIntent({ mediaType: "MOVIE", themes: ["Animaux"] })
    const plan = buildPlan([block("mediaGrid"), block("youngerSiblings")], noAge)
    expect(plan.some((b) => b.block === "youngerSiblings")).toBe(false)
  })
})

describe("buildPlan — degradation", () => {
  it.each([null, undefined, "nope", 42, {}, [{}], [null]])("falls back on %p", (raw) => {
    const plan = buildPlan(raw, intentOf())
    expect(plan.length).toBeGreaterThan(0)
    expect(plan.some((b) => b.block === "mediaGrid")).toBe(true)
  })

  it("composes nothing at all for an off-topic question", () => {
    const offTopic = validateNlIntent({ horsSujet: true })
    expect(buildPlan([block("mediaGrid")], offTopic)).toEqual([])
    expect(fallbackPlan(offTopic)).toEqual([])
  })

  it("mirrors the interpretation's own complement in the fallback", () => {
    const withRail = validateNlIntent({ mediaType: "MOVIE", maxAge: 8, railSecondaire: "plus_jeunes" })
    expect(fallbackPlan(withRail).map((b) => b.block)).toContain("youngerSiblings")
  })
})

describe("buildPlan — layout variants", () => {
  it("keeps a whitelisted variant", () => {
    const plan = buildPlan([block("mediaGrid", { variant: "wide" })], intentOf())
    expect(plan[0].variant).toBe("wide")
  })

  it("falls back to the plain grid for an invented one", () => {
    const plan = buildPlan([block("mediaGrid", { variant: "parallax3d" })], intentOf())
    expect(plan[0].variant).toBe("grid")
  })

  it("never lets two dark bands touch", () => {
    const plan = buildPlan(
      [
        block("mediaGrid", { variant: "dark" }),
        block("cinemaNow", { variant: "dark" }),
        block("crossType", { variant: "dark" }),
      ],
      intentOf(),
    )
    for (let i = 1; i < plan.length; i++) {
      expect(plan[i].variant === "dark" && plan[i - 1].variant === "dark").toBe(false)
    }
  })

  it("ignores a variant on the hero and on editorial blocks", () => {
    const plan = buildPlan(
      [
        block("heroMatch", { variant: "dark" }),
        block("mediaGrid"),
        // Followed by a real section: a trailing editorial block is dropped as
        // a heading that introduces nothing, which is tested separately.
        block("displayTitle", { title: "Un grand titre", variant: "mosaic" }),
        block("cinemaNow"),
      ],
      intentOf(),
    )
    expect(plan.find((b) => b.block === "heroMatch")?.variant).toBe("grid")
    expect(plan.find((b) => b.block === "displayTitle")?.variant).toBe("grid")
  })
})

describe("splitTitleForEm", () => {
  it("locates the accent words inside the title", () => {
    expect(splitTitleForEm("Pour ce soir en famille", "ce soir")).toEqual({
      before: "Pour ",
      accent: "ce soir",
      after: " en famille",
    })
  })

  it("matches case-insensitively but keeps the title's own casing", () => {
    expect(splitTitleForEm("Pour Ce Soir en famille", "ce soir")?.accent).toBe("Ce Soir")
  })

  it("returns null rather than rewriting a title the accent is absent from", () => {
    expect(splitTitleForEm("Pour ce soir en famille", "demain")).toBeNull()
    expect(splitTitleForEm("Pour ce soir en famille", null)).toBeNull()
  })
})
