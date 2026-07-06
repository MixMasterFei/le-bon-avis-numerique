import { prisma } from "@/lib/prisma"
import { sendCronSupervisorDigest } from "@/lib/email"
import { withVerdict } from "@/lib/agent-verdict"

type CronStatus = "success" | "error" | "partial"

type RecentLog = {
  task: string
  status: CronStatus
  summary: string
  createdAt: Date
  details?: unknown
}

// A numeric field inside a task's logged `details` whose collapse toward zero
// signals "the task ran but produced almost nothing" — the failure mode a
// run/error/staleness check is blind to (e.g. news-discover logging success
// while publishing 0 stories).
type OutputMetric = {
  key: string
  label: string
  minBaseline?: number
}

type ExpectedTask = {
  task: string
  staleAfterHours: number
  allowRepeatedPartial?: boolean
  remediation?: Remediation
  outputMetric?: OutputMetric
}

type Remediation = {
  label: string
  method: "GET" | "POST"
  path: string
  body?: Record<string, unknown>
}

type Issue = {
  task: string
  status: "missing" | "stale" | "error" | "repeated-partial" | "output-anomaly"
  summary: string
  latest?: RecentLog
  remediation?: Remediation
  // How many CONSECUTIVE prior supervisor runs already flagged this task.
  // ≥2 means the daily remediation "succeeded" (HTTP 200) without fixing
  // anything — observed with the enrich AI_RECAL constraint bug, where the
  // identical email fired for a week. The report escalates wording so a
  // persistent anomaly reads as "fix the root cause", not "retried, fine".
  persistedRuns?: number
}

type ActionResult = {
  task: string
  label: string
  ok: boolean
  httpStatus: number | null
  summary: string
}

export type CronSupervisorResult = {
  issues: Issue[]
  actions: ActionResult[]
  report: string
  emailSent: boolean
}

const SITE_URL = process.env.NEXT_PUBLIC_APP_URL || process.env.SITE_URL || "https://totemavise.com"
const MAX_REMEDIATIONS = 4

