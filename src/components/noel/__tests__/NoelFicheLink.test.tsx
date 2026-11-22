import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import { render, screen } from "@testing-library/react"

const membership = vi.hoisted(() => ({ isNoelGiftGame: vi.fn() }))
vi.mock("@/lib/noel/gift-membership", () => membership)

import { NoelFicheLink } from "../NoelFicheLink"

// The fiche card: server-rendered, in season only, and a game fiche asks the
// (cached) gift list — a film fiche never does, and nothing is asked
// outside November–December.

const film = { mediaId: "film-1", type: "MOVIE", title: "Le Grinch", genres: ["Familial"], topics: ["Noël"] }
const game = { mediaId: "game-1", type: "GAME", title: "Super Mario Odyssey", genres: ["Plateforme"], topics: [] }

function at(iso: string) {
  vi.useFakeTimers({ toFake: ["Date"] })
  vi.setSystemTime(new Date(iso))
}

describe("NoelFicheLink", () => {
  beforeEach(() => membership.isNoelGiftGame.mockReset())
  afterEach(() => vi.useRealTimers())

  it("links a Christmas film to the films page in December, without asking the gift list", async () => {
    at("2026-12-10T12:00:00")
    render((await NoelFicheLink(film))!)
    const link = screen.getByRole("link", { name: /Noël en famille : nos sélections par âge/ })
    expect(link).toHaveAttribute("href", "/noel/films-en-famille")
    expect(membership.isNoelGiftGame).not.toHaveBeenCalled()
  })

  it("links a gift-list game to the gift page", async () => {
    at("2026-11-22T12:00:00")
    membership.isNoelGiftGame.mockResolvedValue(true)
    render((await NoelFicheLink(game))!)
    expect(screen.getByRole("link", { name: /Noël en famille/ })).toHaveAttribute("href", "/noel/jeux-video-a-offrir")
    expect(membership.isNoelGiftGame).toHaveBeenCalledWith("game-1")
  })

  it("renders nothing for a game the gift page does not list", async () => {
    at("2026-11-22T12:00:00")
    membership.isNoelGiftGame.mockResolvedValue(false)
    expect(await NoelFicheLink(game)).toBeNull()
  })

  it("renders nothing out of season and makes no lookup", async () => {
    at("2027-01-05T12:00:00")
    expect(await NoelFicheLink(film)).toBeNull()
    expect(await NoelFicheLink(game)).toBeNull()
    expect(membership.isNoelGiftGame).not.toHaveBeenCalled()
  })
})
