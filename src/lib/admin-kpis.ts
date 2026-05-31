import { prisma } from "@/lib/prisma"
import type { ReactionType } from "@prisma/client"

const MS_PER_DAY = 24 * 60 * 60 * 1000

export interface CronTaskHealth {
  task: string
  lastRun: Date | null
  lastStatus: "success" | "error" | "partial" | null
  errors7d: number
}

export interface DailyGrowthPoint {
  day: string // ISO date YYYY-MM-DD
  users: number
  families: number
}

export interface UnenrichedByType {
  type: string  // MediaType: MOVIE | TV | GAME | BOOK | MANGA
  count: number
}

export interface AdminKpis {
  // Catalog
  catalogTotal: number
  catalogUnenriched: number
  // Drilldown for the dashboard's "œuvres à enrichir" stat — was a single
  // opaque number ("1069 to enhance") with no way to tell which formats
  // are responsible. Surfaced as inline rows so the user knows whether
  // it's a movies issue, a manga issue, etc., before clicking through.
  catalogUnenrichedByType: UnenrichedByType[]

  // Growth — this week / last week / month
  usersWeek: number
  usersPrevWeek: number
  usersMonth: number
  familiesTotal: number // distinct userIds in FamilyMember
  familiesCompleteThree: number // userIds with >=3 FamilyMember rows

  // Engagement with WoW deltas
  reactionsWeek: number
  reactionsPrevWeek: number
  reactionsByType: Array<{ reaction: ReactionType; count: number }>
  reviewsWeek: number
  reviewsPrevWeek: number
  ageVotesWeek: number
  ageVotesPrevWeek: number
  recoClicksWeek: number
  recoClicksPrevWeek: number

  // Action queue
  correctionsPending: number
  requestsPending: number
  newsReportsPending: number
  disagreedAgeItems: number

  // 30-day time series for the growth chart
  dailyGrowth: DailyGrowthPoint[]

  // System health
  cronTasks: CronTaskHealth[]
  cronErrors7d: number

  // Freshness marker
  generatedAt: Date
}

/** JSON-safe cron task row for client admin views. */
export type SerializedCronTask = Omit<CronTaskHealth, "lastRun"> & { lastRun: string | null }

/** JSON-safe shape for passing KPIs from server components to client views. */
export type SerializedAdminKpis = Omit<AdminKpis, "generatedAt" | "cronTasks"> & {
  generatedAt: string
  cronTasks: SerializedCronTask[]
}

export function serializeAdminKpis(kpis: AdminKpis): SerializedAdminKpis {
  return {
    ...kpis,
    generatedAt: kpis.generatedAt.toISOString(),
    cronTasks: kpis.cronTasks.map((t) => ({
      ...t,
      lastRun: t.lastRun?.toISOString() ?? null,
    })),
  }
}

function daysAgo(n: number): Date {
  return new Date(Date.now() - n * MS_PER_DAY)
}

// Known cron tasks — any new cron should be added here so it shows up in
// the dashboard's task-health strip even before its first run.
const KNOWN_CRON_TASKS = [
  "import",
  "import-games",   // Daily — IGDB recent + popular, popularity-floored
  "enrich",
  "enrich-deep",
  "quality",
  "backfill-ratings",
  "streaming",
  "similarity",
  "news-discover",
  "news.prewarmImagesV4",   // 4×/day — V4 image prewarm runs after news-discover
  "news.pressKitScout",     // 4×/day — detects official press-kit candidates from news brands
  "weekly-dossier",         // Tue + Fri — long-read synthesis
  "family-content-agent",   // Monday — editorial priorities email
  "debt-digest",            // Wednesday — tech/data-debt weekly digest
  "seo-striking-distance",  // Thursday — GSC striking-distance opportunities
  "cron-supervisor",        // Daily — health check + remediation digest
  "heartbeat",              // Daily — Vercel-Cron watchdog for the GH Actions pipeline
]

