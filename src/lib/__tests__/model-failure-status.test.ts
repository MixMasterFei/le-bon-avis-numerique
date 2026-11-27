// @vitest-environment node
import { describe, expect, it } from "vitest"
import { enrichRunStatus, parseEnrichmentResponse, buildEnrichmentMessages } from "../enrichment-analysis"
import { auditRunStatus } from "../synopsis-audit"
import { synopsisModelAlertLine, synopsisModelHealth, type SeoActionTarget } from "../seo-autofix"

// A dead model (retired, renamed, key revoked) must never look green.

describe("enrichRunStatus (/api/admin/enrich)", () => {
  it("every analysed item failed at the model call → error (failure email)", () => {
    expect(enrichRunStatus({ modelAttempts: 5, modelFailures: 5, errors: 5, bailedOnTime: false })).toBe("error")
  })

  it("≥ 50 % model failures → partial", () => {
    expect(enrichRunStatus({ modelAttempts: 4, modelFailures: 2, errors: 2, bailedOnTime: false })).toBe("partial")
  })

  it("keeps the historical rule otherwise: any error or a time bail → partial, else success", () => {
    expect(enrichRunStatus({ modelAttempts: 5, modelFailures: 1, errors: 1, bailedOnTime: false })).toBe("partial")
    // A DB write error is not a model failure: never an error status on its own.
    expect(enrichRunStatus({ modelAttempts: 3, modelFailures: 0, errors: 3, bailedOnTime: false })).toBe("partial")
    expect(enrichRunStatus({ modelAttempts: 5, modelFailures: 0, errors: 0, bailedOnTime: true })).toBe("partial")
    expect(enrichRunStatus({ modelAttempts: 5, modelFailures: 0, errors: 0, bailedOnTime: false })).toBe("success")
  })

  it("an empty backlog is a success", () => {
    expect(enrichRunStatus({ modelAttempts: 0, modelFailures: 0, errors: 0, bailedOnTime: false })).toBe("success")
  })
})

describe("auditRunStatus (/api/admin/synopsis-audit)", () => {
  it("no verdict for any examined synopsis → error", () => {
    expect(auditRunStatus({ examined: 90, unverified: 90, bailedOnTime: false })).toBe("error")
  })

  it("≥ 50 % without verdict → partial", () => {
    expect(auditRunStatus({ examined: 10, unverified: 5, bailedOnTime: false })).toBe("partial")
  })

  it("keeps the historical rule otherwise (> 10 unverified or a time bail)", () => {
    expect(auditRunStatus({ examined: 90, unverified: 11, bailedOnTime: false })).toBe("partial")
    expect(auditRunStatus({ examined: 90, unverified: 3, bailedOnTime: false })).toBe("success")
    expect(auditRunStatus({ examined: 90, unverified: 0, bailedOnTime: true })).toBe("partial")
    expect(auditRunStatus({ examined: 0, unverified: 0, bailedOnTime: false })).toBe("success")
  })
})

describe("synopsisModelHealth (seo-striking-distance)", () => {
  const t = (synopsis: SeoActionTarget["synopsis"]) => ({ synopsis })

  it("counts only rewrites that reached the model", () => {
    const h = synopsisModelHealth([t("rewritten"), t("refused"), t("ai-failed"), t("covered"), t("deferred-cap"), t("would-rewrite")])
    expect(h).toEqual({ attempted: 3, failed: 1, degraded: false })
    expect(synopsisModelAlertLine(h)).toBeNull()
  })

  it("≥ 50 % « ai-failed » → degraded, with the French alert line", () => {
    const h = synopsisModelHealth([t("ai-failed"), t("ai-failed"), t("rewritten"), t("refused")])
    expect(h).toEqual({ attempted: 4, failed: 2, degraded: true })
    expect(synopsisModelAlertLine(h)).toContain("Réécritures de synopsis en échec : 2/4 — modèle indisponible ?")
  })

  it("no attempted rewrite is never degraded", () => {
    expect(synopsisModelHealth([t("covered"), t("no-keyword")]).degraded).toBe(false)
  })
})

describe("enrichment prompt + parser (moved out of the route, unchanged)", () => {
  it("builds the system + user messages with the title", () => {
    const [system, user] = buildEnrichmentMessages({ title: "Le Roi Lion", type: "MOVIE", genres: ["Animation"] })
    expect(system.role).toBe("system")
    expect(user.content).toContain("- Titre: Le Roi Lion")
    expect(user.content).toContain("- Type: Film")
  })

  it("throws on an empty answer and on invalid JSON", () => {
    expect(() => parseEnrichmentResponse("", { title: "x" })).toThrow("No response")
    const error = console.error
    console.error = () => {}
    try {
      expect(() => parseEnrichmentResponse("pas du json", { title: "x" })).toThrow("Invalid JSON")
    } finally {
      console.error = error
    }
  })

  it("clamps scores and filters closed lists", () => {
    const parsed = parseEnrichmentResponse(
      "```json\n" +
        JSON.stringify({
          expertAgeRec: 25,
          contentMetrics: { violence: 9, sexNudity: -1, language: 2 },
          sensitiveWarnings: ["Inventé"],
          toneTags: ["Drôle et léger", "Inventé"],
          pacing: "Inconnu",
          synopsis: "Un synopsis.",
        }) +
        "\n```",
      { title: "x" },
    )
    expect(parsed.expertAgeRec).toBe(18)
    expect(parsed.contentMetrics.violence).toBe(5)
    expect(parsed.contentMetrics.sexNudity).toBe(0)
    expect(parsed.sensitiveWarnings).toEqual([])
    expect(parsed.toneTags).toEqual(["Drôle et léger"])
    expect(parsed.pacing).toBe("Rythme modéré")
  })
})
