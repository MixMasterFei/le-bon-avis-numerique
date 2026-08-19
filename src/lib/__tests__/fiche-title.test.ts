import { describe, expect, it } from "vitest"
import { buildFicheTitle, MAX_TITLE } from "../fiche-title"

describe("buildFicheTitle", () => {
  it("puts the query wording in the title for short names", () => {
    // "roblox quel âge" is the query; the old default was "Roblox — Dès 12 ans",
    // which contains no "âge" token at all.
    expect(buildFicheTitle({ title: "Roblox", age: 12 })).toBe(
      "Roblox — À partir de quel âge ? Dès 12 ans",
    )
    expect(buildFicheTitle({ title: "Fortnite", age: 12 })).toContain("quel âge")
    expect(buildFicheTitle({ title: "Minecraft", age: 7 })).toContain("quel âge")
  })

  it("degrades gracefully as the name gets longer, never truncating mid-phrase", () => {
    const long = buildFicheTitle({ title: "Call of Duty: Black Ops 6", age: 18 })
    expect(long.startsWith("Call of Duty: Black Ops 6")).toBe(true)
    expect(long).toContain("Dès 18 ans")

    const veryLong = buildFicheTitle({
      title: "Le Monde de Narnia : L'Odyssée du passeur d'aurore",
      age: 8,
    })
    expect(veryLong).toBe("Le Monde de Narnia : L'Odyssée du passeur d'aurore — Dès 8 ans")
  })

  it("keeps every variant within budget when the name allows it", () => {
    for (const name of ["Roblox", "Fortnite", "Minecraft", "Valorant", "Among Us"]) {
      expect(buildFicheTitle({ title: name, age: 12 }).length).toBeLessThanOrEqual(MAX_TITLE)
    }
  })

  it("never renames the work", () => {
    for (const name of ["Roblox", "Spider-Man: Brand New Day", "L'Odyssée"]) {
      expect(buildFicheTitle({ title: name, age: 12 }).startsWith(name)).toBe(true)
    }
  })

  it("marks a provisional age as unconfirmed", () => {
    const t = buildFicheTitle({ title: "Avatar 4", age: 12, provisional: true })
    expect(t).toContain("à confirmer")
  })

  it("falls back to the bare name with no age", () => {
    expect(buildFicheTitle({ title: "Roblox", age: null })).toBe("Roblox")
    expect(buildFicheTitle({ title: "Roblox", age: 0 })).toBe("Roblox")
  })
})
