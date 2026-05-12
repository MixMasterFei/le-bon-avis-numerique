import { prisma } from "@/lib/prisma"
import { fetchAdminKpis } from "@/lib/admin-kpis"
import { sendDebtDigest } from "@/lib/email"

/**
 * Weekly "technical & data debt" digest.
 *
 * The cron supervisor (daily) tells you when a *job* broke. This agent
 * answers the slower question: where is the site quietly accumulating
 * debt regardless of whether any job failed — catalog rows that never
 * got enriched, items with no poster or no age rating, low-quality
 * fiches, an editorial queue that's piling up, cron tasks that are
 * limping rather than dead.
 *
 * It's read-only: it gathers, ranks, and emails. Nothing is mutated.
 * Most of the data comes straight from `fetchAdminKpis` (same numbers
 * the admin dashboard shows) plus a few debt-specific counts.
 */

// Per-task "this should have run by now" windows, in hours. Mirrors the
// cadences in .github/workflows/cron.yml with slack for GH Actions
// runner congestion. Anything not listed defaults to a week.
const CRON_STALE_HOURS: Record<string, number> = {
  import: 40,
  "import-games": 40,
  enrich: 40,
  "enrich-deep": 40,
  quality: 40,
  "news-discover": 12,
  "cron-supervisor": 30,
  heartbeat: 50,
  "weekly-dossier": 100,
  "family-content-agent": 200,
  "debt-digest": 200,
  "backfill-ratings": 220,
  streaming: 220,
  similarity: 220,
}

type CronVerdict = {
  task: string
  lastRunIso: string | null
  lastStatus: string | null
  ageHours: number | null
  state: "ok" | "stale" | "error" | "never" | "limping"
}

export type DebtDigestResult = {
  report: string
  emailSent: boolean
  cronProblems: number
  catalogUnenriched: number
}

function hoursSince(d: Date): number {
  return (Date.now() - d.getTime()) / 3_600_000
}

function classifyCron(task: string, lastRun: Date | null, lastStatus: string | null, errors7d: number): CronVerdict {
  if (!lastRun) {
    return { task, lastRunIso: null, lastStatus, ageHours: null, state: "never" }
  }
  const ageHours = hoursSince(lastRun)
  const window = CRON_STALE_HOURS[task] ?? 24 * 7
  let state: CronVerdict["state"] = "ok"
  if (lastStatus === "error") state = "error"
  else if (ageHours > window) state = "stale"
  else if (errors7d >= 3) state = "limping"
  return { task, lastRunIso: lastRun.toISOString(), lastStatus, ageHours, state }
}

