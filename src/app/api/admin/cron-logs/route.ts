import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"

// GET /api/admin/cron-logs?limit=30&task=import
export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url)
  const limit = Math.min(parseInt(searchParams.get("limit") || "30"), 100)
  const task = searchParams.get("task") // optional filter

  const where = task ? { task } : {}

  const [logs, taskStats] = await Promise.all([
    prisma.cronLog.findMany({
      where,
      orderBy: { createdAt: "desc" },
      take: limit,
    }),
    // Aggregate: last run per task + total runs + error count
    prisma.cronLog.groupBy({
      by: ["task"],
      _count: true,
      _max: { createdAt: true },
    }),
  ])

  // Calculate error rate per task (last 30 days)
  const thirtyDaysAgo = new Date()
  thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30)

  const errorCounts = await prisma.cronLog.groupBy({
    by: ["task"],
    where: {
      status: "error",
      createdAt: { gte: thirtyDaysAgo },
    },
    _count: true,
  })

  const totalCounts = await prisma.cronLog.groupBy({
    by: ["task"],
    where: { createdAt: { gte: thirtyDaysAgo } },
    _count: true,
  })

  const errorMap = new Map(errorCounts.map((e) => [e.task, e._count]))
  const totalMap = new Map(totalCounts.map((t) => [t.task, t._count]))

  const summary = taskStats.map((t) => ({
    task: t.task,
    totalRuns: t._count,
    lastRun: t._max.createdAt,
    last30Days: totalMap.get(t.task) || 0,
    errors30Days: errorMap.get(t.task) || 0,
  }))

  return NextResponse.json({ logs, summary })
}
