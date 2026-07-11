import { prisma } from "@/lib/prisma"
import { fetchAdminKpis } from "@/lib/admin-kpis"
import { sendDebtDigest } from "@/lib/email"
import { withVerdict } from "@/lib/agent-verdict"
import { runExpectationChecks } from "@/lib/expectations"

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
  "seo-striking-distance": 200,
  "backfill-ratings": 220,
  streaming: 220,
  similarity: 220,
  "age-floor": 220,
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
  /** Number of "invariant" expectations currently broken (should be 0). */
  expectationFailures: number
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
    // "Enriched but no topics" — but only count age <14 (or unrated)
    // titles. A 14+/16+/18 film legitimately gets no topic tags: the
    // enrichment vocabulary (VALID_TOPICS in api/admin/enrich) is the
    // kid/family one — "Animation, Famille, Éducatif, Magie, Dinosaures,
    // École…" — so a violent thriller or erotic drama's tags all get
    // filtered to []. That's the *correct* state for a family guide,
    // not debt. The ~120 mature titles TMDB's popular feed dragged in
    // would otherwise nag here forever.
    prisma.mediaItem
      .count({
        where: {
          isEnriched: true,
          topics: { isEmpty: true },
          type: SCOPED_NOT,
          OR: [{ expertAgeRec: null }, { expertAgeRec: { lt: 14 } }],
        },
      })
      .catch(() => 0),
  ])

  // ── Rating-quality audit (trust watchdog) ──────────────────────────
  // The site's value is the trustworthiness of its ratings, so we surface
  // structural rating problems the other sections don't catch. All deterministic
  // (no LLM). The recalibrate cron drains `ratingOverScored`; a non-zero
  // `ratingIncoherentYoung` is a regression (should stay ~0 post-backfill).
  const SENS = ["violence", "sexNudity", "language", "substanceUse"] as const
  const [
    ratingIncoherentYoung,
    ratingOverScored,
    ratingAllZero,
    ratingLowConfidence,
    ratingDocViolent,
    ratingMetricsMismatch,
    ratingBelowFloor,
  ] = await Promise.all([
    // ≤8 curated but a sensibility axis still ≥3 — the display anchor + backfill
    // should keep this at 0; if not, something re-inflated young titles.
    prisma.mediaItem.count({
      where: {
        isEnriched: true, type: SCOPED_NOT, expertAgeRec: { not: null, lte: 8 },
        contentMetrics: { OR: SENS.map((k) => ({ [k]: { gte: 3 } })) },
      },
    }).catch(() => 0),
    // Over-scored cluster the recalibrate cron drains: young (≤10) OR
    // animation/family titles with an axis ≥4 (legit 12+ live-action violence
    // is excluded). Not-yet-recalibrated only. Trends to ~0 as the sweep runs.
    prisma.mediaItem.count({
      where: {
        isEnriched: true, type: SCOPED_NOT,
        NOT: { contentMetrics: { enrichmentSource: "AI_RECAL" } },
        AND: [
          { OR: [{ expertAgeRec: { not: null, lte: 10 } }, { genres: { hasSome: ["Animation", "Familial", "Family"] } }] },
          { contentMetrics: { OR: SENS.map((k) => ({ [k]: { gte: 4 } })) } },
        ],
      },
    }).catch(() => 0),
    // Enriched video with every sensibility axis 0 — likely a failed/empty pass.
    prisma.mediaItem.count({
      where: {
        isEnriched: true, type: { in: [...VIDEO] },
        contentMetrics: { is: { violence: 0, sexNudity: 0, language: 0, substanceUse: 0 } },
      },
    }).catch(() => 0),
    // Enriched but low-confidence scores (excludes legacy null = "non noté").
    prisma.mediaItem.count({
      where: {
        isEnriched: true, type: SCOPED_NOT,
        contentMetrics: { is: { enrichmentConfidence: { lt: 0.6, not: null } } },
      },
    }).catch(() => 0),
    // Genre sanity: documentaries flagged very violent (usually real, but spot-check).
    prisma.mediaItem.count({
      where: {
        isEnriched: true, genres: { hasSome: ["Documentaire", "Documentary"] },
        contentMetrics: { is: { violence: { gte: 4 } } },
      },
    }).catch(() => 0),
    // Rating/metrics mismatch: an official 16/18 classification but implausibly
    // low content metrics (violence AND sexNudity ≤2). Almost always a WRONG
    // officialRating in the source data (e.g. a children's cartoon tagged
    // CSA_16), which dents fiche credibility. NOT auto-fixed — auto-clamping
    // would encode the bad rating into the metrics; a human should recheck.
    prisma.mediaItem.count({
      where: {
        officialRating: { in: ["CSA_16", "CSA_18", "PEGI_16", "PEGI_18"] },
        contentMetrics: { is: { violence: { lte: 2 }, sexNudity: { lte: 2 } } },
      },
    }).catch(() => 0),
    // Below the deterministic age floor: horror-tagged titles still under 14.
    // The weekly Saturday age-floor sweep drains this to ~0, so a non-zero
    // value means drift crept in since the last run (a new import, a manual
    // edit, a dedupe merge) — the exact class of the 2026-07-11 incident.
    prisma.mediaItem.count({
      where: {
        isEnriched: true, type: SCOPED_NOT,
        expertAgeRec: { not: null, lt: 14 },
        topics: { hasSome: ["Horreur", "Horror"] },
      },
    }).catch(() => 0),
  ])

  // Unenriched, MANGA excluded — recompute from the per-type breakdown.
  const unenrichedByTypeScoped = kpis.catalogUnenrichedByType.filter((r) => r.type !== "MANGA")
  const catalogUnenrichedScoped = unenrichedByTypeScoped.reduce((s, r) => s + r.count, 0)

  // ── Content-safety net ──────────────────────────────────────────────
  // The import guard (src/lib/adult-content-filter) keeps hentai/eroge/porn
  // out at the source, but scan the live catalogue too so anything that ever
  // slips past surfaces here instead of needing a manual audit. Expected: 0.
  const adultWhere = {
    OR: [
      { genres: { hasSome: ["Hentai", "Ecchi"] } },
      { title: { contains: "hentai", mode: "insensitive" as const } },
      { title: { contains: "eroge", mode: "insensitive" as const } },
      { synopsisFr: { contains: "sexuellement explicite", mode: "insensitive" as const } },
      { synopsisFr: { contains: "pornographique", mode: "insensitive" as const } },
    ],
  }
  const adultFlagged = await prisma.mediaItem.findMany({
    where: adultWhere,
    select: { title: true, type: true, expertAgeRec: true },
    take: 12,
    orderBy: { createdAt: "desc" },
  }).catch(() => [] as { title: string; type: string; expertAgeRec: number | null }[])
  const adultFlaggedCount = adultFlagged.length

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
  L.push(`- Contenu adulte détecté (doit rester 0) : ${adultFlaggedCount}${adultFlaggedCount > 0 ? " ⚠️" : ""}`)
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
  L.push(`- Enrichies mais sans topics (jeunesse, hors titres 14+) : ${noTopics}`)
  L.push("")

  if (adultFlaggedCount > 0) {
    L.push("## ⚠️ Contenu adulte à retirer", "")
    L.push(`Le garde-fou d'import laisse normalement 0 — ${adultFlaggedCount} fiche(s) à vérifier/supprimer :`)
    for (const it of adultFlagged) {
      L.push(`- [${it.type} ${it.expertAgeRec ?? "?"}a] ${it.title}`)
    }
    L.push("")
  }

  L.push("## Qualité des notations (confiance du site)", "")
  L.push(`- ⚠ Jeunesse (≤8) avec un axe sensibilité ≥3 — devrait être 0 : ${ratingIncoherentYoung}`)
  L.push(`- Sur-notées (≤12 avec un axe ≥4) — drainées par la recalibration : ${ratingOverScored}`)
  L.push(`- Vidéos enrichies tout à 0 (passe ratée probable) : ${ratingAllZero}`)
  L.push(`- Notations à faible confiance (< 0,6) : ${ratingLowConfidence}`)
  L.push(`- Documentaires notés très violents (à vérifier) : ${ratingDocViolent}`)
  L.push(`- Classification 16/18 mais métriques faibles (rating source probablement erroné, à revérifier — PAS de correction auto) : ${ratingMetricsMismatch}`)
  L.push(`- ⚠ Sous le plancher d'âge (titres « Horreur » encore < 14) — devrait être ~0, drainé chaque samedi : ${ratingBelowFloor}${ratingBelowFloor > 0 ? " ⚠️" : ""}`)
  L.push("")

  // ── Conformité aux attentes (oracle pur, sans DB) ──────────────────
  // Same registry the CI test asserts. CI already blocks a regression on a
  // PR; this surfaces it in the weekly mail too (e.g. if someone bypassed CI,
  // or for the "report"-level soft expectations that CI deliberately doesn't
  // fail on).
  const expectationResults = runExpectationChecks()
  const invariantFailures = expectationResults.filter((r) => r.severity === "invariant" && !r.ok)
  const reportDivergences = expectationResults.filter((r) => r.severity === "report" && !r.ok)

  L.push("## Conformité aux attentes", "")
  if (invariantFailures.length === 0 && reportDivergences.length === 0) {
    L.push(`Toutes les attentes vérifiées sont respectées (${expectationResults.length} contrôles).`)
  } else {
    for (const r of invariantFailures) {
      L.push(`- [INVARIANT] ${r.label} — ${r.detail}`)
    }
    for (const r of reportDivergences) {
      L.push(`- [À DÉCIDER] ${r.label} — ${r.detail}`)
    }
  }
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
  if (invariantFailures.length > 0) {
    todo.push(`${invariantFailures.length} attente(s) du site rompue(s) — voir "Conformité aux attentes" ci-dessus (régression, CI a peut-être été contournée).`)
  }
  if (reportDivergences.length > 0) {
    todo.push(`${reportDivergences.length} attente(s) "à décider" — arbitrage à faire (cf. section conformité).`)
  }
  if (todo.length === 0) todo.push("Rien d'urgent. La dette est sous contrôle cette semaine.")
  for (const t of todo) L.push(`- ${t}`)
  L.push("")

  L.push("## Action pour l'agent", "")
  const agentTodo: string[] = []
  if (invariantFailures.length > 0) {
    agentTodo.push(`RÉGRESSION attentes : ${invariantFailures.map((r) => r.id).join(", ")} — corriger la constante ou le test (src/lib/expectations.ts) après décision.`)
  }
  if (adultFlaggedCount > 0) {
    agentTodo.push(`URGENT contenu adulte : ${adultFlaggedCount} fiche(s) hentai/eroge/porno ont passé le garde-fou — vérifier et supprimer (cf. section dédiée), puis renforcer src/lib/adult-content-filter.`)
  }
  if (cronProblems > 0) {
    agentTodo.push("Diagnostiquer chaque job marqué RETARD/ERREUR/JAMAIS ci-dessus (cause racine, pas seulement re-lancer).")
  }
  if (lowQuality > 200) {
    agentTodo.push(`Investiguer les ${lowQuality} fiches qualité < 30 : import incomplet ? enrichissement raté ? source à exclure ?`)
  }
  if (noTopics > 20) {
    agentTodo.push(`Vérifier pourquoi ${noTopics} fiches jeunesse enrichies n'ont aucun topic (re-enrichissement à lancer ? vocabulaire trop étroit ?).`)
  }
  if (ratingIncoherentYoung > 0) {
    agentTodo.push(`RÉGRESSION notations : ${ratingIncoherentYoung} fiches ≤8 ans portent un axe sensibilité ≥3 — relancer scripts/recalibrate-young-ratings.ts + vérifier le garde-fou clampMetricsByAge.`)
  }
  if (ratingAllZero > 50) {
    agentTodo.push(`${ratingAllZero} vidéos enrichies ont toutes leurs métriques à 0 — passes ratées probables, à recalibrer (task=recalibrate-ratings).`)
  }
  if (ratingBelowFloor > 0) {
    agentTodo.push(`SÉCURITÉ : ${ratingBelowFloor} titre(s) « Horreur » sous 14 ans — relancer le sweep age-floor (task=age-floor) et vérifier d'où vient la dérive (import/dedupe/édition manuelle).`)
  }
  if (agentTodo.length === 0) agentTodo.push("Rien à corriger côté code cette semaine.")
  for (const t of agentTodo) L.push(`- ${t}`)

  // Verdict = "act this week" signal: jobs en souffrance + attentes rompues.
  // A broken invariant is a regression, so it counts even though catalogue debt
  // (slow-moving, informational) does not.
  const actionCount = cronProblems + invariantFailures.length
  const verdictTop =
    invariantFailures.length > 0
      ? `${invariantFailures.length} attente(s) du site rompue(s)${cronProblems > 0 ? ` + ${cronProblems} job(s) en souffrance` : ""}`
      : cronProblems > 0
        ? `${cronProblems} job(s) automatique(s) en souffrance`
        : undefined
  const report = withVerdict(L.join("\n"), {
    count: actionCount,
    kind: "action",
    top: verdictTop,
  })

  let emailSent = false
  if (opts.email !== false) {
    const expectationTag = invariantFailures.length > 0 ? `⚠ ${invariantFailures.length} attente(s) rompue(s) · ` : ""
    await sendDebtDigest({
      subject: cronProblems > 0
        ? `Dette Totem — ${expectationTag}${cronProblems} job${cronProblems > 1 ? "s" : ""} en souffrance, ${catalogUnenrichedScoped} à enrichir`
        : `Dette Totem — ${expectationTag}RAS jobs, ${catalogUnenrichedScoped} à enrichir, ${actionQueueTotal} en file`,
      report,
    })
    emailSent = true
  }

  return {
    report,
    emailSent,
    cronProblems,
    catalogUnenriched: catalogUnenrichedScoped,
    expectationFailures: invariantFailures.length,
  }
}
