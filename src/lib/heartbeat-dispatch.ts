/**
 * Automatic re-dispatch of missed GitHub Actions jobs, from the Vercel
 * heartbeat (approved by Xavier, Nov 2026).
 *
 * When the heartbeat finds a job that has not logged since its scheduled
 * fire, it asks GitHub to run the « Scheduled Maintenance » workflow
 * (cron.yml) for that job through `workflow_dispatch` — manual dispatches
 * are not stuck in the scheduled-run queue that delayed runs by 6–9 h.
 *
 * Guardrails, all here and all tested (`heartbeat-dispatch.test.ts`):
 * - explicit allow-list below; totem-eval (paid) and game-facts never;
 * - ≤ MAX_DISPATCH_PER_RUN per heartbeat, never the same task twice in
 *   DISPATCH_DEDUP_HOURS (read from the previous heartbeats' details);
 * - kill switch HEARTBEAT_AUTODISPATCH="false"; no GITHUB_DISPATCH_TOKEN →
 *   nothing sent; production only (VERCEL_ENV), like the other write agents;
 * - the token never reaches a log: it only goes into the Authorization
 *   header, and every error text is passed through `redactSecret`.
 *
 * Token setup for Xavier: docs/agents/heartbeat-token.md.
 */

import type { MissedTask } from "@/lib/heartbeat-schedule"

export const DISPATCH_REPO = "MixMasterFei/le-bon-avis-numerique"
export const DISPATCH_WORKFLOW = "cron.yml"
export const DISPATCH_REF = "main"
export const MAX_DISPATCH_PER_RUN = 6
export const DISPATCH_DEDUP_HOURS = 20
export const DISPATCH_TIMEOUT_MS = 8_000

/**
 * Dispatch tasks (cron.yml `workflow_dispatch` options) the heartbeat may
 * trigger. The real scheduled run can still arrive hours later; cron.yml's
 * `late-guard` job skips it (src/lib/late-run-guard.ts), but the guard fails
 * open, so each one must still be idempotent or harmless when it runs twice:
 */
export const DISPATCH_ALLOW_LIST: Record<string, "any-day" | "same-day"> = {
  // Imports only what is missing — dedup on (tmdb_id, type) / igdb id; release
  // alerts stamp notifiedAt; CNC import is only_missing. A second run finds
  // (almost) nothing new. Only overlap risk: both runs at the very same minute
  // could double a release-alert bell notification.
  import: "any-day",
  // Re-reads TMDB statuses through a cursor (tmdbCheckedAt): a second run just
  // reads the next titles. Pure refresh.
  "release-status": "any-day",
  // Picks isEnriched=false / self-draining queues (legacy, synopsis audit,
  // recalibrate) and recomputes quality scores (writes only changed rows). A
  // second run enriches the NEXT batch: more progress, ~1 extra day of the
  // ~$0.05–0.13 daily model cost, never a rewrite of the same rows.
  enrich: "any-day",
  // URL + title-fingerprint dedup: a second run cannot publish the same story
  // twice. Cost: one extra synthesis pass.
  "news-discover": "any-day",
  // Read + ≤ 4 small safe remediations + one digest email. A double run sends
  // a second digest and may count one more supervisor run in a persistence
  // streak (wording escalates a day early). Harmless.
  supervisor: "any-day",
  // Replaces ITS OWN pins (deleteMany source=watch + createMany) and imports
  // only missing titles (≤ 8): a second run reaches the same state. Second email.
  "homepage-watch": "any-day",
  // Seed-driven: imports only seeds absent from the catalogue. Idempotent.
  "games-top-names": "any-day",
  // Reads the catalogue and emails priorities; writes nothing. Second email.
  "family-content-agent": "any-day",
  // Writes, but each lever is guarded: maillage edges are capped per fiche and
  // a pair is never overwritten; a synopsis is rewritten only when the query
  // keyword is absent; seoTitle has one canonical form. A second run moves on
  // to the next fiches of the pool (at most a week's 12 + 12 writes again).
  // Only on its own day, so a late detection never adds a run mid-week.
  "seo-striking-distance": "same-day",
  // Read-only digest + email. Same-day only, like the SEO report.
  "debt-digest": "same-day",
}

/** Never dispatched, whatever the allow-list says (paid / pilot writes). */
export const NEVER_DISPATCH = new Set(["totem-eval", "game-facts"])

export type DispatchSkipReason = "not-allowed" | "not-today" | "recently-dispatched" | "cap"

export type DispatchPlan = {
  toDispatch: string[]
  skipped: { task: string; dispatchTask: string; reason: DispatchSkipReason }[]
}

export type DispatchResult = {
  task: string
  ok: boolean
  status: number | null
  error?: string
}

export function dispatchGate(env: {
  autodispatch?: string
  token?: string
  vercelEnv?: string
}): { enabled: true } | { enabled: false; reason: string } {
  if (env.autodispatch?.trim().toLowerCase() === "false") {
    return { enabled: false, reason: "relance automatique désactivée (HEARTBEAT_AUTODISPATCH=false)" }
  }
  if (!env.token?.trim()) {
    return { enabled: false, reason: "relance automatique désactivée (GITHUB_DISPATCH_TOKEN absent)" }
  }
  if (env.vercelEnv !== "production") {
    return { enabled: false, reason: "relance automatique désactivée hors production" }
  }
  return { enabled: true }
}

const sameUtcDay = (a: Date, b: Date) =>
  a.getUTCFullYear() === b.getUTCFullYear() && a.getUTCMonth() === b.getUTCMonth() && a.getUTCDate() === b.getUTCDate()