const EXPECTED_TASKS: ExpectedTask[] = [
  { task: "import", staleAfterHours: 36, outputMetric: { key: "totalExamined", label: "Items TMDB examinés" } },
  { task: "import-games", staleAfterHours: 36, outputMetric: { key: "fetched", label: "Jeux récupérés" } },
  {
    task: "enrich",
    staleAfterHours: 36,
    outputMetric: { key: "processed", label: "Items traités (enrichissement)" },
    remediation: {
      label: "Relance enrichissement batch réduit",
      method: "POST",
      path: "/api/admin/enrich",
      body: { type: "all", limit: 3 },
    },
  },
  {
    task: "enrich-deep",
    staleAfterHours: 36,
    outputMetric: { key: "processed", label: "Items traités (deep)" },
    remediation: {
      label: "Relance deep enrichment batch réduit",
      method: "POST",
      path: "/api/admin/enrich-deep",
      body: { limit: 1 },
    },
  },
  {
    task: "quality",
    staleAfterHours: 36,
    outputMetric: { key: "total", label: "Items scorés" },
    remediation: {
      label: "Relance quality compute batch réduit",
      method: "POST",
      path: "/api/admin/quality/compute",
      body: { limit: 100, offset: 0 },
    },
  },
  {
    task: "news-discover",
    staleAfterHours: 10,
    // The motivating case: the pipeline logged "success" for ~2 weeks while
    // publishing 0 stories (image sourcing had collapsed). Staleness/error
    // checks never caught it; this does.
    outputMetric: { key: "storiesPersisted", label: "Stories publiées" },
    remediation: {
      label: "Relance news discovery",
      method: "GET",
      path: "/api/cron/news-discover",
    },
  },
  // NOTE: news.prewarmImagesV4 was removed here — the V4 Actualités feed now
  // renders raw RSS images directly ("directSource"), so the prewarm route is a
  // no-op and writes no cron_logs. Keeping it in EXPECTED_TASKS would raise a
  // false "stale" alert. Re-add it if NEWS_V4_PREWARM is ever turned back on.
  {
    // Press-kit scout — lightweight pass after news-discover. It does
    // not publish official images directly; it registers official media
    // centers as inactive candidates so V4 can graduate them after
    // human/legal review.
    task: "news.pressKitScout",
    staleAfterHours: 10,
    allowRepeatedPartial: true,
    remediation: {
      label: "Relance scanner press kits",
      method: "POST",
      path: "/api/admin/news/press-kit-scout?limit=20",
    },
  },
  {
    task: "weekly-dossier",
    staleAfterHours: 96,
    // A dossier run can legitimately log "partial" when it skips
    // (a recent dossier already exists) or has too few briefs to work
    // with — that second case is already surfaced by news-discover's
    // own flags, so don't double-alert here. Genuine failures still
    // show up as "error" status or as "stale" past 96h.
    allowRepeatedPartial: true,
    remediation: {
      label: "Relance dossier hebdomadaire",
      method: "GET",
      path: "/api/cron/weekly-dossier",
    },
  },
  {
    task: "family-content-agent",
    staleAfterHours: 192,
    remediation: {
      label: "Relance agent éditorial famille",
      method: "GET",
      path: "/api/cron/family-content-agent",
    },
  },
  {
    task: "backfill-ratings",
    staleAfterHours: 240,
    allowRepeatedPartial: true,
    remediation: {
      label: "Relance backfill notes TMDB",
      method: "POST",
      path: "/api/admin/backfill-ratings",
    },
  },
  {
    // Vercel-Cron watchdog. No remediation: if this is stale, Vercel
    // Cron itself isn't firing — that needs a human, not a re-poke
    // (re-running the check would just paper over the gap). A "partial"
    // means one daily canary was missing, which is often transient.
    task: "heartbeat",
    staleAfterHours: 50,
    allowRepeatedPartial: true,
  },
  {
    // Weekly tech/data-debt digest (Wednesday). Skipping a week is not
    // an emergency; a real failure shows up as "error" or "stale".
    task: "debt-digest",
    staleAfterHours: 200,
    allowRepeatedPartial: true,
    remediation: {
      label: "Relance digest de dette",
      method: "GET",
      path: "/api/cron/debt-digest",
    },
  },
  {
    // Weekly (Thu) SEO striking-distance report. No outputMetric: 0
    // opportunities is normal on a low-traffic site, so a "produced nothing"
    // check would false-positive. Logs "partial" until GSC env is configured.
    task: "seo-striking-distance",
    staleAfterHours: 192,
    allowRepeatedPartial: true,
    remediation: {
      label: "Relance rapport SEO striking-distance",
      method: "GET",
      path: "/api/cron/seo-striking-distance",
    },
  },
  {
    task: "streaming",
    staleAfterHours: 192,
    outputMetric: { key: "total", label: "Fiches streaming examinées" },
    remediation: {
      label: "Relance streaming films batch réduit",
      method: "POST",
      path: "/api/admin/streaming/update",
      body: { mediaType: "MOVIE", limit: 25, offset: 0 },
    },
  },
  {
    task: "similarity",
    staleAfterHours: 192,
    allowRepeatedPartial: true,
    remediation: {
      label: "Relance similarité batch réduit",
      method: "POST",
      path: "/api/admin/similarity/compute",
      body: { mode: "full", limit: 10, offset: 0 },
    },
  },
]

function hoursSince(date: Date): number {
  return (Date.now() - date.getTime()) / 3_600_000
}

function groupByTask(logs: RecentLog[]): Map<string, RecentLog[]> {
  const byTask = new Map<string, RecentLog[]>()
  for (const log of logs) {
    const list = byTask.get(log.task) ?? []
    list.push(log)
    byTask.set(log.task, list)
  }
  return byTask
}

