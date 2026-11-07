import { beforeEach, describe, expect, it, vi } from "vitest"

// Real builders end to end, from a catalogue row: only the database reads are
// stubbed (same seams as src/lib/mcp/catalog.test.ts).
const db = vi.hoisted(() => ({ findFirst: vi.fn(), query: vi.fn(), movies: vi.fn() }))
vi.mock("@/lib/prisma", () => ({ prisma: { mediaItem: { findFirst: db.findFirst }, $queryRaw: db.query } }))
vi.mock("@/lib/prisma-retry", () => ({ withPrismaRetry: (run: () => unknown) => run() }))
vi.mock("@/lib/media-queries", () => ({ fetchMovies: db.movies, fetchSeries: db.movies, fetchGames: db.movies }))

import { buildQuickAnswer } from "@/lib/quick-answer"
import { buildAgeRationale } from "@/lib/age-rationale"
import { loadMediaMdInput } from "@/lib/markdown/media-md-data"
import { renderMediaMarkdown } from "@/lib/markdown/media-md"
import { ageVerdict, recommendForAge, searchMedia } from "@/lib/mcp/totem-tools"
import { toolOutputSchema } from "@/lib/mcp/result"
import { buildFicheTitle, ficheAgeLead, ficheOgVerdict, ficheTypicalAgeRange, seoTitleMatchesAge } from "@/lib/fiche-title"

// F04 — one known-age contract on every surface:
//   0     = a KNOWN verdict, « Tous publics » — never exported or worded as unknown;
//   null  = unknown — never presented as an evaluated title;
//   an estimate (provisional / pre-release) says « à confirmer » and makes no content claim.

const uuid = "5d0c5b0e-2f4e-4b8a-9a51-0c3c1f1f7a11"
const metrics = { violence: 0, sexNudity: 0, language: 0, substanceUse: 0, consumerism: 0, positiveMessages: 4, roleModels: 4, whatParentsNeedToKnow: [] as string[] }
const analysed = {
  ...metrics, enrichmentSource: "AI", enrichmentConfidence: 0.8, pass1At: new Date("2026-07-01"), pass2At: null,
  sensitiveWarnings: [] as string[], sensitiveWarningsAt: new Date("2026-07-01"),
}

/** A catalogue row as Prisma returns it. */
function row(expertAgeRec: number | null, extra: Record<string, unknown> = {}) {
  return {
    id: uuid, title: "Le Film", originalTitle: null, type: "MOVIE", tmdbId: 101, igdbId: null,
    posterUrl: "https://example.com/poster.jpg", dataQualityScore: 80, expertAgeRec, officialRating: null,
    isEnriched: true, releaseStatus: "Released", releaseDate: new Date("2020-01-15"),
    updatedAt: new Date("2026-11-01"), contentUpdatedAt: new Date("2026-09-04"),
    topics: [], genres: ["Animation"], contentMetrics: analysed,
    ...extra,
  }
}
const tp = row(0)
const ten = row(10)
// Unknown age: never analysed (no ContentMetrics row), not enriched.
const unknown = row(null, { isEnriched: false, contentMetrics: null })
// Estimated: imported, age guessed, not enriched yet.
const tpEstimate = row(0, { isEnriched: false, contentMetrics: null })

const quickAnswerOf = (expertAgeRec: number | null, hideContentAnalysis = false) =>
  buildQuickAnswer({ title: "Le Film", type: "MOVIE", expertAgeRec, contentMetrics: metrics, hideContentAnalysis })
const rationaleOf = (expertAgeRec: number | null, extra: Record<string, unknown> = {}) =>
  buildAgeRationale({ title: "Le Film", type: "MOVIE", expertAgeRec, contentMetrics: metrics, ...extra })

