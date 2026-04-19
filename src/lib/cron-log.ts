import { prisma } from "@/lib/prisma"
import { type Prisma } from "@prisma/client"
import { sendCronFailureAlert } from "@/lib/email"

/**
 * Log a cron/automated job execution to the database.
 * Call at the end of each automated route. Sends an email alert
 * to the owner when status === "error".
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
        details: (params.details as Prisma.InputJsonValue) ?? undefined,
        duration: Date.now() - params.startTime,
      },
    })
  } catch (e) {
    // Never let logging failures break the actual job
    console.error("Failed to log cron run:", e)
  }

  if (params.status === "error") {
    // Fire-and-forget; the helper swallows send errors internally.
    await sendCronFailureAlert({
      task: params.task,
      summary: params.summary,
      details: params.details,
    })
  }
}