function detectIssues(logs: RecentLog[]): Issue[] {
  const byTask = groupByTask(logs)
  const issues: Issue[] = []

  for (const expected of EXPECTED_TASKS) {
    const taskLogs = byTask.get(expected.task) ?? []
    const latest = taskLogs[0]

    if (!latest) {
      issues.push({
        task: expected.task,
        status: "missing",
        summary: `Aucun run trouvé dans la fenêtre récente`,
        remediation: expected.remediation,
      })
      continue
    }

    if (latest.status === "error") {
      issues.push({
        task: expected.task,
        status: "error",
        summary: latest.summary,
        latest,
        remediation: expected.remediation,
      })
      continue
    }

    if (hoursSince(latest.createdAt) > expected.staleAfterHours) {
      issues.push({
        task: expected.task,
        status: "stale",
        summary: `Dernier run il y a ${Math.round(hoursSince(latest.createdAt))}h`,
        latest,
        remediation: expected.remediation,
      })
      continue
    }

    const recentPartials = taskLogs.slice(0, 3).filter((log) => log.status === "partial").length
    if (recentPartials >= 2 && !expected.allowRepeatedPartial) {
      issues.push({
        task: expected.task,
        status: "repeated-partial",
        summary: `${recentPartials} runs partiels dans les 3 derniers runs`,
        latest,
        remediation: expected.remediation,
      })
    }
  }

  return issues
}

function extractMetric(details: unknown, key: string): number | null {
  let obj: unknown = details
  if (typeof obj === "string") {
    try {
      obj = JSON.parse(obj)
    } catch {
      return null
    }
  }
  if (typeof obj !== "object" || obj === null) return null
  const value = (obj as Record<string, unknown>)[key]
  return typeof value === "number" && Number.isFinite(value) ? value : null
}

function median(nums: number[]): number {
  if (nums.length === 0) return 0
  const sorted = [...nums].sort((a, b) => a - b)
  const mid = Math.floor(sorted.length / 2)
  return sorted.length % 2 ? sorted[mid] : (sorted[mid - 1] + sorted[mid]) / 2
}

// Detects tasks that ran successfully but whose output collapsed toward zero
// relative to their own recent baseline — the "ran but produced nothing" blind
// spot of run/error/staleness checks (e.g. news-discover publishing 0 stories
// while logging success). Alert-only: a quality collapse is usually a code/data
// bug, not a transient miss, so it carries no auto-remediation (re-triggering
// blindly would just hide it).
function detectOutputAnomalies(logs: RecentLog[]): Issue[] {
  const byTask = groupByTask(logs)
  const anomalies: Issue[] = []

  for (const expected of EXPECTED_TASKS) {
    const metric = expected.outputMetric
    if (!metric) continue

    const taskLogs = byTask.get(expected.task) ?? []
    const latest = taskLogs[0]
    // Only judge a successful latest run — error/stale/missing are handled
    // elsewhere, and a failed run's low output is expected, not an anomaly.
    if (!latest || latest.status !== "success") continue

    // Output metric across the recent successful runs, newest first.
    const vals = taskLogs
      .filter((log) => log.status === "success")
      .map((log) => extractMetric(log.details, metric.key))
      .filter((v): v is number => v !== null)
    // Need the latest two runs + a couple of baseline points.
    if (vals.length < 4) continue

    const [latestVal, secondVal, ...priorVals] = vals
    const baseline = median(priorVals)
    const floor = metric.minBaseline ?? 1
    const collapsed = (v: number) => v === 0 || v < baseline * 0.25
    // Flag only a *sustained* collapse: the task normally produces a meaningful
    // amount (baseline ≥ floor) but the last TWO runs both dropped to ~0. Two
    // consecutive filters out single-cycle blips (e.g. a news cycle that
    // legitimately yields 0) while still catching a real outage within a day.
    if (baseline >= floor && collapsed(latestVal) && collapsed(secondVal)) {
      anomalies.push({
        task: expected.task,
        status: "output-anomaly",
        summary: `${metric.label} : ${latestVal} puis ${secondVal} aux 2 derniers runs (référence ~${Math.round(baseline)}). La tâche s'exécute mais ne produit presque rien — probablement un bug en amont, pas un simple raté.`,
        latest,
      })
    }
  }

  return anomalies
}

