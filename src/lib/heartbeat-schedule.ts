/**
 * What the Vercel heartbeat expects GitHub Actions to have run, and when.
 *
 * Pure module (no I/O) — the route `src/app/api/cron/heartbeat/route.ts` reads
 * `cron_logs` and feeds the result in here.
 *
 * Single source of truth for the schedules is `.github/workflows/cron.yml`:
 * each entry below carries the EXACT cron string of its `schedule:` line and
 * the `workflow_dispatch` task that runs the same job. Nothing else is typed
 * by hand — cadence and « prévu à » are derived from the cron string — and
 * `src/lib/__tests__/heartbeat-schedule.test.ts` fails if an entry drifts from
 * cron.yml (string gone from `schedule:`, task gone from the dispatch options,
 * or the job's `if:` no longer pairing the two).
 *
 * Why this exists (22–23 Nov 2026): GitHub delayed scheduled runs by 6–9 h or
 * dropped them, and the old heartbeat (« alarm only if NONE of 4 canaries ran
 * in 30 h ») said « success » because Sunday's late runs were still inside
 * the window. It now names every job that has not logged since its most
 * recent scheduled fire.
 */

export type HeartbeatCadence = "multi-daily" | "daily" | "every-2-days" | "weekly" | "monthly"

export type HeartbeatJob = {
  /** `cron_logs.task` written by the job's main route. */
  task: string
  /** The `workflow_dispatch` `task` option of cron.yml that runs this job. */
  dispatchTask: string
  /** Exact cron string of the job's `schedule:` line in cron.yml (UTC). */
  cron: string
  /**
   * Only for jobs absent from EXPECTED_TASKS (cron-supervisor.ts); for the
   * others the route passes EXPECTED_TASKS' own `activatedAt`, so the date is
   * never written twice. A fire before this date is not expected.
   */
  activatedAt?: string
}

// One entry per GitHub Actions job, probed through the cron_logs task its
// first route writes. Order = dispatch priority when the cap bites (daily
// pipeline first: import feeds enrich, enrich feeds everything else).
export const HEARTBEAT_JOBS: HeartbeatJob[] = [
  { task: "import", dispatchTask: "import", cron: "7 3 * * *" },
  { task: "release-status", dispatchTask: "release-status", cron: "7 3 * * *" },
  { task: "enrich", dispatchTask: "enrich", cron: "11 4 * * *" },
  { task: "news-discover", dispatchTask: "news-discover", cron: "17 0,6,12,18 * * *" },
  // Fires at 07:47, 13 min before the heartbeat: with the grace below, the
  // 08:00 check looks at YESTERDAY's fire (today's can't have logged yet).
  { task: "cron-supervisor", dispatchTask: "supervisor", cron: "47 7 * * *" },
  { task: "homepage-watch", dispatchTask: "homepage-watch", cron: "41 5 */2 * *" },
  { task: "family-content-agent", dispatchTask: "family-content-agent", cron: "37 6 * * 1" },
  { task: "games-top-names", dispatchTask: "games-top-names", cron: "53 6 * * 1" },
  { task: "debt-digest", dispatchTask: "debt-digest", cron: "13 6 * * 3" },
  { task: "seo-striking-distance", dispatchTask: "seo-striking-distance", cron: "23 6 * * 4" },
  { task: "weekly-dossier", dispatchTask: "weekly-dossier", cron: "27 5 * * 2,5" },
  { task: "backfill-ratings", dispatchTask: "backfill-ratings", cron: "19 5 * * 6" },
  { task: "revert-unreleased", dispatchTask: "revert-unreleased", cron: "43 6 * * 0" },
  { task: "totem-eval", dispatchTask: "totem-eval", cron: "51 5 * * 0" },
  { task: "game-guides-check", dispatchTask: "game-guides-check", cron: "33 6 1 * *" },
]

/**
 * A fire only counts as « due » this long after its scheduled minute: GitHub
 * normally starts a scheduled run within a few minutes and the routes log
 * within ~5 min. 60 min keeps the 07:47 supervisor out of the 08:00 check and
 * keeps the 06:53 Monday job in it.
 */
export const HEARTBEAT_GRACE_MINUTES = 60

// ── Minimal cron reader (the forms cron.yml uses) ──────────────────────────

type CronSpec = {
  minute: number
  hours: number[]
  dom: number[] | null // null = "*"
  dow: number[] | null // null = "*"
}

function parseField(field: string, min: number, max: number): number[] | null {
  if (field === "*") return null
  const step = /^\*\/(\d+)$/.exec(field)
  if (step) {
    const n = Number(step[1])
    if (!Number.isInteger(n) || n < 1) throw new Error(`Pas de cron invalide : ${field}`)
    const out: number[] = []
    for (let v = min; v <= max; v += n) out.push(v)
    return out
  }
  const values = field.split(",").map((part) => {
    if (!/^\d+$/.test(part)) throw new Error(`Champ cron non pris en charge : ${field}`)
    const v = Number(part)
    if (v < min || v > max) throw new Error(`Valeur cron hors bornes : ${field}`)
    return v
  })
  return values
}

