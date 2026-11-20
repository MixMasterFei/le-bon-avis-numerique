import { describe, expect, it } from "vitest"
import {
  buildPracticalSheet,
  formatPlayers,
  formatTimeToBeat,
  NOT_KNOWN,
  type PracticalSheetInput,
} from "@/lib/game-practical-sheet"

const EMPTY: PracticalSheetInput = {
  gameOnlinePlay: null,
  gameLocalPlay: null,
  gameSplitScreen: null,
  gameMinPlayers: null,
  gameMaxPlayers: null,
  gameInGamePurchases: null,
  gameDeveloper: null,
  gamePublisher: null,
  gameSeries: null,
  gameTimeToBeatHours: null,
  gameFactsCheckedAt: "2026-11-20T10:00:00.000Z",
  pegiDescriptors: [],
}

const value = (input: PracticalSheetInput, key: string) => buildPracticalSheet(input).rows.find((r) => r.key === key)

describe("buildPracticalSheet", () => {
  it("is hidden until the facts have been read once", () => {
    expect(buildPracticalSheet({ ...EMPTY, gameFactsCheckedAt: null }).show).toBe(false)
    expect(buildPracticalSheet(EMPTY).show).toBe(true)
  })

  it("reads « Non renseigné » for every unknown fact — never « non »", () => {
    const sheet = buildPracticalSheet(EMPTY)
    expect(sheet.rows).toHaveLength(9)
    for (const row of sheet.rows) {
      expect(row.value).toBe(NOT_KNOWN)
      expect(row.known).toBe(false)
    }
    expect(JSON.stringify(sheet)).not.toMatch(/\bNon\b(?! renseigné)/)
  })

  it("never turns a stored FALSE into « non » either", () => {
    const sheet = buildPracticalSheet({ ...EMPTY, gameOnlinePlay: false, gameInGamePurchases: false, gameSplitScreen: false })
    expect(sheet.rows.filter((r) => r.known)).toHaveLength(0)
  })

  it("shows stated facts", () => {
    const input: PracticalSheetInput = {
      ...EMPTY,
      gameOnlinePlay: true,
      gameLocalPlay: true,
      gameSplitScreen: true,
      gameMinPlayers: 1,
      gameMaxPlayers: 4,
      gameInGamePurchases: true,
      gameDeveloper: " Nintendo EPD ",
      gamePublisher: "Nintendo",
      gameSeries: "Mario Kart",
      gameTimeToBeatHours: 12.5,
    }
    expect(value(input, "players")?.value).toBe("1 à 4 joueurs")
    expect(value(input, "online")?.value).toBe("Oui")
    expect(value(input, "local")?.value).toBe("Oui")
    expect(value(input, "splitScreen")?.value).toBe("Oui")
    expect(value(input, "purchases")?.value).toBe("Oui · signalé par la classification d'âge")
    expect(value(input, "developer")?.value).toBe("Nintendo EPD")
    expect(value(input, "publisher")?.value).toBe("Nintendo")
    expect(value(input, "series")?.value).toBe("Mario Kart")
    expect(value(input, "timeToBeat")?.value).toBe("Environ 12 h 30")
  })

  it("takes the official PEGI descriptors as sourced « oui »", () => {
    const input = { ...EMPTY, pegiDescriptors: ["Violence", "Achats intégrés", "Jeu en ligne"] }
    expect(value(input, "purchases")?.known).toBe(true)
    expect(value(input, "online")?.value).toBe("Oui")
  })

  it("carries the version / platform caveat and names no source database", () => {
    const sheet = buildPracticalSheet(EMPTY)
    expect(sheet.caveat).toMatch(/varier selon la version et la plateforme/)
    expect(JSON.stringify(sheet)).not.toMatch(/IGDB|TMDB|Twitch/i)
  })
})

describe("formatPlayers", () => {
  it("formats ranges, singles and one-sided bounds", () => {
    expect(formatPlayers(1, 1)).toBe("1 joueur")
    expect(formatPlayers(2, 2)).toBe("2 joueurs")
    expect(formatPlayers(1, 8)).toBe("1 à 8 joueurs")
    expect(formatPlayers(null, 4)).toBe("Jusqu'à 4 joueurs")
    expect(formatPlayers(2, null)).toBe("2 joueurs ou plus")
    expect(formatPlayers(1, null)).toBe("1 joueur ou plus")
  })

  it("rejects implausible values instead of printing them", () => {
    expect(formatPlayers(null, null)).toBeNull()
    expect(formatPlayers(0, 0)).toBeNull()
    expect(formatPlayers(-1, 2.5)).toBeNull()
    expect(formatPlayers(4, 2)).toBe("4 joueurs ou plus")
  })
})

describe("formatTimeToBeat", () => {
  it("rounds to the half hour", () => {
    expect(formatTimeToBeat(12)).toBe("Environ 12 h")
    expect(formatTimeToBeat(7.4)).toBe("Environ 7 h 30")
    expect(formatTimeToBeat(7.8)).toBe("Environ 8 h")
    expect(formatTimeToBeat(0.6)).toBe("Moins d'une heure")
  })

  it("returns null for missing or implausible durations", () => {
    expect(formatTimeToBeat(null)).toBeNull()
    expect(formatTimeToBeat(0)).toBeNull()
    expect(formatTimeToBeat(5000)).toBeNull()
    expect(formatTimeToBeat(Number.NaN)).toBeNull()
  })
})
