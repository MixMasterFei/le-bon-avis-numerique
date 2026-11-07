// @vitest-environment node
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import { NextRequest } from "next/server"

// These five handlers compared the header with an interpolated
// `Bearer ${process.env.CRON_SECRET}`, so with the secret unset they accepted
// `Bearer undefined`. They now go through src/lib/cron-credential.ts.
//
// The database client is an empty object and fetch rejects, so a regression
// (a request let through) fails the assertion instead of reaching a database
// or a third-party API.
const { prisma, logCronRun, runWeeklyDossier, withCronLock } = vi.hoisted(() => ({
  prisma: {},
  logCronRun: vi.fn(),
  runWeeklyDossier: vi.fn(),
  withCronLock: vi.fn(),
}))
vi.mock("@/lib/prisma", () => ({ prisma }))
vi.mock("@/lib/cron-log", () => ({ logCronRun }))
vi.mock("@/lib/news-dossier", () => ({ runWeeklyDossier }))
vi.mock("@/lib/cron-lock", () => ({ withCronLock }))

import { GET as weeklyDossier } from "../weekly-dossier/route"
import { GET as weeklyImport } from "../weekly-import/route"
import { GET as weeklyManga } from "../weekly-manga/route"
import { GET as weeklyGamesImport } from "../weekly-games-import/route"
import { GET as gamesTopNames } from "../games-top-names/route"

const SECRET = "fail-closed-test-secret-0123456789"

const handlers = {
  "/api/cron/weekly-dossier": weeklyDossier,
  "/api/cron/weekly-import": weeklyImport,
  "/api/cron/weekly-manga": weeklyManga,
  "/api/cron/weekly-games-import": weeklyGamesImport,
  "/api/cron/games-top-names": gamesTopNames,
}

function call(pathname: keyof typeof handlers, authorization?: string) {
  const headers: Record<string, string> = authorization === undefined ? {} : { authorization }
  return handlers[pathname](new NextRequest(`https://totemavise.com${pathname}`, { headers }))
}

beforeEach(() => {
  vi.resetAllMocks()
  vi.stubGlobal("fetch", vi.fn(async () => { throw new Error("no network in tests") }))
  // Deployed builds run with NODE_ENV=production; the local escape hatch must
  // stay shut there even if someone sets the opt-in flag.
  vi.stubEnv("NODE_ENV", "production")
  vi.stubEnv("ALLOW_INSECURE_CRON_LOCAL", "true")
})
afterEach(() => {
  vi.unstubAllEnvs()
  vi.unstubAllGlobals()
})

describe.each(Object.keys(handlers) as (keyof typeof handlers)[])("%s", (pathname) => {
  it.each([
    ["absent", "Bearer undefined", undefined],
    ["absent", "no header", undefined],
    ["empty", "Bearer ", ""],
    ["blank", "Bearer   ", "  "],
    ["set", "a wrong secret", SECRET],
    ["set", "no header", SECRET],
  ])("answers 401 when the secret is %s and the request sends %j", async (_label, sent, configured) => {
    const header = sent === "no header" ? undefined : sent === "a wrong secret" ? "Bearer guess" : sent
    vi.stubEnv("CRON_SECRET", configured)
    const response = await call(pathname, header)
    expect(response.status).toBe(401)
    expect(runWeeklyDossier).not.toHaveBeenCalled()
    expect(withCronLock).not.toHaveBeenCalled()
    expect(logCronRun).not.toHaveBeenCalled()
  })
})

describe("with the right credential", () => {
  beforeEach(() => vi.stubEnv("CRON_SECRET", SECRET))

  it("runs a scheduled job (weekly-dossier) end to end", async () => {
    withCronLock.mockImplementation(async (_task: string, _lease: number, run: () => unknown) => run())
    runWeeklyDossier.mockResolvedValue({ result: "persisted", briefsConsidered: 4, dossierId: "d-1" })
    const response = await call("/api/cron/weekly-dossier", `Bearer ${SECRET}`)
    expect(response.status).toBe(200)
    expect(runWeeklyDossier).toHaveBeenCalledOnce()
  })

  it("no longer opens the retired weekly-manga job (nothing schedules it)", async () => {
    expect((await call("/api/cron/weekly-manga", `Bearer ${SECRET}`)).status).toBe(401)
  })
})