async function runRemediation(issue: Issue): Promise<ActionResult> {
  if (!issue.remediation) {
    return {
      task: issue.task,
      label: "Aucune remédiation configurée",
      ok: false,
      httpStatus: null,
      summary: "Intervention humaine requise",
    }
  }

  const url = `${SITE_URL}${issue.remediation.path}`
  const headers: Record<string, string> = {
    Authorization: `Bearer ${process.env.CRON_SECRET ?? ""}`,
  }
  if (issue.remediation.method === "POST") headers["Content-Type"] = "application/json"

  try {
    const response = await fetch(url, {
      method: issue.remediation.method,
      headers,
      body: issue.remediation.body ? JSON.stringify(issue.remediation.body) : undefined,
      signal: AbortSignal.timeout(130_000),
    })
    const text = await response.text()
    return {
      task: issue.task,
      label: issue.remediation.label,
      ok: response.ok,
      httpStatus: response.status,
      summary: text.slice(0, 500),
    }
  } catch (error) {
    return {
      task: issue.task,
      label: issue.remediation.label,
      ok: false,
      httpStatus: null,
      summary: error instanceof Error ? error.message : "Remédiation échouée",
    }
  }
}

function actionForAgent(issue: Issue, action?: ActionResult): string {
  if (issue.task === "import") {
    return "Analyser pourquoi l'import reste en partial et verifier si c'est un partial acceptable ou un vrai blocage catalogue."
  }

  if (issue.task === "weekly-dossier") {
    return action?.ok
      ? "Surveiller le prochain run weekly-dossier et corriger la cause si le statut reste partial malgre la relance OK."
      : "Diagnostiquer weekly-dossier : lire les logs de generation, verifier sources, timeout et persistance."
  }

  if (issue.task === "similarity") {
    return action?.ok
      ? "Verifier que la similarite progresse par batch et ajuster le seuil de detection si le statut missing est attendu entre deux batchs."
      : "Diagnostiquer la similarite : verifier offset, total, erreurs Prisma/API et reprise de batch."
  }

  if (issue.status === "missing" || issue.status === "stale") {
    return `Verifier pourquoi ${issue.task} ne produit plus de cron_logs recents.`
  }

  if (issue.status === "repeated-partial") {
    return `Lire les derniers logs ${issue.task} et determiner si le partial est normal ou a corriger.`
  }

  return `Diagnostiquer ${issue.task} : ${issue.summary}`
}

function actionForHuman(issues: Issue[], actions: ActionResult[]): string[] {
  const failedActions = actions.filter((action) => !action.ok)
  const unresolved = issues.filter((issue) => !actions.some((action) => action.task === issue.task && action.ok))
  const persistent = issues.filter((issue) => (issue.persistedRuns ?? 0) >= 2)

  if (issues.length === 0) {
    return ["Rien a faire. Le superviseur n'a detecte aucune anomalie."]
  }

  if (persistent.length > 0) {
    return [
      "Anomalie persistante : la relance automatique passe (HTTP 200) mais ne corrige rien — la cause racine est ailleurs (bug code/DB, pas un rate).",
      "Transmettre ce mail a Codex avec la demande : \"diagnostique et corrige la cause racine\".",
      ...persistent.map(
        (issue) => `${issue.task} : flague ${(issue.persistedRuns ?? 0) + 1} runs superviseur d'affilee.`,
      ),
    ]
  }

  if (failedActions.length > 0) {
    return [
      "Verifier /admin/operations si un impact est visible sur le site.",
      "Transmettre ce mail a Codex avec la demande : \"traite les actions agent du superviseur\".",
      ...failedActions.map((action) => `Relance automatique KO pour ${action.task} (${action.httpStatus ?? "n/a"}).`),
    ]
  }

  if (unresolved.length > 0) {
    return [
      "Pas de manipulation urgente si le site semble normal.",
      "Transmettre ce mail a Codex si l'anomalie revient demain ou si une section du site semble bloquee.",
    ]
  }

  return [
    "Aucune action manuelle immediate.",
    "Verifier seulement que le prochain mail superviseur revient au vert ou que les memes anomalies ne persistent pas.",
  ]
}

