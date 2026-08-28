import { describe, it, expect } from "vitest"
import { detectIssues, EXPECTED_TASKS, type ExpectedTask, type RecentLog } from "@/lib/cron-supervisor"

/** Date `hours` before now. */
function hoursAgo(hours: number): Date {
  return new Date(Date.now() - hours * 3_600_000)
}

/** Minimal expected-task entry — only what detectIssues reads. */
function taskWith(overrides: Partial<ExpectedTask> = {}): ExpectedTask {
  return { task: "test-task", staleAfterHours: 36, ...overrides }
}

function successLog(hours: number, task = "test-task"): RecentLog {
  return { task, status: "success", summary: "ok", createdAt: hoursAgo(hours) }
}

describe("detectIssues — never-ran tasks (missing)", () => {
  it("flags a task with zero logs and no activatedAt immediately (historical behaviour)", () => {
    const issues = detectIssues([], [taskWith()])
    expect(issues).toHaveLength(1)
    expect(issues[0].status).toBe("missing")
  })

  it("does NOT flag a freshly activated task still inside its staleness window", () => {
    // The game-guides-check case: registered 2026-08-19 but first scheduled
    // fire 2026-09-01 — zero cron_logs is the normal state for that whole gap.
    const task = taskWith({ staleAfterHours: 800, activatedAt: hoursAgo(200).toISOString() })
    expect(detectIssues([], [task])).toHaveLength(0)
  })

  it("flags missing once staleAfterHours have elapsed since activation", () => {
    const task = taskWith({ staleAfterHours: 800, activatedAt: hoursAgo(801).toISOString() })
    const issues = detectIssues([], [task])
    expect(issues).toHaveLength(1)
    expect(issues[0].status).toBe("missing")
  })

  it("fails loud (flags missing) on an invalid activatedAt", () => {
    const issues = detectIssues([], [taskWith({ activatedAt: "not-a-date" })])
    expect(issues).toHaveLength(1)
    expect(issues[0].status).toBe("missing")
  })

  it("ignores activatedAt as soon as the task has logged at least once", () => {
    const task = taskWith({ activatedAt: hoursAgo(1).toISOString() })
    // Recent run → no issue at all.
    expect(detectIssues([successLog(2)], [task])).toHaveLength(0)
    // Lapsed run → "stale", not masked by a recent activation date.
    const stale = detectIssues([successLog(40)], [task])
    expect(stale).toHaveLength(1)
    expect(stale[0].status).toBe("stale")
  })
})

describe("EXPECTED_TASKS config", () => {
  it("every activatedAt parses as a valid date", () => {
    // A typo'd date would hit the fail-loud NaN path and alarm daily —
    // exactly the false alarm activatedAt exists to prevent.
    for (const task of EXPECTED_TASKS) {
      if (task.activatedAt === undefined) continue
      expect(Number.isFinite(new Date(task.activatedAt).getTime()), `${task.task}: "${task.activatedAt}"`).toBe(true)
    }
  })
})
