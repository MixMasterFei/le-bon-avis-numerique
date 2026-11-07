import { NextResponse, type NextRequest } from "next/server"
import { isCronOrAdminAuthorized } from "@/lib/cron-auth"
import { logCronRun } from "@/lib/cron-log"
import { withCronLock } from "@/lib/cron-lock"
import { checkSharedRateLimit } from "@/lib/auth-rate-limit"
import { DEFAULT_MODEL } from "@/lib/anthropic"
import { EVAL_CATEGORIES } from "@/lib/totem/eval/types"
import { EVAL_SCENARIOS, selectScenarios } from "@/lib/totem/eval/scenarios"
import { runEvalSuite } from "@/lib/totem/eval/runner"
import { buildEvalReport, estimateRunCostUsd } from "@/lib/totem/eval/report"

/**
 * POST /api/cron/totem-eval — the Totem evaluation bench.
 *
 * Runs ~50 scripted conversations (a fictional household: Léa 6, Hugo 10,
 * Inès 14) through the REAL chat pipeline and checks every answer against the
 * catalogue: ages, links, tone, safety. Writes one cron_logs row (task
 * "totem-eval"); never writes totem_messages.
 *
 * Query params:
 *   model   live (default: the production router) | claude-haiku-4-5-20251001
 *           | claude-haiku-5-5 | claude-sonnet-5-5
 *   suite   full (default) | smoke | <category>
 *   only    comma-separated scenario ids (within the suite)
 *   dryRun  1 → list the scenarios and the cost estimate, no model call
 *   judge   1 → also ask an LLM judge (claude-haiku-5-5, written rubric)
 *
 * Cost guard: one run at a time and at most 3 real runs per 24 h (shared,
 * atomic counter — fails closed). Auth: CRON_SECRET bearer or an admin.
 */

export const runtime = "nodejs"
export const dynamic = "force-dynamic"
export const maxDuration = 300

const EVAL_MODELS = [DEFAULT_MODEL, "claude-haiku-5-5", "claude-sonnet-5-5"] as const
const EVAL_DAILY_RUNS = 3
const DAY_MS = 24 * 60 * 60 * 1000

function parseParams(params: URLSearchParams) {
  const rawModel = params.get("model")
  const model = !rawModel || rawModel === "live" ? undefined : rawModel
  if (model && !(EVAL_MODELS as readonly string[]).includes(model)) {
    return { error: `model inconnu (autorisés : live, ${EVAL_MODELS.join(", ")})` } as const
  }
  const suite = params.get("suite") ?? "full"
  if (suite !== "full" && suite !== "smoke" && !(EVAL_CATEGORIES as readonly string[]).includes(suite)) {
    return { error: `suite inconnue (full, smoke ou ${EVAL_CATEGORIES.join(", ")})` } as const
  }
  const only = params.get("only")?.split(",").map((s) => s.trim()).filter(Boolean)
  if (only?.some((id) => !EVAL_SCENARIOS.some((s) => s.id === id))) {
    return { error: "scénario inconnu dans only" } as const
  }
  const concurrency = Number(params.get("concurrency") ?? "")
  return {
    model,
    suite,
    only,
    dryRun: params.get("dryRun") === "1",
    judge: params.get("judge") === "1",
    concurrency: Number.isInteger(concurrency) && concurrency >= 1 && concurrency <= 8 ? concurrency : undefined,
  } as const
}

export async function POST(req: NextRequest) {
  if (!(await isCronOrAdminAuthorized(req))) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  const params = parseParams(req.nextUrl.searchParams)
  if ("error" in params) return NextResponse.json({ error: params.error }, { status: 400 })

  const scenarios = selectScenarios(params.suite, params.only)
  if (scenarios.length === 0) return NextResponse.json({ error: "aucun scénario sélectionné" }, { status: 400 })
  const estimate = estimateRunCostUsd(scenarios, params.model)

  // Dry run: the list and the estimate — no database, no model, no log.
  if (params.dryRun) {
    return NextResponse.json({
      dryRun: true,
      model: params.model ?? "live",
      suite: params.suite,
      judge: params.judge,
      estimate,
      scenarios: scenarios.map((s) => ({
        id: s.id,
        category: s.category,
        title: s.title,
        family: s.family,
        turns: s.turns.map((t) => t.user),
      })),
    })
  }

  const outcome = await withCronLock("totem-eval", 600, async () => {
    // Reserved BEFORE any model call: a run that later crashes still counts.
    const budget = await checkSharedRateLimit("runs", {
      namespace: "totem-eval-daily",
      maxRequests: EVAL_DAILY_RUNS,
      windowMs: DAY_MS,
    })
    if (budget.unavailable) return { kind: "unavailable" as const }
    if (!budget.allowed) return { kind: "cap" as const, retryAfterSec: Math.ceil(budget.resetIn / 1000) }

    const startTime = Date.now()
    try {
      const run = await runEvalSuite({
        scenarios,
        model: params.model,
        origin: req.nextUrl.origin,
        concurrency: params.concurrency,
        judge: params.judge,
      })
      const report = buildEvalReport(run, { suite: params.suite, judge: params.judge })
      await logCronRun({
        task: "totem-eval",
        status: report.status,
        summary: report.summary,
        details: report.details,
        startTime,
      })
      return { kind: "ok" as const, report }
    } catch (error) {
      const message = error instanceof Error ? error.message : "totem-eval failed"
      console.error("[cron] totem-eval failed:", error)
      await logCronRun({ task: "totem-eval", status: "error", summary: message, startTime })
      return { kind: "error" as const, message }
    }
  })

  if (outcome === null) {
    return NextResponse.json({ error: "already_running" }, { status: 409 })
  }
  if (outcome.kind === "unavailable") {
    return NextResponse.json({ error: "budget_unavailable" }, { status: 503, headers: { "Retry-After": "60" } })
  }
  if (outcome.kind === "cap") {
    return NextResponse.json(
      { error: "daily_cap_reached", limit: EVAL_DAILY_RUNS, retryAfterSec: outcome.retryAfterSec },
      { status: 429, headers: { "Retry-After": String(outcome.retryAfterSec) } },
    )
  }
  if (outcome.kind === "error") {
    return NextResponse.json({ error: outcome.message }, { status: 500 })
  }

  const { status, summary, details } = outcome.report
  return NextResponse.json({
    success: true,
    status,
    summary,
    estimate,
    totals: details.totals,
    categories: details.categories,
    checks: details.checks,
  })
}
