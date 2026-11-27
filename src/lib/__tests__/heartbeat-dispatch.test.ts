// @vitest-environment node
import { describe, expect, it, vi } from "vitest"
import {
  DISPATCH_ALLOW_LIST,
  MAX_DISPATCH_PER_RUN,
  describeDispatch,
  dispatchGate,
  dispatchWorkflows,
  planDispatch,
  recentlyDispatched,
  redactSecret,
} from "@/lib/heartbeat-dispatch"
import { HEARTBEAT_JOBS, type MissedTask } from "@/lib/heartbeat-schedule"

const NOW = new Date("2026-11-23T08:00:00Z") // Monday
const TOKEN = "github_pat_TEST_ONLY_0123456789abcdef"

function miss(dispatchTask: string, scheduledAt = "2026-11-23T03:07:00Z", task = dispatchTask): MissedTask {
  return { task, dispatchTask, cadence: "daily", scheduledAt: new Date(scheduledAt), urgent: true }
}

describe("dispatchGate", () => {
  it("is on with a token in production", () => {
    expect(dispatchGate({ token: TOKEN, vercelEnv: "production" })).toEqual({ enabled: true })
    expect(dispatchGate({ token: TOKEN, vercelEnv: "production", autodispatch: "true" })).toEqual({ enabled: true })
  })

  it("kill switch HEARTBEAT_AUTODISPATCH=false", () => {
    expect(dispatchGate({ token: TOKEN, vercelEnv: "production", autodispatch: "false" })).toEqual({
      enabled: false,
      reason: "relance automatique désactivée (HEARTBEAT_AUTODISPATCH=false)",
    })
    expect(dispatchGate({ token: TOKEN, vercelEnv: "production", autodispatch: " FALSE " }).enabled).toBe(false)
  })

  it("missing or blank token", () => {
    for (const token of [undefined, "", "   "]) {
      expect(dispatchGate({ token, vercelEnv: "production" })).toEqual({
        enabled: false,
        reason: "relance automatique désactivée (GITHUB_DISPATCH_TOKEN absent)",
      })
    }
  })

  it("never outside production", () => {
    expect(dispatchGate({ token: TOKEN, vercelEnv: "preview" }).enabled).toBe(false)
    expect(dispatchGate({ token: TOKEN }).enabled).toBe(false)
  })
})

describe("allow-list", () => {
  it("is exactly the approved list", () => {
    expect(Object.keys(DISPATCH_ALLOW_LIST).sort()).toEqual(
      [
        "debt-digest",
        "enrich",
        "family-content-agent",
        "games-top-names",
        "homepage-watch",
        "import",
        "news-discover",
        "release-status",
        "seo-striking-distance",
        "supervisor",
      ].sort(),
    )
    expect(DISPATCH_ALLOW_LIST["seo-striking-distance"]).toBe("same-day")
    expect(DISPATCH_ALLOW_LIST["debt-digest"]).toBe("same-day")
  })

  it("every allow-listed task is one the heartbeat watches", () => {
    const watched = new Set(HEARTBEAT_JOBS.map((j) => j.dispatchTask))
    for (const task of Object.keys(DISPATCH_ALLOW_LIST)) expect(watched).toContain(task)
  })
})

describe("planDispatch", () => {
  const none = new Set<string>()

  it("dispatches allow-listed misses", () => {
    const plan = planDispatch({ missed: [miss("import"), miss("enrich")], now: NOW, alreadyDispatched: none })
    expect(plan).toEqual({ toDispatch: ["import", "enrich"], skipped: [] })
  })

  it("never totem-eval, game-facts or an unlisted task", () => {
    const plan = planDispatch({
      missed: [miss("totem-eval"), miss("game-facts"), miss("weekly-dossier"), miss("backfill-ratings"), miss("import")],
      now: NOW,
      alreadyDispatched: none,
    })
    expect(plan.toDispatch).toEqual(["import"])
    expect(plan.skipped.map((s) => [s.dispatchTask, s.reason])).toEqual([
      ["totem-eval", "not-allowed"],
      ["game-facts", "not-allowed"],
      ["weekly-dossier", "not-allowed"],
      ["backfill-ratings", "not-allowed"],
    ])
  })

  it("seo-striking-distance and debt-digest only on their own day", () => {
    const today = planDispatch({
      missed: [miss("debt-digest", "2026-11-23T06:13:00Z")],
      now: NOW,
      alreadyDispatched: none,
    })
    expect(today.toDispatch).toEqual(["debt-digest"])
    const later = planDispatch({
      missed: [miss("seo-striking-distance", "2026-11-19T06:23:00Z"), miss("debt-digest", "2026-11-18T06:13:00Z")],
      now: NOW,
      alreadyDispatched: none,
    })
    expect(later.toDispatch).toEqual([])
    expect(later.skipped.map((s) => s.reason)).toEqual(["not-today", "not-today"])
    // An any-day task detected late is still dispatched.
    expect(planDispatch({ missed: [miss("supervisor", "2026-11-22T07:47:00Z", "cron-supervisor")], now: NOW, alreadyDispatched: none }).toDispatch).toEqual(["supervisor"])
  })

  it("never the same task twice in 20 h", () => {
    const plan = planDispatch({ missed: [miss("import"), miss("enrich")], now: NOW, alreadyDispatched: new Set(["import"]) })
    expect(plan.toDispatch).toEqual(["enrich"])
    expect(plan.skipped).toEqual([{ task: "import", dispatchTask: "import", reason: "recently-dispatched" }])
  })

  it(`caps at ${MAX_DISPATCH_PER_RUN} per run, in schedule order`, () => {
    const all = Object.keys(DISPATCH_ALLOW_LIST).map((t) => miss(t, "2026-11-23T05:00:00Z"))
    const plan = planDispatch({ missed: all, now: NOW, alreadyDispatched: none })
    expect(plan.toDispatch).toHaveLength(MAX_DISPATCH_PER_RUN)
    expect(plan.toDispatch).toEqual(all.slice(0, MAX_DISPATCH_PER_RUN).map((m) => m.dispatchTask))
    expect(plan.skipped.every((s) => s.reason === "cap")).toBe(true)
    expect(plan.skipped).toHaveLength(all.length - MAX_DISPATCH_PER_RUN)
  })

  it("two probes of the same job dispatch it once", () => {
    const plan = planDispatch({
      missed: [miss("import", undefined, "import"), miss("import", undefined, "import-games")],
      now: NOW,
      alreadyDispatched: none,
    })
    expect(plan.toDispatch).toEqual(["import"])
  })
})

