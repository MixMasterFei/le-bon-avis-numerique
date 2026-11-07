// @vitest-environment node
import { readFileSync } from "node:fs"
import path from "node:path"
import { timingSafeEqual } from "node:crypto"
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import { NextRequest } from "next/server"
import {
  CRON_JOB_ROUTES,
  allowsInsecureLocalCron,
  hasValidCronBearer,
  isCronJobRequest,
  isCronJobRoute,
  matchesCronSecret,
} from "@/lib/cron-credential"
import { EXPECTED_TASKS } from "@/lib/cron-supervisor"

vi.mock("node:crypto", async (importOriginal) => {
  const actual = await importOriginal<typeof import("node:crypto")>()
  return { ...actual, timingSafeEqual: vi.fn(actual.timingSafeEqual) }
})

const SECRET = "s3cret-for-tests-only-0123456789"
const ROOT = path.resolve(__dirname, "../../..")

function request(method: string, pathname: string, authorization?: string) {
  return new NextRequest(`https://totemavise.com${pathname}`, {
    method,
    headers: authorization === undefined ? {} : { authorization },
  })
}

afterEach(() => {
  vi.unstubAllEnvs()
  vi.mocked(timingSafeEqual).mockClear()
})

describe("CRON_SECRET comparison fails closed", () => {
  it.each([
    ["absent", undefined],
    ["empty", ""],
    ["blank", "   "],
  ])("opens nothing when the secret is %s", (_label, configured) => {
    vi.stubEnv("CRON_SECRET", configured)
    // What the old interpolated check (`Bearer ${process.env.CRON_SECRET}`)
    // would have produced — and accepted — for an unset secret.
    for (const header of ["Bearer undefined", "Bearer null", "Bearer ", "Bearer    ", "Bearer"]) {
      expect(hasValidCronBearer(header)).toBe(false)
    }
    expect(matchesCronSecret("")).toBe(false)
    expect(matchesCronSecret("undefined")).toBe(false)
    expect(matchesCronSecret(configured)).toBe(false)
  })

  it("refuses a wrong, truncated, extended or differently-prefixed secret", () => {
    vi.stubEnv("CRON_SECRET", SECRET)
    expect(hasValidCronBearer(null)).toBe(false)
    expect(hasValidCronBearer(undefined)).toBe(false)
    expect(hasValidCronBearer("Bearer wrong")).toBe(false)
    expect(hasValidCronBearer(`Bearer ${SECRET.slice(0, -1)}`)).toBe(false)
    expect(hasValidCronBearer(`Bearer ${SECRET}x`)).toBe(false)
    expect(hasValidCronBearer(`Bearer  ${SECRET}`)).toBe(false)
    expect(hasValidCronBearer(`bearer ${SECRET}`)).toBe(false)
    expect(hasValidCronBearer(`Basic ${SECRET}`)).toBe(false)
    expect(hasValidCronBearer(SECRET)).toBe(false)
  })

  it("accepts exactly `Bearer <CRON_SECRET>`", () => {
    vi.stubEnv("CRON_SECRET", SECRET)
    expect(hasValidCronBearer(`Bearer ${SECRET}`)).toBe(true)
    expect(matchesCronSecret(SECRET)).toBe(true)
  })

  it("compares equal-length digests in constant time, whatever the presented length", () => {
    vi.stubEnv("CRON_SECRET", SECRET)
    hasValidCronBearer("Bearer x")
    hasValidCronBearer(`Bearer ${SECRET}${"y".repeat(500)}`)
    hasValidCronBearer(`Bearer ${SECRET}`)
    const calls = vi.mocked(timingSafeEqual).mock.calls
    expect(calls).toHaveLength(3)
    for (const [a, b] of calls) {
      expect((a as Buffer).length).toBe(32)
      expect((b as Buffer).length).toBe(32)
    }
  })
})

describe("the credential is scoped to the scheduled job routes", () => {
  beforeEach(() => vi.stubEnv("CRON_SECRET", SECRET))

  it("opens a job route only with the method the scheduler uses", () => {
    expect(isCronJobRoute("POST", "/api/admin/enrich")).toBe(true)
    expect(isCronJobRoute("GET", "/api/cron/heartbeat")).toBe(true)
    expect(isCronJobRoute("POST", "/api/cron/heartbeat")).toBe(false)
    expect(isCronJobRoute("GET", "/api/admin/similarity/compute")).toBe(false)
    expect(isCronJobRoute("PATCH", "/api/admin/enrich-deep")).toBe(false)
  })

  it.each([
    ["GET", "/api/admin/totem/conversations"],
    ["GET", "/api/admin/totem/conversations/conv-1"],
    ["GET", "/api/admin/totem"],
    ["GET", "/api/admin/users"],
    ["GET", "/api/admin/dashboard"],
    ["POST", "/api/admin/tw-backfill"],
    ["POST", "/api/cron/news-reset-recent"],
    ["GET", "/api/cron/weekly-manga"],
    ["GET", "/admin"],
    ["POST", "/api/admin/enrich/"],
    ["POST", "/api/admin/enrichx"],
    ["POST", "/api/admin/enrich/extra"],
  ])("does not open %s %s", (method, pathname) => {
    expect(isCronJobRoute(method, pathname)).toBe(false)
    expect(isCronJobRequest(request(method, pathname, `Bearer ${SECRET}`))).toBe(false)
  })

  it("needs both a job route and the secret", () => {
    expect(isCronJobRequest(request("POST", "/api/admin/enrich", `Bearer ${SECRET}`))).toBe(true)
    expect(isCronJobRequest(request("GET", "/api/cron/supervisor?x=1", `Bearer ${SECRET}`))).toBe(true)
    expect(isCronJobRequest(request("POST", "/api/admin/enrich", "Bearer nope"))).toBe(false)
    expect(isCronJobRequest(request("POST", "/api/admin/enrich"))).toBe(false)
    vi.stubEnv("CRON_SECRET", undefined)
    expect(isCronJobRequest(request("POST", "/api/admin/enrich", "Bearer undefined"))).toBe(false)
  })

  it("keeps the local-development escape hatch behind both conditions", () => {
    vi.stubEnv("ALLOW_INSECURE_CRON_LOCAL", "true")
    vi.stubEnv("NODE_ENV", "production")
    expect(allowsInsecureLocalCron()).toBe(false)
    vi.stubEnv("NODE_ENV", "development")
    expect(allowsInsecureLocalCron()).toBe(true)
    vi.stubEnv("ALLOW_INSECURE_CRON_LOCAL", "false")
    expect(allowsInsecureLocalCron()).toBe(false)
  })
})

