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
const MAX_REMEDIATIONS = 3

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
    task: "weekly-dossier",
    staleAfterHours: 96,
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
    remediation: {
      label: "Relance similarité batch réduit",
      method: "POST",
      path: "/api/admin/similarity/compute",
      body: { mode: "full", limit: 3, offset: 0 },
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
    if (recentPartials >= 2) {
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

function buildReport(issues: Issue[], actions: ActionResult[]): string {
  const lines: string[] = [
    "# Superviseur Totem Avisé",
    "",
    `Date : ${new Date().toISOString()}`,
    "",
  ]

  if (issues.length === 0) {
    lines.push("Tout est OK. Aucune anomalie détectée sur les tâches surveillées.")
    return lines.join("\n")
  }

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

  const unresolved = issues.filter((issue) => !actions.some((action) => action.task === issue.task && action.ok))
  lines.push("", "## Action humaine")
  if (unresolved.length === 0) {
    lines.push("Aucune action requise pour le moment.")
  } else {
    lines.push("À vérifier :", ...unresolved.map((issue) => `- ${issue.task} : ${issue.summary}`))
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
