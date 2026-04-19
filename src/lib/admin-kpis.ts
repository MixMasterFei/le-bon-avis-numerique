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

export interface AdminKpis {
  // Catalog
  catalogTotal: number
  catalogUnenriched: number

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

  // 30-day time series for the growth chart
  dailyGrowth: DailyGrowthPoint[]

  // System health
  cronTasks: CronTaskHealth[]
  cronErrors7d: number

  // Freshness marker
  generatedAt: Date
}

function daysAgo(n: number): Date {
  return new Date(Date.now() - n * MS_PER_DAY)
}

// Known cron tasks — any new cron should be added here so it shows up in
// the dashboard's task-health strip even before its first run.
const KNOWN_CRON_TASKS = [
  "import",
  "enrich",
  "enrich-deep",
  "quality",
  "backfill-ratings",
  "streaming",
  "similarity",
  "news-discover",
]

export async function fetchAdminKpis(): Promise<AdminKpis> {
  const now = new Date()
  const week = daysAgo(7)
  const prevWeekStart = daysAgo(14)
  const month = daysAgo(30)

  const [
    catalogTotal,
    catalogUnenriched,

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

    dailyGrowth,

    cronRuns,
    cronErrors7d,
  ] = await Promise.all([
    prisma.mediaItem.count(),
    prisma.mediaItem.count({ where: { isEnriched: false } }),

    prisma.user.count({ where: { createdAt: { gte: week } } }),
    prisma.user.count({ where: { createdAt: { gte: prevWeekStart, lt: week } } }),
    prisma.user.count({ where: { createdAt: { gte: month } } }),

    prisma.familyMember.groupBy({
      by: ["userId"],
      _count: { _all: true },
    }),

    prisma.mediaReaction.count({ where: { createdAt: { gte: week } } }),
    prisma.mediaReaction.count({ where: { createdAt: { gte: prevWeekStart, lt: week } } }),
    prisma.mediaReaction.groupBy({
      by: ["reaction"],
      _count: { _all: true },
      where: { createdAt: { gte: week } },
    }),

    prisma.review.count({ where: { createdAt: { gte: week } } }),
    prisma.review.count({ where: { createdAt: { gte: prevWeekStart, lt: week } } }),

    prisma.ageVote.count({ where: { createdAt: { gte: week } } }),
    prisma.ageVote.count({ where: { createdAt: { gte: prevWeekStart, lt: week } } }),

    prisma.recoClick.count({ where: { createdAt: { gte: week } } }),
    prisma.recoClick.count({ where: { createdAt: { gte: prevWeekStart, lt: week } } }),

    prisma.mediaCorrection.count({ where: { status: "PENDING" } }),
    prisma.contentRequest.count({ where: { status: "PENDING" } }),
    // Table added in sql/add_news_comments.sql — if the migration hasn't
    // landed on this environment yet, fall back to 0 rather than failing
    // the whole dashboard (matches the `safeQuery` pattern documented in
    // CLAUDE.md for freshly-added admin tables).
    prisma.newsCommentReport.count({ where: { status: "PENDING" } }).catch(() => 0),

    fetchDailyGrowth(month),

    fetchCronRuns(week),
    prisma.cronLog.count({ where: { status: "error", createdAt: { gte: week } } }),
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

  return {
    catalogTotal,
    catalogUnenriched,
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
    dailyGrowth,
    cronTasks: Array.from(taskMap.values()),
    cronErrors7d,
    generatedAt: now,
  }
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