export async function fetchAdminKpis(): Promise<AdminKpis> {
  const now = new Date()
  const week = daysAgo(7)
  const prevWeekStart = daysAgo(14)
  const month = daysAgo(30)

  const [
    catalogTotal,
    catalogUnenriched,
    catalogUnenrichedByTypeRaw,

    usersWeek,
    usersPrevWeek,
    usersMonth,

    familiesGrouped,

    reactionsWeek,
    reactionsPrevWeek,
    reactionsByTypeRaw,

    reviewsWeek,
    reviewsPrevWeek,

    ageVotesWeek,
    ageVotesPrevWeek,

    recoClicksWeek,
    recoClicksPrevWeek,

    correctionsPending,
    requestsPending,
    newsReportsPending,

    disagreedAgeItems,

    dailyGrowth,

    cronRuns,
    cronErrors7d,
  ] = await Promise.all([
    prisma.mediaItem.count(),
    prisma.mediaItem.count({ where: { isEnriched: false } }),
    prisma.mediaItem.groupBy({
      by: ["type"],
      _count: { _all: true },
      where: { isEnriched: false },
    }),

    // User + FamilyMember + MediaReaction + Review + CronLog + MediaItem
    // are core tables and assumed to exist. Everything else (ageVote,
    // recoClick, mediaCorrection, contentRequest, newsCommentReport) was
    // added later and may not exist on every environment — wrap each in
    // .catch so one missing table doesn't tank the whole dashboard.
    prisma.user.count({ where: { createdAt: { gte: week } } }),
    prisma.user.count({ where: { createdAt: { gte: prevWeekStart, lt: week } } }),
    prisma.user.count({ where: { createdAt: { gte: month } } }),

    prisma.familyMember.groupBy({
      by: ["userId"],
      _count: { _all: true },
    }),

    // Admin engagement KPIs — organic only (quiz anchors are declared intent,
    // not actual reactions to content). Without the filter, a heavy quiz week
    // would inflate the engagement chart.
    prisma.mediaReaction.count({ where: { createdAt: { gte: week }, source: "organic" } }),
    prisma.mediaReaction.count({ where: { createdAt: { gte: prevWeekStart, lt: week }, source: "organic" } }),
    prisma.mediaReaction.groupBy({
      by: ["reaction"],
      _count: { _all: true },
      where: { createdAt: { gte: week }, source: "organic" },
    }),

    prisma.review.count({ where: { createdAt: { gte: week } } }),
    prisma.review.count({ where: { createdAt: { gte: prevWeekStart, lt: week } } }),

    prisma.ageVote.count({ where: { createdAt: { gte: week } } }).catch(() => 0),
    prisma.ageVote.count({ where: { createdAt: { gte: prevWeekStart, lt: week } } }).catch(() => 0),

    prisma.recoClick.count({ where: { createdAt: { gte: week } } }).catch(() => 0),
    prisma.recoClick.count({ where: { createdAt: { gte: prevWeekStart, lt: week } } }).catch(() => 0),

    prisma.mediaCorrection.count({ where: { status: "PENDING" } }).catch(() => 0),
    prisma.contentRequest.count({ where: { status: "PENDING" } }).catch(() => 0),
    prisma.newsCommentReport.count({ where: { status: "PENDING" } }).catch(() => 0),

    countDisagreedAgeItems().catch(() => 0),

    fetchDailyGrowth(month).catch(() => [] as DailyGrowthPoint[]),

    fetchCronRuns(week).catch(() => [] as CronRunRow[]),
    prisma.cronLog.count({ where: { status: "error", createdAt: { gte: week } } }).catch(() => 0),
  ])

  const familiesTotal = familiesGrouped.length
  const familiesCompleteThree = familiesGrouped.filter((g) => g._count._all >= 3).length

  const reactionsByType = reactionsByTypeRaw.map((r) => ({
    reaction: r.reaction,
    count: r._count._all,
  }))

  // cronRuns is latest-per-task; merge with KNOWN_CRON_TASKS to cover silent tasks
  const taskMap = new Map<string, CronTaskHealth>()
  for (const t of KNOWN_CRON_TASKS) {
    taskMap.set(t, { task: t, lastRun: null, lastStatus: null, errors7d: 0 })
  }
  for (const run of cronRuns) {
    taskMap.set(run.task, {
      task: run.task,
      lastRun: run.lastRun,
      lastStatus: run.lastStatus,
      errors7d: run.errors7d,
    })
  }

  // Sort largest-first so the dashboard stockpile leads with the most
  // pressing format. Type names are stringified to match the inline
  // rows on EnrichmentStockpile (which is type-agnostic).
  const catalogUnenrichedByType: UnenrichedByType[] = catalogUnenrichedByTypeRaw
    .map((row) => ({ type: String(row.type), count: row._count._all }))
    .sort((a, b) => b.count - a.count)

  return {
    catalogTotal,
    catalogUnenriched,
    catalogUnenrichedByType,
    usersWeek,
    usersPrevWeek,
    usersMonth,
    familiesTotal,
    familiesCompleteThree,
    reactionsWeek,
    reactionsPrevWeek,
    reactionsByType,
    reviewsWeek,
    reviewsPrevWeek,
    ageVotesWeek,
    ageVotesPrevWeek,
    recoClicksWeek,
    recoClicksPrevWeek,
    correctionsPending,
    requestsPending,
    newsReportsPending,
    disagreedAgeItems,
    dailyGrowth,
    cronTasks: Array.from(taskMap.values()),
    cronErrors7d,
    generatedAt: now,
  }
}

