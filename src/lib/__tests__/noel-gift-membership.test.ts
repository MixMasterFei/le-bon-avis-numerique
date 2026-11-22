// @vitest-environment node
import { beforeEach, describe, expect, it, vi } from "vitest"

// unstable_cache is a pass-through here: what is pinned is that membership
// reads the gift page's own fetcher (no copy of its rules) and never throws.
vi.mock("next/cache", () => ({ unstable_cache: <T,>(fn: T) => fn }))
const queries = vi.hoisted(() => ({ fetchGiftGamesByBand: vi.fn() }))
vi.mock("../noel/queries", () => queries)

import { isNoelGiftGame } from "../noel/gift-membership"

const band = (key: string) => ({ key, label: key, min: 0, max: 99 })

beforeEach(() => {
  vi.clearAllMocks()
  vi.spyOn(console, "error").mockImplementation(() => {})
})

describe("isNoelGiftGame", () => {
  it("is true exactly for the games the gift page lists, in any band", async () => {
    queries.fetchGiftGamesByBand.mockResolvedValue([
      { band: band("6-8"), items: [{ id: "mario" }, { id: "zelda" }] },
      { band: band("12-14"), items: [{ id: "fifa" }] },
      { band: band("3-5"), items: [] },
    ])
    expect(await isNoelGiftGame("mario")).toBe(true)
    expect(await isNoelGiftGame("fifa")).toBe(true)
    expect(await isNoelGiftGame("gta-vi")).toBe(false)
  })

  it("answers false when the catalogue cannot be read", async () => {
    queries.fetchGiftGamesByBand.mockRejectedValue(new Error("db down"))
    await expect(isNoelGiftGame("mario")).resolves.toBe(false)
  })
})
