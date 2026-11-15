import { describe, expect, it } from "vitest"
import { buildFicheDescription, buildFicheTitle, MAX_DESCRIPTION, MAX_TITLE } from "../fiche-title"

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
  })

  // 0 = « Tous publics », a real verdict — it used to be dropped as if unknown.
  it("puts « Tous publics » in the title for a TP fiche", () => {
    expect(buildFicheTitle({ title: "Roblox", age: 0 })).toBe("Roblox — À partir de quel âge ? Tous publics")
    expect(buildFicheTitle({ title: "Roblox", age: 0, provisional: true })).toBe("Roblox — Tous publics (à confirmer)")
  })
})

describe("buildFicheDescription", () => {
  const base = { typeLabel: "Film", age: 8 }

  it("never says the age twice when the synopsis opens on it", () => {
    const d = buildFicheDescription({
      ...base,
      releaseDate: "2022-11-18",
      synopsis: "Dès 8 ans, adaptation musicale du conte de Dickens où l'avare Ebenezer Scrooge est visité la veille de Noël.",
    })
    expect(d).toBe(
      "Film de 2022 · Notre avis famille · Dès 8 ans, adaptation musicale du conte de Dickens où l'avare Ebenezer Scrooge est visité la veille de Noël.",
    )
    expect(d.match(/8 ans/g)).toHaveLength(1)
  })

  it("recognises the agent's other openings", () => {
    for (const synopsis of ["Conseillé dès 14 ans : une comédie.", "À partir de 10 ans, une quête.", "Tous publics, un conte."]) {
      expect(buildFicheDescription({ ...base, synopsis }).startsWith("Notre avis famille · ")).toBe(true)
    }
  })

  it("keeps the verdict lead, with the year, when the synopsis does not carry the age", () => {
    expect(buildFicheDescription({ ...base, releaseDate: "2001-12-19", synopsis: "Frodon hérite d'un anneau." })).toBe(
      "Dès 8 ans · Notre avis famille · Film de 2001 — Frodon hérite d'un anneau.",
    )
  })

  it("a provisional fiche keeps its « à confirmer » lead even when the synopsis opens on an age", () => {
    const d = buildFicheDescription({ ...base, provisional: true, synopsis: "Dès 8 ans, un conte." })
    expect(d.startsWith("Âge conseillé dès 8 ans (à confirmer) — ")).toBe(true)
  })

  it("stays within the length Google shows", () => {
    const d = buildFicheDescription({ ...base, releaseDate: "2001-01-01", synopsis: "x".repeat(400) })
    expect(d.length).toBeLessThanOrEqual(MAX_DESCRIPTION)
    expect(d.endsWith("…")).toBe(true)
  })

  it("falls back without a synopsis or an age", () => {
    expect(buildFicheDescription({ ...base, synopsis: null })).toBe(
      "Dès 8 ans · Notre avis famille. Film analysé par Totem Avisé pour les familles.",
    )
    expect(buildFicheDescription({ typeLabel: "Série", age: null, synopsis: "Une saga." })).toBe("Une saga.")
  })
})
