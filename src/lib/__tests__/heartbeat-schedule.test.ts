// @vitest-environment node
import { readFileSync } from "node:fs"
import path from "node:path"
import { describe, expect, it } from "vitest"
import {
  HEARTBEAT_JOBS,
  cadenceOf,
  describeMissed,
  findMissedTasks,
  fireLabel,
  mostRecentDueFire,
  parseCron,
} from "@/lib/heartbeat-schedule"

const at = (iso: string) => new Date(iso)
const ROOT = path.resolve(__dirname, "../../..")
const CRON_YML = readFileSync(path.join(ROOT, ".github/workflows/cron.yml"), "utf8")

/** Every job has logged just now, except those listed. */
function allRanExcept(now: Date, ...missing: string[]) {
  const map = new Map<string, Date>()
  for (const j of HEARTBEAT_JOBS) if (!missing.includes(j.task)) map.set(j.task, now)
  return map
}

describe("parseCron / cadenceOf", () => {
  it("reads every form cron.yml uses", () => {
    expect(parseCron("17 0,6,12,18 * * *")).toMatchObject({ minute: 17, hours: [0, 6, 12, 18], dom: null, dow: null })
    expect(parseCron("41 5 */2 * *").dom).toEqual([1, 3, 5, 7, 9, 11, 13, 15, 17, 19, 21, 23, 25, 27, 29, 31])
    expect(cadenceOf("7 3 * * *")).toBe("daily")
    expect(cadenceOf("17 0,6,12,18 * * *")).toBe("multi-daily")
    expect(cadenceOf("41 5 */2 * *")).toBe("every-2-days")
    expect(cadenceOf("37 6 * * 1")).toBe("weekly")
    expect(cadenceOf("27 5 * * 2,5")).toBe("weekly")
    expect(cadenceOf("33 6 1 * *")).toBe("monthly")
  })

  it("refuses forms it does not understand rather than guessing", () => {
    expect(() => parseCron("0 8 * 1 *")).toThrow()
    expect(() => parseCron("0-5 8 * * *")).toThrow()
    expect(() => parseCron("7 3 * *")).toThrow()
  })
})

describe("mostRecentDueFire", () => {
  it("daily: today's fire once the grace has passed, else yesterday's", () => {
    expect(mostRecentDueFire("7 3 * * *", at("2026-11-23T08:00:00Z"))).toEqual(at("2026-11-23T03:07:00Z"))
    expect(mostRecentDueFire("7 3 * * *", at("2026-11-23T03:30:00Z"))).toEqual(at("2026-11-22T03:07:00Z"))
    // The 07:47 supervisor is not due at 08:00 (60 min grace): yesterday's fire.
    expect(mostRecentDueFire("47 7 * * *", at("2026-11-23T08:00:00Z"))).toEqual(at("2026-11-22T07:47:00Z"))
  })

  it("multi-daily: the latest slot of the day", () => {
    expect(mostRecentDueFire("17 0,6,12,18 * * *", at("2026-11-23T08:00:00Z"))).toEqual(at("2026-11-23T06:17:00Z"))
    expect(mostRecentDueFire("17 0,6,12,18 * * *", at("2026-11-23T00:30:00Z"))).toEqual(at("2026-11-22T18:17:00Z"))
  })

  it("every 2 days = odd days of the month, including 31 → 1", () => {
    // 23 is odd: today's fire.
    expect(mostRecentDueFire("41 5 */2 * *", at("2026-11-23T08:00:00Z"))).toEqual(at("2026-11-23T05:41:00Z"))
    // 24 is even: yesterday's.
    expect(mostRecentDueFire("41 5 */2 * *", at("2026-11-24T08:00:00Z"))).toEqual(at("2026-11-23T05:41:00Z"))
    // 31 Oct and 1 Nov are both odd: two fires in a row.
    expect(mostRecentDueFire("41 5 */2 * *", at("2026-11-01T08:00:00Z"))).toEqual(at("2026-11-01T05:41:00Z"))
    // 30 Nov (even) → 29 Nov.
    expect(mostRecentDueFire("41 5 */2 * *", at("2026-11-30T08:00:00Z"))).toEqual(at("2026-11-29T05:41:00Z"))
  })

  it("weekly Monday and the 1st of the month", () => {
    // 2026-11-23 is a Monday; Tuesday 24 still points at Monday's fire.
    expect(mostRecentDueFire("53 6 * * 1", at("2026-11-23T08:00:00Z"))).toEqual(at("2026-11-23T06:53:00Z"))
    expect(mostRecentDueFire("53 6 * * 1", at("2026-11-24T08:00:00Z"))).toEqual(at("2026-11-23T06:53:00Z"))
    expect(mostRecentDueFire("53 6 * * 1", at("2026-11-22T08:00:00Z"))).toEqual(at("2026-11-16T06:53:00Z"))
    expect(mostRecentDueFire("33 6 1 * *", at("2026-11-27T08:00:00Z"))).toEqual(at("2026-11-01T06:33:00Z"))
    expect(mostRecentDueFire("33 6 1 * *", at("2026-12-01T08:00:00Z"))).toEqual(at("2026-12-01T06:33:00Z"))
  })
})

