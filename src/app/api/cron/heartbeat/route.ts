import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { isCronOrAdminAuthorized } from "@/lib/cron-auth"
import { logCronRun } from "@/lib/cron-log"
import { EXPECTED_TASKS } from "@/lib/cron-supervisor"
import {
  HEARTBEAT_GRACE_MINUTES,
  HEARTBEAT_JOBS,
  cadenceOf,
  describeMissed,
  findMissedTasks,
  isUrgentCadence,
} from "@/lib/heartbeat-schedule"
import {
  DISPATCH_DEDUP_HOURS,
  type DispatchPlan,
  type DispatchResult,
  describeDispatch,
  dispatchGate,
  dispatchWorkflows,
  planDispatch,
  recentlyDispatched,
} from "@/lib/heartbeat-dispatch"

export const maxDuration = 30
export const dynamic = "force-dynamic"

/**
 * Watchdog for the GitHub Actions cron pipeline — runs from **Vercel Cron**
 * (daily 08:00 UTC, the only Vercel cron), so it stays alive when GitHub
 * Actions doesn't, and the supervisor with it.
 *
 * 1. For every job of `HEARTBEAT_JOBS` (src/lib/heartbeat-schedule.ts, pinned
 *    to cron.yml by a test) it finds the most recent scheduled fire that
 *    should have logged by now and checks cron_logs for a row since then.
 *    Every missed job is named in the summary (« Pas encore passés
 *    aujourd'hui : import (prévu 03:07), enrich (04:11) »).
 * 2. It re-dispatches the missed allow-listed jobs through GitHub's
 *    workflow_dispatch (src/lib/heartbeat-dispatch.ts — allow-list, cap 6,
 *    20 h dedup, kill switch HEARTBEAT_AUTODISPATCH, GITHUB_DISPATCH_TOKEN).
 *    The late scheduled run that may still arrive is skipped by cron.yml's
 *    `late-guard` job (src/lib/late-run-guard.ts).
 * 3. Status: "error" (failure email) when the pipeline is down, a dispatch
 *    failed, or a missed DAILY job was not re-dispatched now; "partial" when
 *    every missed daily job was re-dispatched (« relancés »), or only weekly /
 *    every-2-days / monthly ones were missed; "success" otherwise.
 *
 * Note: the enrich and release-status rows can also come from the
 * supervisor's remediations or an admin click; such a row counts as « ran ».
 */

// When none of the daily jobs logged in this window, GitHub Actions itself is
// down (« job was not acquired by Runner »): the original alarm, kept as is.
const PIPELINE_DOWN_HOURS = 30
// Covers the monthly job's last fire (≤ 31 days) plus slack.
const LOOKBACK_DAYS = 33

