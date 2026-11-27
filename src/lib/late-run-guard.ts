/**
 * « Late scheduled run » guard (Nov 2026).
 *
 * GitHub has been starting the scheduled runs 7–12 h late every day since
 * 10 Nov. The Vercel heartbeat re-dispatches the jobs it finds missed at
 * 08:00; when the late scheduled run finally arrives, it would do the same
 * work a second time (and double the daily enrichment spend).
 *
 * Mechanism, in cron.yml: a `late-guard` job runs ONLY on `schedule` events,
 * calls `GET /api/cron/already-ran?schedule=<cron string>` (read-only) and
 * exposes the list of dispatch tasks to skip; each allow-listed job's `if:`
 * drops its schedule branch when its task is in that list. Manual dispatches
 * (`workflow_dispatch`, the heartbeat's included) never consult the guard.
 * The guard fails OPEN: no answer / bad JSON → nothing skipped (a double run
 * is safe for these jobs, a missing run is not).
 *
 * A skipped run writes NOTHING to cron_logs — the guard's own GitHub log is
 * the trace — so neither the supervisor nor the heartbeat can mistake a skip
 * for a run.
 *
 * Only for DISPATCH_ALLOW_LIST tasks: they are the only ones the heartbeat
 * re-dispatches, hence the only ones a late scheduled run can duplicate.
 */

import { DISPATCH_ALLOW_LIST } from "@/lib/heartbeat-dispatch"
import { HEARTBEAT_JOBS, type HeartbeatJob, mostRecentDueFire } from "@/lib/heartbeat-schedule"

/** cron_logs statuses that count as « this slot's work is done ». */
export const RAN_STATUSES = ["success", "partial"] as const

export type LateRunCheck = {
  task: string
  dispatchTask: string
  /** The most recent scheduled slot of this cron at `now` (no grace). */
  slot: string
  lastRunAt: string | null
  skip: boolean
}

/** The allow-listed jobs a given `github.event.schedule` string starts. */
export function guardedJobsFor(schedule: string, jobs: HeartbeatJob[] = HEARTBEAT_JOBS): HeartbeatJob[] {
  const wanted = schedule.trim()
  return jobs.filter((j) => j.cron === wanted && j.dispatchTask in DISPATCH_ALLOW_LIST)
}

/**
 * Skip a job when its task already logged a success/partial run since the
 * most recent slot of this schedule — i.e. someone (the heartbeat's
 * re-dispatch, an admin) already did this slot's work.
 * `lastOkRunByTask` = latest success/partial cron_logs row per task.
 */
export function decideLateRuns(params: {
  schedule: string
  now: Date
  lastOkRunByTask: Map<string, Date>
  jobs?: HeartbeatJob[]
}): LateRunCheck[] {
  const { schedule, now, lastOkRunByTask, jobs } = params
  const out: LateRunCheck[] = []
  for (const job of guardedJobsFor(schedule, jobs)) {
    const slot = mostRecentDueFire(job.cron, now, 0)
    if (!slot) continue
    const last = lastOkRunByTask.get(job.task) ?? null
    out.push({
      task: job.task,
      dispatchTask: job.dispatchTask,
      slot: slot.toISOString(),
      lastRunAt: last ? last.toISOString() : null,
      skip: last !== null && last.getTime() >= slot.getTime(),
    })
  }
  return out
}
