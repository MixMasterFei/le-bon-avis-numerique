import { describe, expect, it } from "vitest"
import { needsCareBanner } from "../care"

/**
 * The duty-of-care trigger on the one text field a child can reach without an
 * account. Both directions matter: missing a distress signal fails the child,
 * and over-triggering turns legitimate parental searches into an alarm.
 */
describe("needsCareBanner", () => {
  it.each([
    "film qui aborde le suicide chez les ados",
    "je veux mourir",
    "j'ai envie de mourir",
    "plus envie de vivre",
    "automutilation adolescent",
    "scarification",
    "me faire du mal",
  ])("triggers on %p", (query) => {
    expect(needsCareBanner(query)).toBe(true)
  })

  it.each([
    "un film pas trop effrayant pour ma fille de 8 ans",
    "mon fils fait des cauchemars, un film doux",
    "un film sur le harcèlement à l'école pour en parler",
    "film sur le deuil d'un parent",
    "j'adore les animaux",
    "",
  ])("stays quiet on %p — a legitimate family search", (query) => {
    expect(needsCareBanner(query)).toBe(false)
  })
})
