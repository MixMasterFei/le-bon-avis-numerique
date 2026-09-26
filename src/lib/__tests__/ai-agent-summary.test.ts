import { describe, it, expect } from "vitest"
import { summarizeUserAgent, AGENT_SAMPLE_RATE } from "@/lib/ai-bots"

// Ce résumé existe pour nommer les ~265 000 requêtes/jour que la liste fermée
// de robots ne voyait pas. Il n'a de valeur que s'il reste à FAIBLE
// CARDINALITÉ : un jeton par outil, pas un par version — sinon la table
// d'échantillons devient illisible et grossit sans fin.

describe("summarizeUserAgent", () => {
  it("nomme un robot qui s'annonce dans le commentaire compatible", () => {
    expect(
      summarizeUserAgent("Mozilla/5.0 (compatible; SemrushBot/7~bl; +http://www.semrush.com/bot.html)"),
    ).toBe("SemrushBot")
    expect(
      summarizeUserAgent("Mozilla/5.0 (compatible; Bytespider; spider-feedback@bytedance.com)"),
    ).toBe("Bytespider")
  })

  it("nomme les clients non navigateurs", () => {
    expect(summarizeUserAgent("python-requests/2.31.0")).toBe("python-requests")
    expect(summarizeUserAgent("curl/8.4.0")).toBe("curl")
    expect(summarizeUserAgent("Go-http-client/2.0")).toBe("Go-http-client")
    expect(summarizeUserAgent("axios/1.6.2")).toBe("axios")
  })

  it("range un vrai navigateur sous un seul jeton, quelle que soit la version", () => {
    const chrome120 =
      "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36"
    const chrome131 =
      "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.6778.86 Safari/537.36"
    const safariIos =
      "Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1"

    // Le point : deux versions de Chrome ne doivent pas produire deux lignes.
    expect(summarizeUserAgent(chrome120)).toBe("navigateur")
    expect(summarizeUserAgent(chrome131)).toBe("navigateur")
    expect(summarizeUserAgent(safariIos)).toBe("navigateur")
  })

  it("distingue l'agent absent de l'agent illisible", () => {
    expect(summarizeUserAgent(null)).toBe("(absent)")
    expect(summarizeUserAgent("   ")).toBe("(absent)")
    expect(summarizeUserAgent("!!!")).toBe("(inconnu)")
  })

  it("borne le jeton et retire tout ce qui n'est pas alphanumérique", () => {
    const hostile = summarizeUserAgent("A".repeat(500) + "/1.0")
    expect(hostile.length).toBeLessThanOrEqual(60)
    expect(hostile).toMatch(/^[A-Za-z0-9._-]+$/)
    // Pas d'injection possible dans la colonne via le User-Agent.
    expect(summarizeUserAgent("'; DROP TABLE ai_bot_hits;--/1.0")).toMatch(/^[A-Za-z0-9._-]+$/)
  })

  it("garde un taux d'échantillonnage qui ne noie pas la base", () => {
    // 267 000 req/jour ÷ 200 ≈ 1 300 écritures : mesurable, pas ruineux.
    expect(AGENT_SAMPLE_RATE).toBeGreaterThanOrEqual(50)
    expect(267_000 / AGENT_SAMPLE_RATE).toBeLessThan(10_000)
  })
})
