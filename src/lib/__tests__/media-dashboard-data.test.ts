import { beforeEach, describe, expect, it, vi } from "vitest"

vi.mock("@/lib/prisma", () => ({
  prisma: { mediaItem: { findUnique: vi.fn(), findFirst: vi.fn() } },
}))

import { getDashboardMedia } from "@/lib/media-dashboard-data"
import { prisma } from "@/lib/prisma"

const db = vi.mocked(prisma, true)

const row = {
  id: "7bee43dc-3c39-4fe8-87a0-13dabfab4c06",
  title: "Les Ensorceleuses",
  originalTitle: "Practical Magic",
  type: "MOVIE",
  releaseDate: new Date("1998-10-16"),
  releaseStatus: "Released",
  // updatedAt is moved by every bookkeeping write (it read "today" on all
  // 12 265 rows); the fiche must be dated by its last CONTENT change.
  updatedAt: new Date("2026-11-06T04:15:00Z"),
  contentUpdatedAt: new Date("2026-09-04T10:00:00Z"),
  posterUrl: "https://cdn.example/p.jpg",
  synopsisFr: "Deux sœurs sorcières…",
  officialRating: "CSA_12",
  expertAgeRec: 12,
  communityAgeRec: null,
  isEnriched: true,
  duration: 104,
  director: "Griffin Dunne",
  genres: ["Fantastique"],
  platforms: [],
  pegiDescriptors: [],
  topics: [],
  contentMetrics: null,
  screenshots: [],
  reviews: [],
  _count: { reviews: 0 },
}

beforeEach(() => {
  vi.clearAllMocks()
  db.mediaItem.findUnique.mockResolvedValue(row as never)
})

describe("getDashboardMedia — « Fiche mise à jour le »", () => {
  it("exposes the last content change, not the row's updatedAt", async () => {
    const media = await getDashboardMedia(row.id)
    expect(media?.contentUpdatedAt).toBe("2026-09-04T10:00:00.000Z")
    expect(media).not.toHaveProperty("updatedAt")
  })
})

describe("getDashboardMedia — game « Fiche pratique » facts", () => {
  it("maps the facts columns, keeping NULL as unknown", async () => {
    db.mediaItem.findUnique.mockResolvedValue({
      ...row,
      type: "GAME",
      gameOnlinePlay: true,
      gameLocalPlay: null,
      gameSplitScreen: null,
      gameMinPlayers: 1,
      gameMaxPlayers: 4,
      gameInGamePurchases: null,
      gameDeveloper: "Studio",
      gamePublisher: null,
      gameSeries: "Série",
      gameTimeToBeatHours: 9.5,
      gameFactsCheckedAt: new Date("2026-11-20T08:00:00Z"),
    } as never)
    const media = await getDashboardMedia(row.id)
    expect(media?.gameFacts).toEqual({
      gameOnlinePlay: true,
      gameLocalPlay: null,
      gameSplitScreen: null,
      gameMinPlayers: 1,
      gameMaxPlayers: 4,
      gameInGamePurchases: null,
      gameDeveloper: "Studio",
      gamePublisher: null,
      gameSeries: "Série",
      gameTimeToBeatHours: 9.5,
      gameFactsCheckedAt: "2026-11-20T08:00:00.000Z",
    })
  })
})