export function parseCron(cron: string): CronSpec {
  const parts = cron.trim().split(/\s+/)
  if (parts.length !== 5) throw new Error(`Cron à 5 champs attendu : ${cron}`)
  const [m, h, dom, month, dow] = parts
  if (month !== "*") throw new Error(`Champ mois non pris en charge : ${cron}`)
  const minute = parseField(m, 0, 59)
  if (!minute || minute.length !== 1) throw new Error(`Une seule minute attendue : ${cron}`)
  const hours = parseField(h, 0, 23) ?? Array.from({ length: 24 }, (_, i) => i)
  // Sunday is 0 (GitHub also accepts 7 — we don't use it).
  return { minute: minute[0], hours, dom: parseField(dom, 1, 31), dow: parseField(dow, 0, 6) }
}

export function cadenceOf(cron: string): HeartbeatCadence {
  const spec = parseCron(cron)
  if (spec.dom === null && spec.dow === null) return spec.hours.length > 1 ? "multi-daily" : "daily"
  if (spec.dow !== null) return "weekly"
  return spec.dom!.length > 1 ? "every-2-days" : "monthly"
}

/** Daily-or-more-frequent jobs: missing one is worth the failure email. */
export function isUrgentCadence(cadence: HeartbeatCadence): boolean {
  return cadence === "daily" || cadence === "multi-daily"
}

function dayMatches(spec: CronSpec, date: Date): boolean {
  const domOk = spec.dom === null || spec.dom.includes(date.getUTCDate())
  const dowOk = spec.dow === null || spec.dow.includes(date.getUTCDay())
  // Standard cron: when BOTH day fields are restricted, either one matches.
  if (spec.dom !== null && spec.dow !== null) return domOk || dowOk
  return domOk && dowOk
}

/**
 * The latest scheduled fire `f` with `f + grace ≤ now` — i.e. the most recent
 * fire that should already have logged. Null when none in the last 62 days.
 */
export function mostRecentDueFire(cron: string, now: Date, graceMinutes = HEARTBEAT_GRACE_MINUTES): Date | null {
  const spec = parseCron(cron)
  const limit = now.getTime() - graceMinutes * 60_000
  const hoursDesc = [...spec.hours].sort((a, b) => b - a)
  for (let back = 0; back <= 62; back++) {
    const day = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate() - back))
    if (!dayMatches(spec, day)) continue
    for (const hour of hoursDesc) {
      const fire = Date.UTC(day.getUTCFullYear(), day.getUTCMonth(), day.getUTCDate(), hour, spec.minute)
      if (fire <= limit) return new Date(fire)
    }
  }
  return null
}

// ── Missed jobs ────────────────────────────────────────────────────────────

export type MissedTask = {
  task: string
  dispatchTask: string
  cadence: HeartbeatCadence
  scheduledAt: Date
  urgent: boolean
}

/**
 * A job is MISSED when it has no cron_logs row since its most recent due
 * fire. A fire before the job's `activatedAt` (from EXPECTED_TASKS, or the
 * entry's own) is not expected: the job didn't exist yet.
 */
export function findMissedTasks(params: {
  now: Date
  lastRunByTask: Map<string, Date>
  activatedAtByTask?: Map<string, string>
  jobs?: HeartbeatJob[]
  graceMinutes?: number
}): MissedTask[] {
  const { now, lastRunByTask, activatedAtByTask, jobs = HEARTBEAT_JOBS, graceMinutes = HEARTBEAT_GRACE_MINUTES } = params
  const missed: MissedTask[] = []
  for (const job of jobs) {
    const fire = mostRecentDueFire(job.cron, now, graceMinutes)
    if (!fire) continue
    const activatedAt = job.activatedAt ?? activatedAtByTask?.get(job.task)
    // Invalid date → NaN → comparison false → the fire IS checked (fail loud).
    if (activatedAt && fire.getTime() < new Date(`${activatedAt}T00:00:00Z`).getTime()) continue
    const last = lastRunByTask.get(job.task)
    if (last && last.getTime() >= fire.getTime()) continue
    const cadence = cadenceOf(job.cron)
    missed.push({ task: job.task, dispatchTask: job.dispatchTask, cadence, scheduledAt: fire, urgent: isUrgentCadence(cadence) })
  }
  return missed
}

// ── Plain-French wording ───────────────────────────────────────────────────

const pad = (n: number) => String(n).padStart(2, "0")
const sameUtcDay = (a: Date, b: Date) =>
  a.getUTCFullYear() === b.getUTCFullYear() && a.getUTCMonth() === b.getUTCMonth() && a.getUTCDate() === b.getUTCDate()

/** « 03:07 » today, « hier 07:47 », else « 16/11 06:53 » (UTC). */
export function fireLabel(fire: Date, now: Date): string {
  const hm = `${pad(fire.getUTCHours())}:${pad(fire.getUTCMinutes())}`
  if (sameUtcDay(fire, now)) return hm
  if (sameUtcDay(fire, new Date(now.getTime() - 86_400_000))) return `hier ${hm}`
  return `${pad(fire.getUTCDate())}/${pad(fire.getUTCMonth() + 1)} ${hm}`
}

/** « Pas encore passés aujourd'hui : import (prévu 03:07), enrich (04:11) » */
export function describeMissed(missed: MissedTask[], now: Date): string {
  if (missed.length === 0) return ""
  const allToday = missed.every((m) => sameUtcDay(m.scheduledAt, now))
  const items = missed.map((m, i) => `${m.task} (${i === 0 ? "prévu " : ""}${fireLabel(m.scheduledAt, now)})`)
  return `${allToday ? "Pas encore passés aujourd'hui" : "Pas encore passés"} : ${items.join(", ")}`
}
