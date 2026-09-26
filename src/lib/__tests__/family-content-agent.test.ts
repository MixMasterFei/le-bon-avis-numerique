import { beforeEach, describe, expect, it, vi } from "vitest"

// ---------------------------------------------------------------------------
// Ce que ces tests protègent, c'est la franchise du rapport — pas sa prose.
//
// Pendant six semaines (17 août → 21 septembre 2026) l'agent a envoyé chaque
// lundi un e-mail tronqué au plafond de tokens, amputé de sa checklist
// d'actions, en le journalisant `success` avec un compte de « 24 fiches » qui
// n'était que le plafond de sélection. Rien dans la chaîne ne pouvait le
// signaler. Ces tests rendent ces deux régressions impossibles à repasser.
// ---------------------------------------------------------------------------

// `vi.mock` est hissé au-dessus des déclarations du module : les doublures
// doivent naître dans `vi.hoisted` pour exister quand les fabriques tournent.
const { messagesCreate, sendReport, findMany, count } = vi.hoisted(() => ({
  messagesCreate: vi.fn(),
  sendReport: vi.fn(),
  findMany: vi.fn(),
  count: vi.fn(),
}))

vi.mock("@/lib/anthropic", () => ({
  getAnthropic: () => ({ messages: { create: messagesCreate } }),
  DEFAULT_MODEL: "test-model",
}))

vi.mock("@/lib/anthropic-with-timeout", () => ({
  callClaudeWithTimeout: async (fn: (s: AbortSignal) => Promise<unknown>) =>
    fn(new AbortController().signal),
}))

vi.mock("@/lib/email", () => ({ sendEditorialAgentReport: sendReport }))

vi.mock("@/lib/collections-data", () => ({ COLLECTIONS: [] }))

vi.mock("@/lib/prisma", () => ({
  prisma: {
    mediaItem: {
      findMany: (...args: unknown[]) => findMany(...args),
      count: (...args: unknown[]) => count(...args),
    },
  },
}))

import { runFamilyContentAgent } from "@/lib/family-content-agent"

/** Une fiche qui passe le seuil de priorité (sortie proche + signaux famille). */
function fiche(id: string) {
  const inTenDays = new Date(Date.now() + 10 * 86_400_000)
  return {
    id,
    title: `Titre ${id}`,
    type: "MOVIE",
    releaseDate: inTenDays,
    expertAgeRec: 8,
    genres: ["Animation", "Aventure"],
    topics: ["amitié"],
    platforms: [],
    synopsisFr: "Court synopsis.",
    tmdbRating: 7,
    tmdbVoteCount: 300,
    dataQualityScore: 60,
    isEnriched: false,
    contentMetrics: null,
    _count: { reviews: 0 },
  }
}

function claudeReplies(text: string, stopReason: string) {
  messagesCreate.mockResolvedValue({
    content: [{ type: "text", text }],
    stop_reason: stopReason,
  })
}

/**
 * Arme les deux viviers. `mockReset` (et non `clearAllMocks`) parce que les
 * files `mockResolvedValueOnce` survivent à un simple `clear` — un test qui
 * réarme après coup consommerait alors la file du test précédent.
 */
function givenPool(opts: {
  window: ReturnType<typeof fiche>[]
  backlog?: ReturnType<typeof fiche>[]
  windowCount: number
  backlogCount: number
}) {
  findMany.mockReset()
  count.mockReset()
  findMany.mockResolvedValueOnce(opts.window).mockResolvedValueOnce(opts.backlog ?? [])
  count.mockResolvedValueOnce(opts.windowCount).mockResolvedValueOnce(opts.backlogCount)
}

beforeEach(() => {
  vi.clearAllMocks()
  messagesCreate.mockReset()
  // Par défaut : 2 fiches sélectionnées pour une file réelle de 200.
  givenPool({ window: [fiche("a"), fiche("b")], windowCount: 140, backlogCount: 60 })
})

