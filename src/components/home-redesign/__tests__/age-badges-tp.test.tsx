import { afterEach, describe, expect, it, vi } from "vitest"
import { render, screen, within } from "@testing-library/react"

// The reaction bar needs a session + family; irrelevant to the age badge.
vi.mock("@/components/media/PosterActionBar", () => ({ PosterActionBar: () => null }))

import { MethodeBand } from "../MethodeBand"
import { CoinFamilleClassicCard } from "../CoinFamilleClassicCard"
import { CoinFamillePickCard } from "../CoinFamillePickCard"

// expertAgeRec 0 is a REAL rating (« Tous publics »), not a gap. These cards
// used to test `> 0`, so a TP title got no badge at all and read as « pas
// encore noté » (@/lib/age-label). Only null may stay badge-less.

const AGE_BADGE = /^(TP|\d+\+)$/

afterEach(() => {
  vi.unstubAllGlobals()
})

describe("MethodeBand — the live totem decoder", () => {
  const pick = (expertAgeRec: number | null) => ({
    id: "pick",
    type: "MOVIE",
    title: "Le film décodé",
    posterUrl: null,
    expertAgeRec,
    genres: [],
    contentMetrics: { violence: 2, sexNudity: 0, language: 1, substanceUse: 0 },
  })
  const serve = (item: ReturnType<typeof pick>) =>
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue({ ok: true, json: async () => ({ items: [item] }) }))

  it("badges a « Tous publics » title « TP », never « 0+ »", async () => {
    serve(pick(0))
    render(<MethodeBand />)
    await screen.findByText("Le film décodé")

    expect(screen.getByText("TP")).toBeInTheDocument()
    expect(screen.queryByText("0+")).toBeNull()
  })

  it("keeps « 12+ » for a rated title and no badge when the age is unknown", async () => {
    serve(pick(12))
    const { unmount } = render(<MethodeBand />)
    await screen.findByText("Le film décodé")
    expect(screen.getByText("12+")).toBeInTheDocument()
    unmount()

    serve(pick(null))
    render(<MethodeBand />)
    await screen.findByText("Le film décodé")
    expect(screen.queryByText(AGE_BADGE)).toBeNull()
  })
})

describe("CoinFamilleClassicCard — « Les classiques à redécouvrir »", () => {
  const classic = (title: string, expertAgeRec: number | null) => (
    <CoinFamilleClassicCard
      media={{ id: title, type: "MOVIE", title, posterUrl: null, expertAgeRec }}
      serifClass="font-serif"
    />
  )

  it("badges 0 « TP », 8 « 8+ », and leaves null without a badge", () => {
    render(
      <>
        {classic("Classique tous publics", 0)}
        {classic("Classique huit ans", 8)}
        {classic("Classique sans âge", null)}
      </>,
    )

    expect(within(screen.getByRole("link", { name: /Classique tous publics/ })).getByText("TP")).toBeInTheDocument()
    expect(within(screen.getByRole("link", { name: /Classique huit ans/ })).getByText("8+")).toBeInTheDocument()
    expect(within(screen.getByRole("link", { name: /Classique sans âge/ })).queryByText(AGE_BADGE)).toBeNull()
  })
})

describe("CoinFamillePickCard — Coin Famille picks", () => {
  const pickCard = (title: string, expertAgeRec: number | null) => (
    <CoinFamillePickCard media={{ id: title, type: "MOVIE", title, posterUrl: null, expertAgeRec }} onSeen={() => {}} />
  )

  it("badges 0 « TP », 10 « 10+ », and leaves null without a badge", () => {
    render(
      <>
        {pickCard("Idée tous publics", 0)}
        {pickCard("Idée dix ans", 10)}
        {pickCard("Idée sans âge", null)}
      </>,
    )
    // The title sits under the poster link, so scope to the whole card.
    const cardOf = (title: string) => within(screen.getByText(title).parentElement!)

    expect(cardOf("Idée tous publics").getByText("TP")).toBeInTheDocument()
    expect(cardOf("Idée dix ans").getByText("10+")).toBeInTheDocument()
    expect(cardOf("Idée sans âge").queryByText(AGE_BADGE)).toBeNull()
  })
})