export async function GET(req: NextRequest) {
  // Vercel Cron sends `Authorization: Bearer ${CRON_SECRET}` automatically
  // when CRON_SECRET is set in the project env, so this is the same gate
  // as every other cron route.
  if (!(await isCronOrAdminAuthorized(req))) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  const startTime = Date.now()
  const now = new Date(startTime)
  try {
    const tasks = [...new Set(HEARTBEAT_JOBS.map((j) => j.task))]
    const [lastRuns, previousHeartbeats] = await Promise.all([
      prisma.cronLog.groupBy({
        by: ["task"],
        where: { task: { in: tasks }, createdAt: { gte: new Date(startTime - LOOKBACK_DAYS * 86_400_000) } },
        _max: { createdAt: true },
      }),
      prisma.cronLog.findMany({
        where: { task: "heartbeat", createdAt: { gte: new Date(startTime - DISPATCH_DEDUP_HOURS * 3_600_000) } },
        select: { createdAt: true, details: true },
      }),
    ])

    const lastRunByTask = new Map<string, Date>()
    for (const row of lastRuns) if (row._max.createdAt) lastRunByTask.set(row.task, row._max.createdAt)
    const activatedAtByTask = new Map<string, string>()
    for (const t of EXPECTED_TASKS) if (t.activatedAt) activatedAtByTask.set(t.task, t.activatedAt)

    const missed = findMissedTasks({ now, lastRunByTask, activatedAtByTask })
    const urgent = missed.filter((m) => m.urgent)

    const dailyTasks = HEARTBEAT_JOBS.filter((j) => isUrgentCadence(cadenceOf(j.cron))).map((j) => j.task)
    const downSince = startTime - PIPELINE_DOWN_HOURS * 3_600_000
    const seenDaily = dailyTasks.filter((t) => (lastRunByTask.get(t)?.getTime() ?? 0) >= downSince)
    const pipelineDown = seenDaily.length === 0

    // ── Re-dispatch ──
    const gate = dispatchGate({
      autodispatch: process.env.HEARTBEAT_AUTODISPATCH,
      token: process.env.GITHUB_DISPATCH_TOKEN,
      vercelEnv: process.env.VERCEL_ENV,
    })
    let plan: DispatchPlan = { toDispatch: [], skipped: [] }
    let dispatched: DispatchResult[] = []
    if (missed.length > 0) {
      plan = planDispatch({ missed, now, alreadyDispatched: recentlyDispatched(previousHeartbeats, now) })
      if (gate.enabled && plan.toDispatch.length > 0) {
        dispatched = await dispatchWorkflows(plan.toDispatch, { token: process.env.GITHUB_DISPATCH_TOKEN!.trim() })
      }
    }
    const dispatchText = describeDispatch({
      gateReason: gate.enabled ? undefined : gate.reason,
      results: dispatched,
      skipped: plan.skipped,
    })

    const head = pipelineDown
      ? `Pipeline GitHub Actions HORS SERVICE — aucun job quotidien (${dailyTasks.join(", ")}) depuis ${PIPELINE_DOWN_HOURS}h. Vérifier https://github.com/MixMasterFei/le-bon-avis-numerique/actions`
      : missed.length > 0
        ? describeMissed(missed, now)
        : `OK — les ${HEARTBEAT_JOBS.length} tâches GitHub attendues sont passées depuis leur dernier horaire prévu`
    // A missed daily job is only an emergency if it wasn't handled: when this
    // run re-dispatched it successfully, « relancés » is a partial, not a
    // morning failure email. Still "error": pipeline down, any failed
    // dispatch, or a daily job left un-dispatched (no token, kill switch,
    // cap, or already re-dispatched < 20 h ago and STILL missing).
    const relaunched = new Set(dispatched.filter((d) => d.ok).map((d) => d.task))
    const dispatchFailed = dispatched.some((d) => !d.ok)
    const urgentUnhandled = urgent.filter((m) => !relaunched.has(m.dispatchTask))
    const status =
      pipelineDown || dispatchFailed || urgentUnhandled.length > 0 ? "error" : missed.length > 0 ? "partial" : "success"

    // status === "error" → logCronRun sends sendCronFailureAlert. (If
    // CRON_ALERT_MODE=digest the immediate mail is suppressed in favour of the
    // supervisor digest — but this route exists for when the supervisor isn't
    // running, so digest mode should not be enabled in production.)
    await logCronRun({
      task: "heartbeat",
      status,
      summary: dispatchText ? `${head} · ${dispatchText}` : head,
      details: {
        missing: missed.map((m) => m.task),
        missed: missed.map((m) => ({
          task: m.task,
          dispatchTask: m.dispatchTask,
          cadence: m.cadence,
          scheduledAt: m.scheduledAt.toISOString(),
        })),
        pipelineDown,
        seenDaily,
        dispatched,
        dispatchFailures: dispatched.filter((d) => !d.ok),
        dispatchSkipped: plan.skipped,
        autodispatch: gate.enabled ? "on" : gate.reason,
        graceMinutes: HEARTBEAT_GRACE_MINUTES,
      },
      startTime,
    })

    return NextResponse.json({
      ok: status !== "error",
      status,
      missing: missed.map((m) => m.task),
      dispatched,
    })
  } catch (error) {
    const msg = error instanceof Error ? error.message : "heartbeat failed"
    console.error("[cron-heartbeat] failed:", error)
    await logCronRun({ task: "heartbeat", status: "error", summary: msg, startTime })
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}