describe("runFamilyContentAgent — troncature", () => {
  it("journalise `partial` et le signale dans le corps quand le rapport est coupé", async () => {
    claudeReplies("# Rapport\n\nSection 1, coupée au milieu d'une phr", "max_tokens")

    const result = await runFamilyContentAgent()

    expect(result.truncated).toBe(true)
    expect(result.status).toBe("partial")
    // Le lecteur doit voir que la fin manque, pas la deviner.
    expect(result.report).toContain("Rapport coupé")
  })

  it("reste `success` quand la rédaction va au bout", async () => {
    claudeReplies("# Rapport\n\nTout le rapport, checklist comprise.", "end_turn")

    const result = await runFamilyContentAgent()

    expect(result.truncated).toBe(false)
    expect(result.status).toBe("success")
    expect(result.report).not.toContain("Rapport coupé")
  })

  it("retombe en `partial` si la rédaction échoue et qu'on sert la liste déterministe", async () => {
    messagesCreate.mockResolvedValue(null)

    const result = await runFamilyContentAgent()

    expect(result.status).toBe("partial")
    expect(result.report).toContain("Claude n'a pas répondu à temps")
  })
})

describe("runFamilyContentAgent — comptes honnêtes", () => {
  it("distingue la sélection envoyée de la file réelle", async () => {
    claudeReplies("# Rapport", "end_turn")

    const result = await runFamilyContentAgent()

    expect(result.candidatesSelected).toBe(2)
    expect(result.candidatesMatching).toBe(200) // 140 + 60
    expect(result.capped).toBe(true)
  })

  it("annonce les deux nombres dans le sujet de l'e-mail", async () => {
    claudeReplies("# Rapport", "end_turn")

    await runFamilyContentAgent()

    const subject = sendReport.mock.calls[0][0].subject as string
    expect(subject).toContain("2 fiches à traiter")
    expect(subject).toContain("200 en file")
  })

  it("ne parle pas de file quand tout tient dans la sélection", async () => {
    givenPool({ window: [fiche("a")], windowCount: 1, backlogCount: 0 })
    claudeReplies("# Rapport", "end_turn")

    const result = await runFamilyContentAgent()

    expect(result.capped).toBe(false)
    expect(sendReport.mock.calls[0][0].subject).toContain("1 fiches candidates")
  })
})

describe("runFamilyContentAgent — fenêtre de sélection", () => {
  it("borne les deux viviers au lieu de laisser l'ordre de tri les choisir", async () => {
    claudeReplies("# Rapport", "end_turn")

    await runFamilyContentAgent()

    const [windowArgs, backlogArgs] = findMany.mock.calls.map((c) => c[0])

    // Vivier A : fenêtre de sortie fermée des deux côtés. C'est ce plafond qui
    // manquait — la sélection remontait jusqu'en 2031.
    expect(windowArgs.where.releaseDate.gte).toBeInstanceOf(Date)
    expect(windowArgs.where.releaseDate.lte).toBeInstanceOf(Date)
    expect(windowArgs.where.releaseDate.lte.getTime()).toBeGreaterThan(Date.now())
    // Trié par sortie la plus proche : le moins de temps pour agir d'abord.
    expect(windowArgs.orderBy[0]).toEqual({ releaseDate: "asc" })

    // Vivier B : l'arriéré, réservé explicitement, et seulement du déjà-sorti.
    expect(backlogArgs.where.releaseDate.lt).toBeInstanceOf(Date)
    expect(backlogArgs.orderBy[0]).toEqual({ dataQualityScore: "asc" })
  })

  it("passe la date du jour à la rédaction pour tuer « Semaine du [date] »", async () => {
    claudeReplies("# Rapport", "end_turn")

    await runFamilyContentAgent()

    const prompt = messagesCreate.mock.calls[0][0].messages[0].content as string
    expect(prompt).toContain(String(new Date().getFullYear()))
    expect(prompt).toContain("Semaine du [date]") // la consigne l'interdit explicitement
  })
})
