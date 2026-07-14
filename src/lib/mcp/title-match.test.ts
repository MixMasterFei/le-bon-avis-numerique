import { describe, it, expect } from "vitest"
import { pickBestTitleMatch, normalizeTitle } from "./title-match"

const row = (title: string, date: string | null) => ({
  title,
  releaseDate: date ? new Date(date) : null,
})

describe("normalizeTitle", () => {
  it("ignores accents, case and punctuation", () => {
    expect(normalizeTitle("L'Odyssée")).toBe(normalizeTitle("l odyssee"))
    expect(normalizeTitle("2001 : L'Odyssée de l'espace")).not.toBe(normalizeTitle("L'Odyssée"))
  })
})

describe("pickBestTitleMatch", () => {
  // The real-world case that motivated this: quality ordering returned the
  // 2016 Cousteau biopic for "L'Odyssée" while parents in 2026 mean the
  // Nolan release (provisional fiche, lower quality score).
  it("prefers the most recent release among exact title matches", () => {
    const rows = [
      row("2001 : L'Odyssée de l'espace", "1968-04-02"),
      row("L'Odyssée", "2016-10-12"),
      row("L'Odyssée", "2026-07-15"),
    ]
    expect(pickBestTitleMatch(rows, "L'Odyssée")).toBe(rows[2])
    expect(pickBestTitleMatch(rows, "l odyssee")).toBe(rows[2])
  })

  it("keeps quality order when no exact match", () => {
    const rows = [
      row("Le Monde de Narnia : L'Odyssée du passeur d'aurore", "2010-12-10"),
      row("Narnia 2", "2008-05-16"),
    ]
    expect(pickBestTitleMatch(rows, "Narnia")).toBe(rows[0])
  })

  it("handles empty input and null dates", () => {
    expect(pickBestTitleMatch([], "x")).toBeUndefined()
    const rows = [row("Titre", null), row("Titre", "2020-01-01")]
    expect(pickBestTitleMatch(rows, "Titre")).toBe(rows[1])
  })
})