async function markdownOf(dbRow: ReturnType<typeof row>) {
  db.findFirst.mockResolvedValue(dbRow)
  return renderMediaMarkdown((await loadMediaMdInput(uuid))!)
}
async function verdictOf(dbRow: ReturnType<typeof row>) {
  db.findFirst.mockResolvedValue(dbRow)
  const response = await ageVerdict({ id: `movie:${uuid}` })
  expect(toolOutputSchema.safeParse(response.data).success).toBe(true)
  return { text: response.text, media: response.data.result.kind === "verdict" ? response.data.result.media : null }
}
async function searchOf(dbRow: ReturnType<typeof row>) {
  db.query.mockResolvedValue([dbRow])
  const response = await searchMedia("le film")
  expect(toolOutputSchema.safeParse(response.data).success).toBe(true)
  return { text: response.text, match: response.data.result.kind === "search" ? response.data.result.matches[0] : null }
}

beforeEach(() => {
  vi.clearAllMocks()
  db.query.mockResolvedValue([])
  db.movies.mockResolvedValue({ items: [] })
})

describe("0 = « Tous publics » is a known, evaluated verdict everywhere", () => {
  it("quick answer and « Pourquoi ? » state it, never « à confirmer »", () => {
    const qa = quickAnswerOf(0)
    expect(qa.answer).toContain("conseillé pour tous publics")
    expect(qa.answer).not.toContain("à confirmer")

    const rationale = rationaleOf(0)
    expect(rationale.show).toBe(true)
    expect(rationale.heading).toBe("Pourquoi tous publics ?")
    expect(rationale.lead).toBe("Le Film est conseillé pour tous publics.")
    expect(rationale.faqQuestion).toBe("Le Film : pourquoi est-ce conseillé pour tous publics ?")
  })

  it("a raised axis on a TP title is a point to watch, never a reason for « tous publics »", () => {
    const rationale = rationaleOf(0, { contentMetrics: { ...metrics, consumerism: 4 } })
    expect(rationale.lead).toContain("À surveiller malgré tout : consumérisme (marqué)")
    expect(rationale.lead).not.toContain("en raison de")
  })

  it("the /md fiche and the MCP verdict and search export 0, worded « pour tous publics »", async () => {
    const md = await markdownOf(tp)
    expect(md).toContain("Âge conseillé Totem: pour tous publics\n")
    expect(md).toContain("## Pourquoi tous publics ?")
    expect(md).not.toContain("âge à confirmer")

    const verdict = await verdictOf(tp)
    expect(verdict.media?.age).toBe(0)
    expect(verdict.media?.provisional).toBe(false)
    expect(verdict.text).toContain("pour tous publics")

    const search = await searchOf(tp)
    expect(search.match?.age).toBe(0)
    expect(search.text).toContain("· pour tous publics")
    expect(search.text).not.toContain("âge à confirmer")
  })

  it("stays eligible in age selections — the most eligible age there is", async () => {
    db.movies.mockResolvedValue({ items: [
      { ...tp, releaseDate: "2020-01-15" },
      { ...ten, releaseDate: "2020-01-15", id: "dix" },
      { ...unknown, releaseDate: "2020-01-15", id: "inconnu" },
      { ...tpEstimate, releaseDate: "2020-01-15", id: "estime", isProvisional: true },
    ] })
    const result = await recommendForAge(5)
    expect(toolOutputSchema.safeParse(result.data).success).toBe(true)
    expect(result.data.result.kind === "selection" && result.data.result.items.map((m) => [m.id, m.age])).toEqual([[`movie:${uuid}`, 0]])
    expect(result.text).toContain("— pour tous publics —")
  })

  it("carries « Tous publics » into the SERP title, meta description, social card and schema.org", () => {
    expect(buildFicheTitle({ title: "Le Film", age: 0 })).toBe("Le Film — À partir de quel âge ? Tous publics")
    expect(ficheAgeLead({ age: 0 })).toBe("Tous publics · Notre avis famille")
    expect(ficheOgVerdict({ age: 0 })).toBe("Tous publics")
    expect(ficheTypicalAgeRange({ age: 0 })).toBe("0-")
    // A stored title must agree with the verdict, both ways.
    expect(seoTitleMatchesAge("Le Film — Tous publics", 0)).toBe(true)
    expect(seoTitleMatchesAge("Le Film — Dès 6 ans", 0)).toBe(false)
    expect(seoTitleMatchesAge("Le Film — Tous publics", 6)).toBe(false)
  })
})

