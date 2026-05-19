import { prisma } from "@/lib/prisma"
import { sendCronSupervisorDigest } from "@/lib/email"

type CronStatus = "success" | "error" | "partial"

type RecentLog = {
  task: string
  status: CronStatus
  summary: string
  createdAt: Date
}

type ExpectedTask = {
  task: string
  staleAfterHours: number
  allowRepeatedPartial?: boolean
  remediation?: Remediation
}

type Remediation = {
  label: string
  method: "GET" | "POST"
  path: string
  body?: Record<string, unknown>
}

type Issue = {
  task: string
  status: "missing" | "stale" | "error" | "repeated-partial"
  summary: string
  latest?: RecentLog
  remediation?: Remediation
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
  { task: "import", staleAfterHours: 36 },
  { task: "import-games", staleAfterHours: 36 },
  {
    task: "enrich",
    staleAfterHours: 36,
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
    remediation: {
      label: "Relance news discovery",
      method: "GET",
      path: "/api/cron/news-discover",
    },
  },
  {
    // V4 image prewarm — runs in the same GH-Actions job as news-discover
    // (4×/day at :17 past 00/06/12/18 UTC). Same staleness budget: if it
    // hasn't logged in 10h, either the GH workflow stopped or the step is
    // erroring before logCronRun fires. Remediation re-pokes the route
    // with a single small batch so we get fresh telemetry without
    // overwhelming the function budget.
    task: "news.prewarmImagesV4",
    staleAfterHours: 10,
    allowRepeatedPartial: true,
    remediation: {
      label: "Relance prewarm images V4",
      method: "POST",
      path: "/api/admin/news/prewarm-images-v4?limit=4",
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
    task: "streaming",
    staleAfterHours: 192,
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

  if (issues.length === 0) {
    return ["Rien a faire. Le superviseur n'a detecte aucune anomalie."]
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
    return lines.join("\n")
  }

  const failedActions = actions.filter((action) => !action.ok)
  const unresolved = issues.filter((issue) => !actions.some((action) => action.task === issue.task && action.ok))
  const decision =
    failedActions.length > 0
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

  return lines.filter(Boolean).join("\n")
}

export async function runCronSupervisor(params: { forceEmail?: boolean } = {}): Promise<CronSupervisorResult> {
  const since = new Date(Date.now() - 9 * 24 * 3_600_000)
  const logs = await prisma.cronLog.findMany({
    where: { createdAt: { gte: since } },
    orderBy: { createdAt: "desc" },
    take: 300,
  })

  const recentLogs: RecentLog[] = logs.map((log) => ({
    task: log.task,
    status: log.status as CronStatus,
    summary: log.summary ?? "",
    createdAt: log.createdAt,
  }))

  const issues = detectIssues(recentLogs)
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
    await sendCronSupervisorDigest({
      subject:
        issues.length === 0
          ? "Superviseur Totem — tout est OK"
          : `Superviseur Totem — ${issues.length} anomalie${issues.length > 1 ? "s" : ""}`,
      report,
    })
  }

  return { issues, actions, report, emailSent }
}
