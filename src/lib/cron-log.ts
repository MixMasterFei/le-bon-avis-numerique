import { prisma } from "@/lib/prisma"

/**
 * Log a cron/automated job execution to the database.
 * Call at the end of each automated route.
 */
export async function logCronRun(params: {
  task: string
  status: "success" | "error" | "partial"
  summary: string
  details?: Record<string, unknown>
  startTime: number // Date.now() at start
}) {
  try {
    await prisma.cronLog.create({
      data: {
        task: params.task,
        status: params.status,
        summary: params.summary,
        details: params.details ?? undefined,
        duration: Date.now() - params.startTime,
      },
    })
  } catch (e) {
    // Never let logging failures break the actual job
    console.error("Failed to log cron run:", e)
  }
}