describe("a positive age keeps its wording", () => {
  it("on every surface", async () => {
    expect(quickAnswerOf(10).answer).toContain("conseillé à partir de 10 ans")
    expect(rationaleOf(10).heading).toBe("Pourquoi dès 10 ans ?")
    expect(await markdownOf(ten)).toContain("Âge conseillé Totem: dès 10 ans\n")
    expect((await verdictOf(ten)).media?.age).toBe(10)
    expect((await searchOf(ten)).text).toContain("· dès 10 ans")
    expect(buildFicheTitle({ title: "Le Film", age: 10 })).toBe("Le Film — À partir de quel âge ? Dès 10 ans")
    expect(ficheAgeLead({ age: 10 })).toBe("Dès 10 ans · Notre avis famille")
    expect(ficheOgVerdict({ age: 10 })).toBe("Dès 10 ans")
    expect(ficheTypicalAgeRange({ age: 10 })).toBe("10-")
  })
})

describe("an unknown age (null) is never presented as an evaluated title", () => {
  it("makes no content claim, even on a released fiche", () => {
    const qa = quickAnswerOf(null)
    expect(qa.answer).toContain("reste à confirmer")
    expect(qa.answer).not.toContain("Aucun signal sensible")
    expect(qa.answer).not.toContain("Points à vérifier")
    expect(rationaleOf(null).show).toBe(false)
  })

  it("is exported as unknown, once", async () => {
    const md = await markdownOf(unknown)
    expect(md).toContain("Âge conseillé Totem: âge à confirmer\n")
    expect(md).not.toContain("(à confirmer) (à confirmer)")
    expect(md).not.toContain("âge à confirmer (à confirmer)")

    expect((await verdictOf(unknown)).media?.age).toBeNull()
    expect((await searchOf(unknown)).text).toContain("· âge à confirmer")

    expect(buildFicheTitle({ title: "Le Film", age: null })).toBe("Le Film")
    expect(ficheAgeLead({ age: null })).toBeNull()
    expect(ficheOgVerdict({ age: null })).toBe("Repères famille")
    expect(ficheTypicalAgeRange({ age: null })).toBeNull()
  })
})

describe("an estimate (provisional) is never presented as fully evaluated", () => {
  it("says « à confirmer » and makes no content claim", () => {
    const qa = quickAnswerOf(0, true)
    expect(qa.answer).toContain("estimé tous publics (à confirmer)")
    expect(qa.answer).not.toContain("Aucun signal sensible")
    expect(quickAnswerOf(10, true).answer).toContain("à partir de 10 ans (à confirmer)")

    const rationale = rationaleOf(0, { hideContentAnalysis: true })
    expect(rationale.heading).toBe("Pourquoi cette estimation ?")
    expect(rationale.lead).toContain("(tous publics, à confirmer)")
  })

  it("keeps the known estimate, flagged, in every export", async () => {
    const md = await markdownOf(tpEstimate)
    expect(md).toContain("Âge conseillé Totem: pour tous publics (à confirmer)\n")
    expect(md).toContain("Statut de l'analyse: provisoire")

    const verdict = await verdictOf(tpEstimate)
    expect(verdict.media?.age).toBe(0)
    expect(verdict.media?.provisional).toBe(true)
    expect((await searchOf(tpEstimate)).text).toContain("· pour tous publics (estimation à confirmer)")

    // (The question variant doesn't fit the 52-char budget with « (à confirmer) ».)
    expect(buildFicheTitle({ title: "Le Film", age: 0, provisional: true })).toBe("Le Film — Tous publics (à confirmer)")
    expect(ficheAgeLead({ age: 0, provisional: true })).toBe("Estimé tous publics (à confirmer)")
    expect(ficheOgVerdict({ age: 0, provisional: true })).toBe("Tous publics (à confirmer)")
    expect(ficheOgVerdict({ age: 10, provisional: true })).toBe("Dès 10 ans (à confirmer)")
    expect(ficheTypicalAgeRange({ age: 0, provisional: true })).toBeNull()
  })
})