describe("findMissedTasks", () => {
  it("nothing missed when every job logged after its fire", () => {
    const now = at("2026-11-25T08:00:00Z")
    expect(findMissedTasks({ now, lastRunByTask: allRanExcept(now) })).toEqual([])
  })

  it("a row BEFORE the most recent fire is a miss (the 22–23 Nov blind spot)", () => {
    const now = at("2026-11-23T08:00:00Z")
    const runs = allRanExcept(now, "import", "enrich")
    runs.set("import", at("2026-11-22T11:05:21Z")) // Sunday's late run, inside the old 30 h window
    runs.set("enrich", at("2026-11-22T12:31:51Z"))
    const missed = findMissedTasks({ now, lastRunByTask: runs })
    expect(missed.map((m) => m.task)).toEqual(["import", "enrich"])
    expect(missed.every((m) => m.urgent)).toBe(true)
    expect(missed[0]).toMatchObject({ dispatchTask: "import", cadence: "daily", scheduledAt: at("2026-11-23T03:07:00Z") })
  })

  it("maps cron_logs tasks to cron.yml dispatch names", () => {
    const now = at("2026-11-23T08:00:00Z")
    const missed = findMissedTasks({ now, lastRunByTask: new Map() })
    const byTask = Object.fromEntries(missed.map((m) => [m.task, m.dispatchTask]))
    expect(byTask).toMatchObject({
      import: "import",
      "release-status": "release-status",
      enrich: "enrich",
      "news-discover": "news-discover",
      "cron-supervisor": "supervisor",
      "homepage-watch": "homepage-watch",
      "family-content-agent": "family-content-agent",
      "games-top-names": "games-top-names",
    })
  })

  it("odd-day job: missed on its day, not expected again the even day after it ran", () => {
    const odd = at("2026-11-25T08:00:00Z")
    expect(findMissedTasks({ now: odd, lastRunByTask: allRanExcept(odd, "homepage-watch") }).map((m) => m.task)).toEqual([
      "homepage-watch",
    ])
    const even = at("2026-11-26T08:00:00Z")
    const runs = allRanExcept(even, "homepage-watch")
    runs.set("homepage-watch", at("2026-11-25T06:00:00Z"))
    expect(findMissedTasks({ now: even, lastRunByTask: runs })).toEqual([])
  })

  it("only daily-or-more-frequent misses are urgent", () => {
    const now = at("2026-11-23T08:00:00Z")
    const missed = findMissedTasks({
      now,
      lastRunByTask: allRanExcept(now, "news-discover", "homepage-watch", "games-top-names", "game-guides-check"),
    })
    expect(Object.fromEntries(missed.map((m) => [m.task, m.urgent]))).toEqual({
      "news-discover": true,
      "homepage-watch": false,
      "games-top-names": false,
      "game-guides-check": false,
    })
  })

  it("honours activatedAt: a fire before activation is not expected", () => {
    const now = at("2026-11-21T08:00:00Z") // homepage-watch's 21 Nov 05:41 fire
    const lastRunByTask = allRanExcept(now, "homepage-watch")
    expect(
      findMissedTasks({ now, lastRunByTask, activatedAtByTask: new Map([["homepage-watch", "2026-11-22"]]) }),
    ).toEqual([])
    expect(
      findMissedTasks({ now, lastRunByTask, activatedAtByTask: new Map([["homepage-watch", "2026-11-21"]]) }).map(
        (m) => m.task,
      ),
    ).toEqual(["homepage-watch"])
    // The entry's own activatedAt wins (jobs absent from EXPECTED_TASKS).
    const jobs = [{ task: "x", dispatchTask: "x", cron: "7 3 * * *", activatedAt: "2026-11-30" }]
    expect(findMissedTasks({ now, lastRunByTask: new Map(), jobs })).toEqual([])
  })
})

