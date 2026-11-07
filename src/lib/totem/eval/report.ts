import { DEFAULT_MODEL } from "@/lib/anthropic"
import { estimateCostUsd } from "@/lib/totem/cost"
import { pickModel } from "@/lib/totem/model-router"
import { EVAL_CATEGORIES, type EvalScenario, type ScenarioResult } from "./types"
import type { EvalRunResult } from "./runner"

/**
 * The cron_logs row of a bench run: a one-line summary, pass rates per
 * category and per check, cost and latency, and per-scenario transcripts
 * (truncated) with every check outcome.
 */

/** Keep the cron_logs row reasonable (the admin pages read it). */
export const EVAL_DETAILS_MAX_CHARS = 200_000

const clip = (s: string, n: number) => (s.length > n ? `${s.slice(0, n - 1)}…` : s)
const round = (n: number, digits = 4) => Math.round(n * 10 ** digits) / 10 ** digits

function percentile(values: number[], p: number): number | null {
  if (values.length === 0) return null
  const sorted = [...values].sort((a, b) => a - b)
  return sorted[Math.min(sorted.length - 1, Math.floor((p / 100) * sorted.length))]
}

function toolSummary(name: string, input: unknown): string {
  let args = ""
  try {
    args = JSON.stringify(input ?? {})
  } catch {
    args = "?"
  }
  return clip(`${name}(${args === "{}" ? "" : args})`, 120)
}

function scenarioDetails(s: ScenarioResult, sizes: { reply: number; user: number; tools: number }) {
  return {
    id: s.id,
    category: s.category,
    status: s.status,
    ...(s.skipReason ? { skipReason: s.skipReason } : {}),
    costUsd: round(s.costUsd),
    latencyMs: s.latencyMs,
    failedChecks: [...new Set(s.turns.flatMap((t) => t.checks.filter((c) => !c.pass).map((c) => c.id)))],
    turns: s.turns.map((t) => ({
      user: clip(t.trace.user, sizes.user),
      reply: clip(t.trace.text, sizes.reply),
      model: t.trace.model,
      routing: t.trace.routing,
      finishReason: t.trace.finishReason,
      ...(t.trace.error ? { error: t.trace.error } : {}),
      latencyMs: t.trace.latencyMs,
      tokens: {
        input: t.trace.usage.inputTokens,
        uncached: t.trace.usage.uncachedInputTokens,
        cacheRead: t.trace.usage.cachedInputTokens,
        cacheWrite: t.trace.usage.cacheWriteInputTokens,
        output: t.trace.usage.outputTokens,
      },
      costUsd: t.trace.costUsd == null ? null : round(t.trace.costUsd),
      tools: t.trace.steps
        .flatMap((st) => st.toolCalls.map((c) => toolSummary(c.toolName, c.input)))
        .slice(0, sizes.tools),
      passed: t.checks.filter((c) => c.pass).map((c) => c.id),
      failed: t.checks.filter((c) => !c.pass).map((c) => ({ id: c.id, detail: c.detail })),
      ...(t.judge ? { judge: t.judge } : {}),
    })),
  }
}

export interface EvalReport {
  status: "success" | "partial"
  summary: string
  details: Record<string, unknown>
}

