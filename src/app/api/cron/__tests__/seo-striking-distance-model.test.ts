// @vitest-environment node
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import { NextRequest } from "next/server"

// A dead synopsis model must not log a green SEO run.

const { isCronOrAdminAuthorized, logCronRun, sendSeoReport, runSeoStrikingDistance, runSeoAutofix } = vi.hoisted(() => ({
  isCronOrAdminAuthorized: vi.fn(),
  logCronRun: vi.fn(),
  sendSeoReport: vi.fn(),
  runSeoStrikingDistance: vi.fn(),
  runSeoAutofix: vi.fn(),
}))
vi.mock("@/lib/cron-auth", () => ({ isCronOrAdminAuthorized }))
vi.mock("@/lib/cron-log", () => ({ logCronRun }))
vi.mock("@/lib/email", () => ({ sendSeoReport }))
vi.mock("@/lib/seo-striking-distance", () => ({ runSeoStrikingDistance, toLoggedQueries: () => [] }))
vi.mock("@/lib/seo-autofix", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/seo-autofix")>()
  return { ...actual, runSeoAutofix }
})

import { GET } from "../seo-striking-distance/route"
import { synopsisModelHealth, type SeoActionTarget } from "@/lib/seo-autofix"

function autofix(synopses: SeoActionTarget["synopsis"][]) {
  const targets = synopses.map((synopsis) => ({ synopsis, seoTitle: "n/a", linksCreated: [], title: "t", routeId: "r" }))
  return {
    ran: true,
    dryRun: false,
    targets,
    linksCreated: 0,
    synopsesRewritten: synopses.filter((s) => s === "rewritten").length,
    titlesSet: 0,
    flagged: 0,
    skippedNonMedia: 0,
    distinctTargets: targets.length,
    droppedByCap: 0,
    missingItems: 0,
    targetsExamined: targets.length,
    linkOnlyExamined: 0,
    linkOnlyLinksCreated: 0,
    saturated: 0,
    outcomes: {
      synopsis: {},
      seoTitle: {},
      links: {},
      refusals: { synopsis: {}, seoTitle: {} },
      synopsisModel: synopsisModelHealth(targets),
    },
    refusalsDetail: [],
    section: "\n## Actions",
  }
}

const call = () => GET(new NextRequest("https://totemavise.com/api/cron/seo-striking-distance"))

beforeEach(() => {
  vi.resetAllMocks()
  isCronOrAdminAuthorized.mockResolvedValue(true)
  vi.stubEnv("VERCEL_ENV", "production")
  runSeoStrikingDistance.mockResolvedValue({
    configured: true,
    strikingQueries: [{ query: "q" }],
    actionableQueries: [{ query: "q" }],
    totalStriking: 1,
    totalImpressionsAtStake: 10,
    range: {},
    report: "# Rapport",
  })
})
afterEach(() => vi.unstubAllEnvs())

describe("GET /api/cron/seo-striking-distance — synopsis model health", () => {
  it("≥ 50 % « ai-failed » → partial, alert line first in the email and in outcomes", async () => {
    runSeoAutofix.mockResolvedValue(autofix(["ai-failed", "ai-failed", "rewritten"]))
    await call()
    const logged = logCronRun.mock.calls[0][0]
    expect(logged.status).toBe("partial")
    expect(logged.summary).toContain("réécritures de synopsis en échec : 2/3")
    expect(logged.details.outcomes.synopsisModel).toEqual({ attempted: 3, failed: 2, degraded: true })
    const email = sendSeoReport.mock.calls[0][0]
    expect(email.report.startsWith("**Réécritures de synopsis en échec : 2/3 — modèle indisponible ?**")).toBe(true)
  })

  it("a few failures stay success with no alert", async () => {
    runSeoAutofix.mockResolvedValue(autofix(["ai-failed", "rewritten", "rewritten"]))
    await call()
    expect(logCronRun.mock.calls[0][0].status).toBe("success")
    expect(sendSeoReport.mock.calls[0][0].report.startsWith("# Rapport")).toBe(true)
  })
})