// ── The allowlist is exactly what the schedulers call ──────────────────────

type Call = { method: string; path: string }
const key = (c: Call) => `${c.method} ${c.path}`

/** Every `$SITE_URL/api/...` request in cron.yml, with the curl command's method. */
function workflowCalls(): Call[] {
  const yml = readFileSync(path.join(ROOT, ".github/workflows/cron.yml"), "utf8")
  // Fold shell line continuations so each curl command sits on one line.
  const lines = yml.replace(/\\\n\s*/g, " ").split("\n")
  const calls: Call[] = []
  lines.forEach((line, i) => {
    if (line.trim().startsWith("#")) return
    const match = line.match(/\$SITE_URL(\/api\/[A-Za-z0-9/_-]+)/)
    if (!match) return
    // `url="$SITE_URL/api/…"` is sent by the next curl of the step.
    const curl = /\bcurl\b/.test(line) ? line : lines.slice(i + 1).find((l) => /\bcurl\b/.test(l))
    expect(curl, `no curl command for ${match[1]}`).toBeDefined()
    calls.push({ method: /-X\s+POST\b/.test(curl!) ? "POST" : "GET", path: match[1] })
  })
  return calls
}

function vercelCronCalls(): Call[] {
  const config = JSON.parse(readFileSync(path.join(ROOT, "vercel.json"), "utf8")) as {
    crons?: { path: string }[]
  }
  // Vercel Cron issues GET requests.
  return (config.crons ?? []).map((c) => ({ method: "GET", path: new URL(c.path, "https://x").pathname }))
}

const allowlisted = (calledBy: string) =>
  new Set(CRON_JOB_ROUTES.filter((r) => r.calledBy === calledBy).map(key))

describe("CRON_JOB_ROUTES mirrors cron.yml and vercel.json", () => {
  it("parses a plausible number of scheduled calls (guards the parser itself)", () => {
    const calls = workflowCalls()
    expect(calls.length).toBeGreaterThan(30)
    expect(calls).toContainEqual({ method: "POST", path: "/api/admin/screenshots/import" })
    expect(calls).toContainEqual({ method: "GET", path: "/api/cron/game-guides-check" })
  })

  it("allows every call cron.yml makes — and nothing cron.yml does not make", () => {
    const scheduled = new Set(workflowCalls().map(key))
    const missing = [...scheduled].filter((k) => !allowlisted("cron.yml").has(k))
    const stale = [...allowlisted("cron.yml")].filter((k) => !scheduled.has(k))
    expect(missing, "cron.yml calls these: add them to CRON_JOB_ROUTES (src/lib/cron-credential.ts)").toEqual([])
    expect(stale, "nothing in cron.yml calls these any more: drop them from CRON_JOB_ROUTES").toEqual([])
  })

  it("allows every Vercel Cron path — and nothing else under that label", () => {
    expect([...allowlisted("vercel.json")].sort()).toEqual(vercelCronCalls().map(key).sort())
  })

  it("covers every remediation the daily supervisor may fire", () => {
    const remediations = EXPECTED_TASKS.flatMap((t) => (t.remediation ? [t.remediation] : []))
    expect(remediations.length).toBeGreaterThan(5)
    for (const r of remediations) {
      const pathname = new URL(r.path, "https://x").pathname
      expect(isCronJobRoute(r.method, pathname), `${r.method} ${pathname}`).toBe(true)
    }
  })

  it("keeps the operator-script entry tied to the script that uses it", () => {
    const scriptRoutes = CRON_JOB_ROUTES.filter((r) => r.calledBy === "scripts/enrich-loop")
    expect(scriptRoutes.map(key)).toEqual(["GET /api/admin/enrich"])
    for (const file of ["scripts/enrich-loop.sh", "scripts/enrich-loop.ps1"]) {
      expect(readFileSync(path.join(ROOT, file), "utf8")).toContain("/api/admin/enrich")
    }
  })

  it("holds no duplicate and only API paths", () => {
    const keys = CRON_JOB_ROUTES.map(key)
    expect(new Set(keys).size).toBe(keys.length)
    for (const r of CRON_JOB_ROUTES) expect(r.path).toMatch(/^\/api\/(cron|admin)\/[a-z0-9/-]+$/)
  })
})