function buildReport(issues: Issue[], actions: ActionResult[]): string {
  const lines: string[] = [
    "# Superviseur Totem Avisé",
    "",
    `Date : ${new Date().toISOString()}`,
    "",
  ]

  if (issues.length === 0) {
    lines.push("Tout est OK. Aucune anomalie détectée sur les tâches surveillées.")
    lines.push("")
    lines.push("## Action pour toi")
    lines.push("- Rien a faire.")
    lines.push("")
    lines.push("## Action pour l'agent")
    lines.push("- Rien a traiter.")
    return withVerdict(lines.join("\n"), { count: 0 })
  }

  const failedActions = actions.filter((action) => !action.ok)
  const unresolved = issues.filter((issue) => !actions.some((action) => action.task === issue.task && action.ok))
  const persistentCount = issues.filter((issue) => (issue.persistedRuns ?? 0) >= 2).length
  const decision =
    persistentCount > 0
      ? "Cause racine a corriger : la meme anomalie persiste malgre les relances automatiques quotidiennes."
      : failedActions.length > 0
        ? "Intervention agent recommandee : au moins une remediation automatique a echoue."
        : unresolved.length > 0
          ? "A surveiller : certaines anomalies n'ont pas de remediation automatique OK."
          : "Remediation automatique OK : surveiller le prochain run."

  lines.push("## Lecture rapide", "")
  lines.push(`- Verdict : ${decision}`)
  lines.push(`- Anomalies : ${issues.length}`)
  lines.push(`- Remediations OK : ${actions.filter((action) => action.ok).length}/${actions.length}`)
  lines.push(`- Action humaine urgente : ${failedActions.length > 0 ? "oui" : "non"}`)
  lines.push("")

  lines.push(`## Anomalies détectées (${issues.length})`, "")
  for (const issue of issues) {
    lines.push(
      `- ${issue.task} — ${issue.status}`,
      `  ${issue.summary}`,
      issue.latest ? `  Dernier run : ${issue.latest.createdAt.toISOString()} (${issue.latest.status})` : "",
      (issue.persistedRuns ?? 0) >= 2
        ? `  ⚠ PERSISTANT : déjà flagué aux ${issue.persistedRuns} runs superviseur précédents — la relance ne suffit pas, corriger la cause racine.`
        : "",
    )
  }

  lines.push("", `## Remédiations tentées (${actions.length})`, "")
  if (actions.length === 0) {
    lines.push("Aucune remédiation automatique tentée.")
  } else {
    for (const action of actions) {
      lines.push(
        `- ${action.ok ? "OK" : "KO"} ${action.task} — ${action.label}`,
        `  HTTP : ${action.httpStatus ?? "n/a"}`,
        `  Résumé : ${action.summary || "aucun détail"}`,
      )
    }
  }

  lines.push("", "## Action pour toi")
  for (const item of actionForHuman(issues, actions)) {
    lines.push(`- ${item}`)
  }

  lines.push("", "## Action pour l'agent")
  if (unresolved.length === 0 && failedActions.length === 0) {
    lines.push("- Rien a corriger immediatement. Recontrole demain si la meme anomalie revient.")
  } else {
    for (const issue of unresolved) {
      const action = actions.find((candidate) => candidate.task === issue.task)
      lines.push(`- ${issue.task} : ${actionForAgent(issue, action)}`)
    }
  }

  const leadIssue = unresolved[0]
  return withVerdict(lines.filter(Boolean).join("\n"), {
    count: unresolved.length,
    kind: "action",
    top: leadIssue ? `${leadIssue.task} (${leadIssue.status})` : "anomalies corrigées automatiquement — vérifier au prochain run",
  })
}

