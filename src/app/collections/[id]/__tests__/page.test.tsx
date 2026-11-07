import { describe, expect, it, vi } from "vitest"
import { render, screen, within } from "@testing-library/react"
import type { CollectionItem } from "@/lib/collections"
import { COLLECTIONS } from "@/lib/collections-data"

const data = vi.hoisted(() => ({ getCollectionWithItems: vi.fn() }))
vi.mock("@/lib/collections", () => data)

import CollectionPage from "../page"

// A collection's age chip. expertAgeRec 0 is a REAL rating (« Tous publics »),
// not a gap: it reads « Tous publics », never « Dès 0 ans » (@/lib/age-label).

const item = (id: string, title: string, expertAgeRec: number | null): CollectionItem => ({
  id,
  title,
  originalTitle: null,
  type: "MOVIE",
  posterUrl: null,
  releaseDate: undefined,
  expertAgeRec,
  genres: [],
  synopsisFr: null,
  contentMetrics: null,
})

describe("/collections/[id] — age chip", () => {
  it("reads « Tous publics » for 0, keeps « Dès 9 ans », and shows no chip for an unknown age", async () => {
    const collection = COLLECTIONS[0]
    data.getCollectionWithItems.mockResolvedValue({
      collection,
      items: [item("a", "Classique tous publics", 0), item("b", "Classique neuf ans", 9), item("c", "Classique sans âge", null)],
    })
    render(await CollectionPage({ params: Promise.resolve({ id: collection.id }) }))

    expect(within(screen.getByRole("link", { name: /Classique tous publics/ })).getByText("Tous publics")).toBeInTheDocument()
    expect(within(screen.getByRole("link", { name: /Classique neuf ans/ })).getByText("Dès 9 ans")).toBeInTheDocument()
    expect(within(screen.getByRole("link", { name: /Classique sans âge/ })).queryByText(/^(Tous publics|Dès \d+ ans)$/)).toBeNull()
    expect(screen.queryByText(/Dès 0 ans/)).toBeNull()
  })
})