describe("recentlyDispatched", () => {
  it("reads the previous heartbeats' details.dispatched within 20 h", () => {
    const rows = [
      {
        createdAt: new Date("2026-11-22T20:00:00Z"),
        details: {
          dispatched: [
            { task: "import", ok: true, status: 204 },
            { task: "enrich", ok: false, status: 401, error: "Bad credentials" }, // refused: nothing started
            { task: "news-discover", ok: false, status: null, error: "TimeoutError" }, // may have started
          ],
        },
      },
      // Older than 20 h: ignored.
      { createdAt: new Date("2026-11-22T08:00:00Z"), details: { dispatched: [{ task: "homepage-watch", ok: true, status: 204 }] } },
      { createdAt: new Date("2026-11-23T07:00:00Z"), details: null },
      { createdAt: new Date("2026-11-23T07:00:00Z"), details: { dispatched: "garbage" } },
    ]
    expect([...recentlyDispatched(rows, NOW)].sort()).toEqual(["import", "news-discover"])
  })
})

describe("dispatchWorkflows", () => {
  it("POSTs one workflow_dispatch per task with the cron.yml inputs", async () => {
    const fetchImpl = vi.fn(async () => new Response(null, { status: 204 }))
    const results = await dispatchWorkflows(["import", "supervisor"], { token: TOKEN, fetchImpl: fetchImpl as typeof fetch })
    expect(results).toEqual([
      { task: "import", ok: true, status: 204 },
      { task: "supervisor", ok: true, status: 204 },
    ])
    expect(fetchImpl).toHaveBeenCalledTimes(2)
    const [url, init] = fetchImpl.mock.calls[0] as unknown as [string, RequestInit]
    expect(url).toBe("https://api.github.com/repos/MixMasterFei/le-bon-avis-numerique/actions/workflows/cron.yml/dispatches")
    expect(init.method).toBe("POST")
    expect(JSON.parse(init.body as string)).toEqual({ ref: "main", inputs: { task: "import", dry_run: "false" } })
    expect((init.headers as Record<string, string>).Authorization).toBe(`Bearer ${TOKEN}`)
    expect(init.signal).toBeInstanceOf(AbortSignal)
  })

  it("never throws, and redacts the token from every error", async () => {
    const fetchImpl = vi.fn(async (_url: string, init?: RequestInit) => {
      const body = JSON.parse(init!.body as string) as { inputs: { task: string } }
      if (body.inputs.task === "import") return new Response(JSON.stringify({ message: `Bad credentials ${TOKEN}` }), { status: 401 })
      throw new Error(`socket hang up (Authorization: Bearer ${TOKEN})`)
    })
    const results = await dispatchWorkflows(["import", "enrich"], { token: TOKEN, fetchImpl: fetchImpl as unknown as typeof fetch })
    expect(results[0]).toMatchObject({ task: "import", ok: false, status: 401 })
    expect(results[1]).toMatchObject({ task: "enrich", ok: false, status: null })
    expect(JSON.stringify(results)).not.toContain(TOKEN)
    expect(results[0].error).toContain("Bad credentials")
  })
})

describe("redactSecret / describeDispatch", () => {
  it("redacts and truncates", () => {
    expect(redactSecret(`a ${TOKEN} b ${TOKEN}`, TOKEN)).toBe("a *** b ***")
    expect(redactSecret("x".repeat(300), TOKEN)).toHaveLength(201)
  })

  it("says what was relaunched, refused and skipped", () => {
    const text = describeDispatch({
      results: [
        { task: "import", ok: true, status: 204 },
        { task: "enrich", ok: false, status: 403, error: "Resource not accessible" },
      ],
      skipped: [{ task: "totem-eval", dispatchTask: "totem-eval", reason: "not-allowed" }],
    })
    expect(text).toBe(
      "Relancés sur GitHub : import · Relance échouée : enrich (HTTP 403) · non relancés (hors liste autorisée) : totem-eval",
    )
    expect(describeDispatch({ gateReason: "relance automatique désactivée (GITHUB_DISPATCH_TOKEN absent)", results: [], skipped: [] })).toBe(
      "relance automatique désactivée (GITHUB_DISPATCH_TOKEN absent)",
    )
  })
})
