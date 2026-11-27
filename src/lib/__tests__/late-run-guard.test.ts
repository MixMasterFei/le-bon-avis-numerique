// @vitest-environment node
import { readFileSync } from "node:fs"
import path from "node:path"
import { describe, expect, it } from "vitest"
import { DISPATCH_ALLOW_LIST } from "@/lib/heartbeat-dispatch"
import { HEARTBEAT_JOBS } from "@/lib/heartbeat-schedule"
import { decideLateRuns, guardedJobsFor } from "@/lib/late-run-guard"

const at = (iso: string) => new Date(iso)
const runs = (entries: Record<string, string>) => new Map(Object.entries(entries).map(([k, v]) => [k, at(v)]))
const decide = (schedule: string, now: string, last: Record<string, string> = {}) =>
  decideLateRuns({ schedule, now: at(now), lastOkRunByTask: runs(last) })
const skipOf = (checks: ReturnType<typeof decide>) => Object.fromEntries(checks.map((c) => [c.dispatchTask, c.skip]))

describe("decideLateRuns", () => {
  it("daily: a late scheduled run after the heartbeat's re-dispatch skips", () => {
    // 03:07 slot; heartbeat re-dispatched import at 08:00, it logged 08:06;
    // GitHub's scheduled run finally starts at 11:05.
    const checks = decide("7 3 * * *", "2026-11-23T11:05:00Z", { import: "2026-11-23T08:06:00Z" })
    expect(skipOf(checks)).toEqual({ import: true, "release-status": false })
    expect(checks[0]).toMatchObject({ slot: "2026-11-23T03:07:00.000Z", lastRunAt: "2026-11-23T08:06:00.000Z" })
  })

  it("daily: a scheduled run with no run since its slot proceeds (on time or late)", () => {
    expect(skipOf(decide("11 4 * * *", "2026-11-23T04:12:00Z", { enrich: "2026-11-22T12:31:00Z" }))).toEqual({ enrich: false })
    expect(skipOf(decide("11 4 * * *", "2026-11-23T14:30:00Z", { enrich: "2026-11-22T12:31:00Z" }))).toEqual({ enrich: false })
    expect(skipOf(decide("11 4 * * *", "2026-11-23T14:30:00Z"))).toEqual({ enrich: false })
  })

  it("multi-daily: judged against the most recent slot, not the one it was meant for", () => {
    // 00:17 run arriving at 07:20: the 06:17 slot is the latest; a run at 06:30 covers it.
    expect(skipOf(decide("17 0,6,12,18 * * *", "2026-11-23T07:20:00Z", { "news-discover": "2026-11-23T06:30:00Z" }))).toEqual({
      "news-discover": true,
    })
    // A run at 05:00 belongs to the 00:17 slot: the 06:17 work is still to do.
    expect(skipOf(decide("17 0,6,12,18 * * *", "2026-11-23T07:20:00Z", { "news-discover": "2026-11-23T05:00:00Z" }))).toEqual({
      "news-discover": false,
    })
  })

  it("supervisor: today's 07:47 slot is covered by the heartbeat's 08:00 dispatch", () => {
    expect(skipOf(decide("47 7 * * *", "2026-11-23T15:40:00Z", { "cron-supervisor": "2026-11-23T08:04:00Z" }))).toEqual({
      supervisor: true,
    })
    expect(skipOf(decide("47 7 * * *", "2026-11-23T15:40:00Z", { "cron-supervisor": "2026-11-23T07:00:00Z" }))).toEqual({
      supervisor: false,
    })
  })

  it("every 2 days (odd days)", () => {
    expect(skipOf(decide("41 5 */2 * *", "2026-11-23T16:28:00Z", { "homepage-watch": "2026-11-23T08:05:00Z" }))).toEqual({
      "homepage-watch": true,
    })
    // Last run was the previous odd day's slot.
    expect(skipOf(decide("41 5 */2 * *", "2026-11-23T16:28:00Z", { "homepage-watch": "2026-11-21T09:00:00Z" }))).toEqual({
      "homepage-watch": false,
    })
  })

  it("weekly Monday jobs and the same-day weekly reports", () => {
    expect(
      skipOf(decide("37 6 * * 1", "2026-11-23T18:40:00Z", { "family-content-agent": "2026-11-23T08:05:00Z" })),
    ).toEqual({ "family-content-agent": true })
    expect(skipOf(decide("53 6 * * 1", "2026-11-23T18:47:00Z", { "games-top-names": "2026-11-16T16:30:00Z" }))).toEqual({
      "games-top-names": false,
    })
    expect(skipOf(decide("13 6 * * 3", "2026-11-25T15:40:00Z", { "debt-digest": "2026-11-25T08:03:00Z" }))).toEqual({
      "debt-digest": true,
    })
    expect(skipOf(decide("23 6 * * 4", "2026-11-26T15:54:00Z", { "seo-striking-distance": "2026-11-19T15:54:00Z" }))).toEqual({
      "seo-striking-distance": false,
    })
  })

  it("leaves non-allow-listed jobs alone (never guarded)", () => {
    for (const schedule of ["51 5 * * 0", "43 6 * * 0", "19 5 * * 6", "27 5 * * 2,5", "33 6 1 * *", "0 0 * * *"]) {
      expect(decide(schedule, "2026-11-29T20:00:00Z", { "totem-eval": "2026-11-29T19:00:00Z" })).toEqual([])
    }
  })

  it("guards exactly the allow-listed jobs", () => {
    const guarded = new Set(HEARTBEAT_JOBS.flatMap((j) => guardedJobsFor(j.cron)).map((j) => j.dispatchTask))
    expect([...guarded].sort()).toEqual(Object.keys(DISPATCH_ALLOW_LIST).sort())
  })
})