/**
 * Counts media items where the community is actively pushing back on
 * the automated age recommendation: ≥ 5 votes cast AND fewer than 50 %
 * agree. Powers the "Désaccords communautaires" tile in
 * AdminActionQueue — each item there needs a human eyeball (re-enrich
 * or manual override).
 */
async function countDisagreedAgeItems(): Promise<number> {
  // Fetch agree/disagree breakdown per media in one grouped query.
  const rows = await prisma.ageVote.groupBy({
    by: ["mediaId", "agree"],
    _count: { _all: true },
  })

  // Aggregate by mediaId in JS — cheaper than a raw SQL pivot for the
  // vote volume we realistically have.
  const byMedia = new Map<string, { total: number; agrees: number }>()
  for (const r of rows) {
    const cur = byMedia.get(r.mediaId) ?? { total: 0, agrees: 0 }
    cur.total += r._count._all
    if (r.agree) cur.agrees += r._count._all
    byMedia.set(r.mediaId, cur)
  }

  let count = 0
  for (const { total, agrees } of byMedia.values()) {
    if (total >= 5 && agrees / total < 0.5) count++
  }
  return count
}

interface DailyRow {
  day: Date
  count: bigint
}

/**
 * Returns users + families (distinct userId) signed up per day over the
 * last `since` window. Gaps (days with no signups) are filled with zeros
 * so the chart draws a continuous line.
 */
async function fetchDailyGrowth(since: Date): Promise<DailyGrowthPoint[]> {
  const userRows = await prisma.$queryRaw<DailyRow[]>`
    SELECT date_trunc('day', "created_at") AS day, COUNT(*)::bigint AS count
    FROM "users"
    WHERE "created_at" >= ${since}
    GROUP BY day
    ORDER BY day ASC
  `
  const familyRows = await prisma.$queryRaw<DailyRow[]>`
    SELECT date_trunc('day', MIN("created_at")) AS day, COUNT(*)::bigint AS count
    FROM (
      SELECT "user_id", MIN("created_at") AS "created_at"
      FROM "family_members"
      WHERE "created_at" >= ${since}
      GROUP BY "user_id"
    ) first_member
    GROUP BY day
    ORDER BY day ASC
  `

  const toKey = (d: Date) => d.toISOString().slice(0, 10)
  const userMap = new Map(userRows.map((r) => [toKey(r.day), Number(r.count)]))
  const familyMap = new Map(familyRows.map((r) => [toKey(r.day), Number(r.count)]))

  const points: DailyGrowthPoint[] = []
  for (let i = 29; i >= 0; i--) {
    const d = daysAgo(i)
    const key = toKey(d)
    points.push({
      day: key,
      users: userMap.get(key) ?? 0,
      families: familyMap.get(key) ?? 0,
    })
  }
  return points
}

interface CronRunRow {
  task: string
  lastRun: Date
  lastStatus: "success" | "error" | "partial"
  errors7d: number
}

/**
 * For each task in cron_logs, return the most recent run + its status
 * and a 7-day error count. One raw query keeps Prisma from pulling every
 * row into memory.
 */
async function fetchCronRuns(weekAgo: Date): Promise<CronRunRow[]> {
  const rows = await prisma.$queryRaw<
    Array<{ task: string; last_run: Date; last_status: string; errors_7d: bigint }>
  >`
    SELECT
      task,
      MAX("created_at") AS last_run,
      (SELECT status FROM "cron_logs" c2
        WHERE c2.task = c1.task
        ORDER BY c2."created_at" DESC LIMIT 1) AS last_status,
      SUM(CASE WHEN status = 'error' AND "created_at" >= ${weekAgo} THEN 1 ELSE 0 END)::bigint AS errors_7d
    FROM "cron_logs" c1
    GROUP BY task
  `
  return rows.map((r) => ({
    task: r.task,
    lastRun: r.last_run,
    lastStatus:
      r.last_status === "success" || r.last_status === "error" || r.last_status === "partial"
        ? r.last_status
        : "success",
    errors7d: Number(r.errors_7d),
  }))
}