export function buildEvalReport(run: EvalRunResult, meta: { suite: string; judge: boolean }): EvalReport {
  const ran = run.scenarios.filter((s) => s.status !== "skipped")
  const passed = ran.filter((s) => s.status === "pass")
  const turns = ran.flatMap((s) => s.turns)
  const latencies = turns.map((t) => t.trace.latencyMs)
  const costUsd = run.scenarios.reduce((sum, s) => sum + s.costUsd, 0)
  const sumUsage = (key: keyof (typeof turns)[number]["trace"]["usage"]) =>
    turns.reduce((sum, t) => sum + (t.trace.usage[key] ?? 0), 0)

  const categories: Record<string, { scenarios: number; passed: number; passRate: number | null }> = {}
  for (const cat of EVAL_CATEGORIES) {
    const inCat = ran.filter((s) => s.category === cat)
    if (inCat.length === 0) continue
    const ok = inCat.filter((s) => s.status === "pass").length
    categories[cat] = { scenarios: inCat.length, passed: ok, passRate: round(ok / inCat.length, 3) }
  }

  const checks: Record<string, { total: number; failed: number; passRate: number }> = {}
  for (const t of turns)
    for (const c of t.checks) {
      const entry = (checks[c.id] ??= { total: 0, failed: 0, passRate: 1 })
      entry.total++
      if (!c.pass) entry.failed++
    }
  for (const entry of Object.values(checks)) entry.passRate = round(1 - entry.failed / entry.total, 3)

  const models: Record<string, number> = {}
  for (const t of turns) models[t.trace.model] = (models[t.trace.model] ?? 0) + 1

  const judged = turns.filter((t) => t.judge)
  const incomplete = run.scenarios.filter(
    (s) => s.status === "skipped" && /budget|erreur du banc/.test(s.skipReason ?? ""),
  )
  const failedChecks = turns.reduce((n, t) => n + t.checks.filter((c) => !c.pass).length, 0)

  const totals = {
    scenarios: run.scenarios.length,
    ran: ran.length,
    passed: passed.length,
    failed: ran.length - passed.length,
    skipped: run.scenarios.length - ran.length,
    passRate: ran.length ? round(passed.length / ran.length, 3) : null,
    turns: turns.length,
    failedChecks,
    costUsd: round(costUsd),
    avgLatencyMs: latencies.length ? Math.round(latencies.reduce((a, b) => a + b, 0) / latencies.length) : null,
    p90LatencyMs: percentile(latencies, 90),
    inputTokens: sumUsage("inputTokens"),
    uncachedInputTokens: sumUsage("uncachedInputTokens"),
    cachedInputTokens: sumUsage("cachedInputTokens"),
    cacheWriteInputTokens: sumUsage("cacheWriteInputTokens"),
    outputTokens: sumUsage("outputTokens"),
    models,
  }

  const header = {
    model: run.model,
    suite: meta.suite,
    judge: meta.judge,
    startedAt: run.startedAt,
    durationMs: run.durationMs,
    totals,
    categories,
    checks,
    ...(meta.judge
      ? {
          judgeVerdicts: {
            total: judged.length,
            pass: judged.filter((t) => t.judge?.verdict === "pass").length,
            fail: judged.filter((t) => t.judge?.verdict === "fail").length,
            error: judged.filter((t) => t.judge?.verdict === "error").length,
          },
        }
      : {}),
  }

  // Shrink the transcripts until the row fits.
  let details: Record<string, unknown> = {}
  for (const sizes of [
    { reply: 700, user: 200, tools: 8 },
    { reply: 350, user: 150, tools: 4 },
    { reply: 160, user: 100, tools: 2 },
    { reply: 0, user: 80, tools: 0 },
  ]) {
    details = { ...header, scenarios: run.scenarios.map((s) => scenarioDetails(s, sizes)) }
    if (JSON.stringify(details).length <= EVAL_DETAILS_MAX_CHARS) break
  }

  const pct = totals.passRate == null ? "—" : `${Math.round(totals.passRate * 100)} %`
  const summary =
    `Totem (${run.model}) : ${passed.length}/${ran.length} scénarios réussis (${pct}), ` +
    `${failedChecks} vérification(s) en échec ; coût ${costUsd.toFixed(2)} $ ; ` +
    `latence moy. ${totals.avgLatencyMs == null ? "—" : `${(totals.avgLatencyMs / 1000).toFixed(1)} s`}` +
    (totals.skipped ? ` ; ${totals.skipped} ignoré(s)` : "")

  return {
    status: failedChecks > 0 || incomplete.length > 0 ? "partial" : "success",
    summary,
    details,
  }
}

// ---------------------------------------------------------------------------
// Cost estimate (dry run)
// ---------------------------------------------------------------------------

/**
 * Token profile of one chat turn, from the review of the live logs
 * (2026-11): ~40k cached tokens (static head ~10–12k + tools ~2.7k, read once
 * per tool-loop step), ~12k uncached (dynamic tail + history, ~85 % of it
 * tool outputs; 3k–33k observed) and ~0.5k output. Cache writes: the static
 * head (~14k) once per model per worker within the 5-minute cache TTL.
 */
export const EVAL_TURN_PROFILE = { cacheRead: 40_000, uncached: 12_000, output: 500 }
export const EVAL_CACHE_WRITES_PER_RUN = 5 * 14_000

export function estimateRunCostUsd(scenarios: EvalScenario[], model: string | undefined): {
  turns: number
  usd: number | null
  byModel: Record<string, number>
} {
  const byModel: Record<string, number> = {}
  for (const s of scenarios)
    for (const t of s.turns) {
      // The live router's keyword escalation is known in advance; its other
      // triggers (long thread, multi-tool previous turn) only at run time,
      // so for "live" this is a lower bound.
      const m = model ?? pickModel({ turnCount: 1, lastTurnToolCount: 0, userText: t.user }).model
      byModel[m] = (byModel[m] ?? 0) + 1
    }
  let usd: number | null = 0
  for (const [m, n] of Object.entries(byModel)) {
    const perTurn = estimateCostUsd(m, {
      inputTokens: null,
      outputTokens: EVAL_TURN_PROFILE.output,
      cachedInputTokens: EVAL_TURN_PROFILE.cacheRead,
      uncachedInputTokens: EVAL_TURN_PROFILE.uncached,
      cacheWriteInputTokens: 0,
    })
    if (perTurn == null || usd == null) {
      usd = null
      continue
    }
    usd += perTurn * n
  }
  const writes = estimateCostUsd(model ?? DEFAULT_MODEL, {
    inputTokens: null,
    outputTokens: 0,
    cachedInputTokens: 0,
    uncachedInputTokens: 0,
    cacheWriteInputTokens: EVAL_CACHE_WRITES_PER_RUN,
  })
  return {
    turns: Object.values(byModel).reduce((a, b) => a + b, 0),
    usd: usd == null || writes == null ? null : round(usd + writes, 3),
    byModel,
  }
}