export async function runDebtDigest(opts: { email?: boolean } = {}): Promise<DebtDigestResult> {
  const kpis = await fetchAdminKpis()

  // MANGA is out of scope (its pipeline was retired May 2026), so don't
  // count its rows as actionable debt — it would just be permanent noise.
  const VIDEO = ["MOVIE", "TV"] as const
  const SCOPED_NOT = { notIn: ["MANGA"] as ("MANGA")[] }

  // Debt-specific catalog counts not surfaced by fetchAdminKpis.
  const ninetyDaysAgo = new Date(Date.now() - 90 * 24 * 3_600_000)
  const [
    missingPoster,
    missingAgeRecVideo,
    lowQuality,
    staleVerified,
    noTopics,
  ] = await Promise.all([
    prisma.mediaItem.count({ where: { posterUrl: null, type: SCOPED_NOT } }),
    prisma.mediaItem.count({ where: { expertAgeRec: null, type: { in: [...VIDEO] } } }),
    prisma.mediaItem.count({ where: { dataQualityScore: { lt: 30 }, type: SCOPED_NOT } }),
    prisma.mediaItem.count({
      where: {
        type: { in: [...VIDEO] },
        OR: [{ lastVerifiedAt: null }, { lastVerifiedAt: { lt: ninetyDaysAgo } }],
      },
    }),
    prisma.mediaItem.count({ where: { isEnriched: true, topics: { isEmpty: true }, type: SCOPED_NOT } }).catch(() => 0),
  ])

  // Unenriched, MANGA excluded — recompute from the per-type breakdown.
  const unenrichedByTypeScoped = kpis.catalogUnenrichedByType.filter((r) => r.type !== "MANGA")
  const catalogUnenrichedScoped = unenrichedByTypeScoped.reduce((s, r) => s + r.count, 0)

  // Only tasks with a known cadence get a health verdict; anything else
  // (admin-triggered maintenance like news-rebuild / streaming-cache) is
  // listed for context but never flagged "stale".
  const allVerdicts = kpis.cronTasks
    .map((t) => classifyCron(t.task, t.lastRun, t.lastStatus, t.errors7d))
    .sort((a, b) => {
      const rank = { error: 0, never: 1, stale: 2, limping: 3, ok: 4 } as const
      return rank[a.state] - rank[b.state]
    })
  const cronVerdicts = allVerdicts.filter((v) => v.task in CRON_STALE_HOURS)
  const adHocTasks = allVerdicts.filter((v) => !(v.task in CRON_STALE_HOURS))
  const cronProblems = cronVerdicts.filter((v) => v.state !== "ok").length

  const actionQueueTotal =
    kpis.correctionsPending + kpis.requestsPending + kpis.newsReportsPending + kpis.disagreedAgeItems

  // ── Build the report ────────────────────────────────────────────
  const L: string[] = []
  L.push("# Dette technique & données — Totem Avisé", "", `Date : ${new Date().toISOString()}`, "")

  L.push("## Lecture rapide", "")
  L.push(`- Jobs automatiques en souffrance : ${cronProblems}/${cronVerdicts.length}`)
  L.push(`- Catalogue à enrichir : ${catalogUnenrichedScoped}/${kpis.catalogTotal} (hors manga)`)
  L.push(`- Fiches sans affiche : ${missingPoster} · sans âge conseillé (films/séries) : ${missingAgeRecVideo}`)
  L.push(`- Fiches qualité < 30 : ${lowQuality} · non revérifiées > 90j : ${staleVerified}`)
  L.push(`- File éditoriale en attente : ${actionQueueTotal}`)
  L.push("")

  L.push(`## Jobs automatiques (${cronVerdicts.length})`, "")
  for (const v of cronVerdicts) {
    const badge =
      v.state === "ok" ? "OK   " :
      v.state === "limping" ? "FAIBLE" :
      v.state === "stale" ? "RETARD" :
      v.state === "never" ? "JAMAIS" : "ERREUR"
    const age = v.ageHours === null ? "—" : `${Math.round(v.ageHours)}h`
    L.push(`- [${badge}] ${v.task.padEnd(22)} dernier: ${age}  (${v.lastStatus ?? "n/a"})`)
  }
  if (cronProblems === 0) L.push("", "Tous les jobs surveillés ont tourné dans leur fenêtre attendue.")
  if (adHocTasks.length) {
    L.push("", `Tâches ad hoc (manuelles, non programmées) : ${adHocTasks.map((t) => `${t.task} ${t.ageHours === null ? "—" : Math.round(t.ageHours) + "h"}`).join(" · ")}`)
  }
  L.push("")

  L.push("## Dette catalogue (hors manga)", "")
  L.push(`- À enrichir : ${catalogUnenrichedScoped}`)
  if (unenrichedByTypeScoped.length) {
    for (const row of unenrichedByTypeScoped) {
      L.push(`  · ${row.type}: ${row.count}`)
    }
  }
  L.push(`- Sans affiche : ${missingPoster}`)
  L.push(`- Films/séries sans âge conseillé : ${missingAgeRecVideo}`)
  L.push(`- Score de complétude < 30 : ${lowQuality}`)
  L.push(`- Non revérifiées depuis > 90 jours : ${staleVerified}`)
  L.push(`- Enrichies mais sans topics : ${noTopics}`)
  L.push("")

  L.push("## File éditoriale", "")
  L.push(`- Corrections en attente : ${kpis.correctionsPending}`)
  L.push(`- Demandes de contenu : ${kpis.requestsPending}`)
  L.push(`- Signalements commentaires news : ${kpis.newsReportsPending}`)
  L.push(`- Désaccords communautaires sur l'âge : ${kpis.disagreedAgeItems}`)
  L.push("")

  L.push("## Action pour toi", "")
  const todo: string[] = []
  if (cronVerdicts.some((v) => v.state === "error" || v.state === "never")) {
    todo.push("Un job est en erreur / n'a jamais tourné — voir /admin/operations et le mail superviseur du jour.")
  }
  if (catalogUnenrichedScoped > 800) {
    todo.push(`Stock d'enrichissement élevé (${catalogUnenrichedScoped}) — laisser tourner, ou lancer un batch manuel /admin/operations si urgent.`)
  }
  if (missingAgeRecVideo > 300) {
    todo.push(`${missingAgeRecVideo} films/séries sans âge conseillé — vérifier l'import CNC + l'enrichissement.`)
  }
  if (actionQueueTotal > 0) {
    todo.push(`${actionQueueTotal} éléments dans la file éditoriale à traiter dans /admin.`)
  }
  if (todo.length === 0) todo.push("Rien d'urgent. La dette est sous contrôle cette semaine.")
  for (const t of todo) L.push(`- ${t}`)
  L.push("")

  L.push("## Action pour l'agent", "")
  const agentTodo: string[] = []
  if (cronProblems > 0) {
    agentTodo.push("Diagnostiquer chaque job marqué RETARD/ERREUR/JAMAIS ci-dessus (cause racine, pas seulement re-lancer).")
  }
  if (lowQuality > 200) {
    agentTodo.push(`Investiguer les ${lowQuality} fiches qualité < 30 : import incomplet ? enrichissement raté ? source à exclure ?`)
  }
  if (noTopics > 100) {
    agentTodo.push(`Vérifier pourquoi ${noTopics} fiches enrichies n'ont aucun topic (bug d'enrichissement ?).`)
  }
  if (agentTodo.length === 0) agentTodo.push("Rien à corriger côté code cette semaine.")
  for (const t of agentTodo) L.push(`- ${t}`)

  const report = L.join("\n")

  let emailSent = false
  if (opts.email !== false) {
    await sendDebtDigest({
      subject: cronProblems > 0
        ? `Dette Totem — ${cronProblems} job${cronProblems > 1 ? "s" : ""} en souffrance, ${catalogUnenrichedScoped} à enrichir`
        : `Dette Totem — RAS jobs, ${catalogUnenrichedScoped} à enrichir, ${actionQueueTotal} en file`,
      report,
    })
    emailSent = true
  }

  return { report, emailSent, cronProblems, catalogUnenriched: catalogUnenrichedScoped }
}