describe("cron.yml wiring of the late-run guard", () => {
  const ROOT = path.resolve(__dirname, "../../..")
  const yml = readFileSync(path.join(ROOT, ".github/workflows/cron.yml"), "utf8")
  const jobsSection = yml.slice(yml.indexOf("\njobs:"))
  const blocks = jobsSection.split(/\n {2}(?=[a-z0-9_-]+:\s*\n)/).slice(1)
  const header = (b: string) => b.slice(0, b.indexOf("\n    steps:"))
  const ifOf = (b: string) => /\n {4}if:([\s\S]*?)(?=\n {4}[a-z-]+:|$)/.exec(header(b))?.[1].replace(/\s+/g, " ").trim() ?? ""

  it("the guard job runs on schedule events only and calls the read-only endpoint", () => {
    const guard = blocks.find((b) => b.startsWith("late-guard:"))
    expect(guard).toBeDefined()
    expect(ifOf(guard!)).toBe("github.event_name == 'schedule'")
    expect(guard).toContain("$SITE_URL/api/cron/already-ran")
    expect(guard).toContain("--data-urlencode \"schedule=$SCHEDULE\"")
  })

  it.each(Object.keys(DISPATCH_ALLOW_LIST))("%s: the schedule branch honours the guard, manual dispatch never does", (task) => {
    const job = HEARTBEAT_JOBS.find((j) => j.dispatchTask === task)!
    const block = blocks.find((b) => ifOf(b).includes(`github.event.schedule == '${job.cron}'`) && ifOf(b).includes(`'${task}'`))
    expect(block, task).toBeDefined()
    const cond = ifOf(block!)
    expect(header(block!)).toContain("\n    needs: late-guard")
    expect(cond).toContain(
      `(github.event.schedule == '${job.cron}' && !contains(fromJSON(needs.late-guard.outputs.skip || '[]'), '${task}'))`,
    )
    // Manual branch untouched: `inputs.task == '<task>' ||` is not ANDed with the guard.
    expect(cond).toMatch(new RegExp(`\\|\\| github\\.event\\.inputs\\.task == '${task}'( \\|\\||\\))`))
    // A status function keeps the job alive when the guard is skipped (dispatch) or fails (fail open).
    expect(cond.endsWith("&& !cancelled()")).toBe(true)
  })

  it("non-allow-listed jobs don't depend on the guard", () => {
    for (const b of blocks) {
      if (!header(b).includes("needs: late-guard")) continue
      const name = b.slice(0, b.indexOf(":"))
      expect(["monday", "release-status", "games-top-names", "daily-enrich", "daily-news-discover", "family-content-agent", "supervisor", "debt-digest", "seo-striking-distance", "homepage-watch"]).toContain(name)
    }
  })
})
