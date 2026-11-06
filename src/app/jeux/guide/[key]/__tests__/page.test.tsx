import { afterEach, describe, expect, it, vi } from "vitest"
import { cleanup, render, screen } from "@testing-library/react"
import { GAME_GUIDES } from "@/lib/game-guides"
import type { GuideGameMedia } from "@/lib/game-guide-media"

// Admin viewer: the guides are admin-only while GAME_GUIDES_PUBLIC is off.
vi.mock("@/lib/auth", () => ({ isAdmin: vi.fn(async () => true) }))
const media = vi.hoisted(() => ({ getGuideGameMedia: vi.fn() }))
vi.mock("@/lib/game-guide-media", () => media)
vi.mock("@/components/media-v3/DashboardScreenshots", () => ({ DashboardScreenshots: () => null }))

import GameGuidePage from "../page"

// The guide's live catalogue strip links back to the fiche with its age.
// expertAgeRec 0 is a REAL rating (« Tous publics »), not a gap: a `> 0` test
// used to hide the chip, as if the game had no age (@/lib/age-label).

const game = (expertAgeRec: number | null): GuideGameMedia => ({
  id: "game-1",
  title: "Le jeu du guide",
  posterUrl: null,
  backdropUrl: null,
  expertAgeRec,
  platforms: [],
  screenshots: [],
})

async function renderGuide(expertAgeRec: number | null) {
  media.getGuideGameMedia.mockResolvedValue(game(expertAgeRec))
  render(await GameGuidePage({ params: Promise.resolve({ key: GAME_GUIDES[0].key }) }))
}

afterEach(() => {
  cleanup()
})

describe("/jeux/guide/[key] — age chip back to the fiche", () => {
  it("shows « Tous publics — voir la fiche » for a « Tous publics » game", async () => {
    await renderGuide(0)
    expect(screen.getByRole("link", { name: "Tous publics — voir la fiche" })).toHaveAttribute("href", "/media/game-1")
  })

  it("keeps « Dès 12 ans — voir la fiche », and no chip when the age is unknown", async () => {
    await renderGuide(12)
    expect(screen.getByRole("link", { name: "Dès 12 ans — voir la fiche" })).toBeInTheDocument()
    cleanup()

    await renderGuide(null)
    expect(screen.queryByRole("link", { name: /voir la fiche/ })).toBeNull()
  })
})