describe("wording", () => {
  it("names each missed job in plain French", () => {
    const now = at("2026-11-23T08:00:00Z")
    const missed = findMissedTasks({ now, lastRunByTask: allRanExcept(now, "import", "enrich") })
    expect(describeMissed(missed, now)).toBe("Pas encore passés aujourd'hui : import (prévu 03:07), enrich (04:11)")
  })

  it("dates a fire that is not today's", () => {
    const now = at("2026-11-23T08:00:00Z")
    expect(fireLabel(at("2026-11-22T07:47:00Z"), now)).toBe("hier 07:47")
    expect(fireLabel(at("2026-11-16T06:53:00Z"), now)).toBe("16/11 06:53")
    const missed = findMissedTasks({ now, lastRunByTask: allRanExcept(now, "import", "cron-supervisor") })
    expect(describeMissed(missed, now)).toBe("Pas encore passés : import (prévu 03:07), cron-supervisor (hier 07:47)")
  })
})

describe("HEARTBEAT_JOBS stays in step with cron.yml", () => {
  const scheduleLines = [...CRON_YML.matchAll(/^\s*- cron: "([^"]+)"/gm)].map((m) => m[1])
  const optionsBlock = /task:\s*\n\s*description:[^\n]*\n(?:\s*\w+:[^\n]*\n)*?\s*options:\s*\n((?:\s*- [\w-]+\s*\n)+)/.exec(
    CRON_YML,
  )
  const dispatchOptions = optionsBlock ? [...optionsBlock[1].matchAll(/- ([\w-]+)/g)].map((m) => m[1]) : []
  const jobsSection = CRON_YML.slice(CRON_YML.indexOf("\njobs:"))
  const jobBlocks = jobsSection.split(/\n {2}(?=[a-z0-9_-]+:\s*\n)/).slice(1)
  const jobIf = (block: string) => /\n {4}if:([\s\S]*?)\n {4}steps:/.exec(block)?.[1] ?? ""

  it("parses the workflow", () => {
    expect(scheduleLines.length).toBeGreaterThan(5)
    expect(dispatchOptions).toContain("import")
    expect(jobBlocks.length).toBeGreaterThan(5)
  })

  it.each(HEARTBEAT_JOBS.map((j) => [j.task, j] as const))("%s", (_task, job) => {
    expect(() => parseCron(job.cron)).not.toThrow()
    expect(scheduleLines).toContain(job.cron)
    expect(dispatchOptions).toContain(job.dispatchTask)
    // One job's `if:` runs on BOTH this schedule and this dispatch task.
    const paired = jobBlocks.some((b) => {
      const cond = jobIf(b)
      return cond.includes(`github.event.schedule == '${job.cron}'`) && cond.includes(`github.event.inputs.task == '${job.dispatchTask}'`)
    })
    expect(paired).toBe(true)
  })

  it("every scheduled cron.yml slot is watched", () => {
    const watched = new Set(HEARTBEAT_JOBS.map((j) => j.cron))
    expect(scheduleLines.filter((c) => !watched.has(c))).toEqual([])
  })
})