/**
 * Dispatch tasks the previous heartbeats (rows of the last
 * DISPATCH_DEDUP_HOURS) already sent. A definite HTTP refusal (4xx/5xx) did
 * not start anything and doesn't count; a timeout (status null) might have,
 * so it does.
 */
export function recentlyDispatched(
  rows: { createdAt: Date; details: unknown }[],
  now: Date,
): Set<string> {
  const since = now.getTime() - DISPATCH_DEDUP_HOURS * 3_600_000
  const out = new Set<string>()
  for (const row of rows) {
    if (row.createdAt.getTime() < since) continue
    const details = row.details as { dispatched?: unknown } | null
    if (!details || !Array.isArray(details.dispatched)) continue
    for (const entry of details.dispatched as Partial<DispatchResult>[]) {
      if (!entry || typeof entry.task !== "string") continue
      if (entry.ok === true || entry.status == null) out.add(entry.task)
    }
  }
  return out
}

export function planDispatch(params: {
  missed: MissedTask[]
  now: Date
  alreadyDispatched: Set<string>
}): DispatchPlan {
  const { missed, now, alreadyDispatched } = params
  const toDispatch: string[] = []
  const skipped: DispatchPlan["skipped"] = []
  for (const m of missed) {
    const rule = DISPATCH_ALLOW_LIST[m.dispatchTask]
    let reason: DispatchSkipReason | null = null
    if (NEVER_DISPATCH.has(m.dispatchTask) || !rule) reason = "not-allowed"
    else if (rule === "same-day" && !sameUtcDay(m.scheduledAt, now)) reason = "not-today"
    else if (alreadyDispatched.has(m.dispatchTask)) reason = "recently-dispatched"
    else if (toDispatch.includes(m.dispatchTask)) continue // two probes, one job
    else if (toDispatch.length >= MAX_DISPATCH_PER_RUN) reason = "cap"
    if (reason) skipped.push({ task: m.task, dispatchTask: m.dispatchTask, reason })
    else toDispatch.push(m.dispatchTask)
  }
  return { toDispatch, skipped }
}

/** Replaces every occurrence of the secret (and keeps error texts short). */
export function redactSecret(text: string, secret: string | undefined, max = 200): string {
  let out = text
  const s = secret?.trim()
  if (s) out = out.split(s).join("***")
  return out.length > max ? `${out.slice(0, max)}…` : out
}

async function readGithubError(res: Response): Promise<string> {
  try {
    const body = await res.text()
    try {
      const parsed = JSON.parse(body) as { message?: unknown }
      if (typeof parsed.message === "string") return parsed.message
    } catch {
      // not JSON
    }
    return body || res.statusText
  } catch {
    return res.statusText
  }
}

/**
 * POST one `workflow_dispatch` per task, in parallel, each with its own
 * timeout. Never throws: a failure is a `{ ok: false }` entry.
 */
export async function dispatchWorkflows(
  tasks: string[],
  opts: { token: string; fetchImpl?: typeof fetch; timeoutMs?: number },
): Promise<DispatchResult[]> {
  const { token, fetchImpl = fetch, timeoutMs = DISPATCH_TIMEOUT_MS } = opts
  const url = `https://api.github.com/repos/${DISPATCH_REPO}/actions/workflows/${DISPATCH_WORKFLOW}/dispatches`
  return Promise.all(
    tasks.map(async (task): Promise<DispatchResult> => {
      try {
        const res = await fetchImpl(url, {
          method: "POST",
          headers: {
            Accept: "application/vnd.github+json",
            Authorization: `Bearer ${token}`,
            "X-GitHub-Api-Version": "2022-11-28",
            "Content-Type": "application/json",
            "User-Agent": "totem-heartbeat",
          },
          body: JSON.stringify({ ref: DISPATCH_REF, inputs: { task, dry_run: "false" } }),
          signal: AbortSignal.timeout(timeoutMs),
          cache: "no-store",
        })
        if (res.ok) return { task, ok: true, status: res.status }
        return { task, ok: false, status: res.status, error: redactSecret(await readGithubError(res), token) }
      } catch (e) {
        const msg = e instanceof Error ? `${e.name}: ${e.message}` : String(e)
        return { task, ok: false, status: null, error: redactSecret(msg, token) }
      }
    }),
  )
}

const SKIP_LABELS: Record<DispatchSkipReason, string> = {
  "not-allowed": "non relancés (hors liste autorisée)",
  "not-today": "non relancés (seulement le jour prévu)",
  "recently-dispatched": "déjà relancés il y a moins de 20 h",
  cap: `non relancés (plafond de ${MAX_DISPATCH_PER_RUN} relances)`,
}

/** « Relancés : import, enrich · Relance échouée : x (HTTP 401) · … » */
export function describeDispatch(params: {
  gateReason?: string
  results: DispatchResult[]
  skipped: DispatchPlan["skipped"]
}): string {
  const parts: string[] = []
  if (params.gateReason) parts.push(params.gateReason)
  const ok = params.results.filter((r) => r.ok).map((r) => r.task)
  const failed = params.results.filter((r) => !r.ok)
  if (ok.length) parts.push(`Relancés sur GitHub : ${ok.join(", ")}`)
  if (failed.length) {
    parts.push(
      `Relance échouée : ${failed.map((r) => `${r.task} (${r.status ? `HTTP ${r.status}` : "pas de réponse"})`).join(", ")}`,
    )
  }
  for (const reason of Object.keys(SKIP_LABELS) as DispatchSkipReason[]) {
    const tasks = params.skipped.filter((s) => s.reason === reason).map((s) => s.task)
    if (tasks.length) parts.push(`${SKIP_LABELS[reason]} : ${tasks.join(", ")}`)
  }
  return parts.join(" · ")
}