export async function runCronSupervisor(params: { forceEmail?: boolean } = {}): Promise<CronSupervisorResult> {
  // Fetch the latest few runs *per expected task* rather than a global
  // recent-window slice. High-frequency tasks (news.prewarmImagesV4 logs
  // ~20×/day, pressKitScout ~12×/day) used to fill the 300-log window and
  // push weekly/10-day tasks out of it entirely — so detectIssues saw no
  // run for them and false-flagged "missing", firing needless re-triggers
  // (e.g. family-content-agent running off-schedule). Per-task fetch is
  // immune to volume and far cheaper (≤3 rows per task). "missing" now means
  // genuinely never-logged; a task that ran but lapsed is caught as "stale".
  const perTaskLogs = await Promise.all(
    EXPECTED_TASKS.map((expected) =>
      prisma.cronLog.findMany({
        where: { task: expected.task },
        orderBy: { createdAt: "desc" },
        take: 8, // latest 2 runs + a short baseline window for output-anomaly checks
        select: { task: true, status: true, summary: true, createdAt: true, details: true },
      }),
    ),
  )

  const recentLogs: RecentLog[] = perTaskLogs.flat().map((log) => ({
    task: log.task,
    status: log.status as CronStatus,
    summary: log.summary ?? "",
    createdAt: log.createdAt,
    details: log.details,
  }))

  // Run/error/staleness issues, plus output-anomalies (ran fine but produced
  // almost nothing). A task already flagged by detectIssues isn't double-counted.
  const issues = detectIssues(recentLogs)
  const flaggedTasks = new Set(issues.map((i) => i.task))
  for (const anomaly of detectOutputAnomalies(recentLogs)) {
    if (!flaggedTasks.has(anomaly.task)) issues.push(anomaly)
  }

  // Persistence: how many consecutive prior supervisor runs already flagged
  // each task (read back from our own cron_logs details.issues). A streak ≥2
  // escalates the report from "relance OK" to "cause racine à corriger" —
  // otherwise a remediation that returns 200 without fixing anything produces
  // the exact same digest every day and nothing distinguishes day 7 from day 1.
  if (issues.length > 0) {
    const priorRuns = await prisma.cronLog.findMany({
      where: { task: "cron-supervisor" },
      orderBy: { createdAt: "desc" },
      take: 7,
      select: { details: true },
    })
    const priorFlagged: Array<Set<string>> = priorRuns.map((run) => {
      let parsed: unknown = run.details
      if (typeof parsed === "string") {
        try {
          parsed = JSON.parse(parsed)
        } catch {
          parsed = null
        }
      }
      const list = (parsed as { issues?: Array<{ task?: unknown }> } | null)?.issues
      return new Set(
        (Array.isArray(list) ? list : [])
          .map((entry) => entry?.task)
          .filter((task): task is string => typeof task === "string"),
      )
    })
    for (const issue of issues) {
      let streak = 0
      for (const flagged of priorFlagged) {
        if (!flagged.has(issue.task)) break
        streak++
      }
      issue.persistedRuns = streak
    }
  }
  const remediationsEnabled = process.env.CRON_SUPERVISOR_REMEDIATE !== "false"
  const actions: ActionResult[] = []

  if (remediationsEnabled && process.env.CRON_SECRET) {
    const remediableIssues = issues
      .filter((issue) => issue.remediation)
      .slice(0, MAX_REMEDIATIONS)

    for (const issue of remediableIssues) {
      actions.push(await runRemediation(issue))
    }
  }

  const report = buildReport(issues, actions)
  const emailSent = params.forceEmail || issues.length > 0 || actions.length > 0

  if (emailSent) {
    const hasPersistent = issues.some((issue) => (issue.persistedRuns ?? 0) >= 2)
    await sendCronSupervisorDigest({
      subject:
        issues.length === 0
          ? "Superviseur Totem — tout est OK"
          : `Superviseur Totem — ${issues.length} anomalie${issues.length > 1 ? "s" : ""}${hasPersistent ? " (persistante — cause racine à corriger)" : ""}`,
      report,
    })
  }

  return { issues, actions, report, emailSent }
}
