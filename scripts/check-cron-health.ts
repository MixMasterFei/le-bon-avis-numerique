/**
 * One-off: dump recent cron_logs grouped by task so we can eyeball
 * whether the automated pipeline is healthy. Safe to delete.
 *   npx tsx scripts/check-cron-health.ts [taskName]
 */
import { config } from "dotenv"
config({ path: ".env.local" })
config({ path: ".env" })

import { PrismaClient } from "@prisma/client"

const prisma = new PrismaClient()

async function main() {
  const focus = process.argv[2]
  if (focus) {
    const rows = await prisma.cronLog.findMany({
      where: { task: focus },
      orderBy: { createdAt: "desc" },
      take: 8,
    })
    for (const r of rows) {
      console.log(`\n=== ${r.createdAt.toISOString()}  [${r.status}]  ${r.duration ?? "?"}ms`)
      console.log(`summary: ${r.summary}`)
      console.log(`details: ${JSON.stringify(r.details, null, 2)}`)
    }
    await prisma.$disconnect()
    return
  }

  const since = new Date(Date.now() - 14 * 24 * 3600 * 1000)
  const logs = await prisma.cronLog.findMany({
    where: { createdAt: { gte: since } },
    orderBy: { createdAt: "desc" },
    take: 500,
  })

  console.log(`\n${logs.length} cron_logs in the last 14 days\n`)

  const byTask = new Map<string, typeof logs>()
  for (const l of logs) {
    const arr = byTask.get(l.task) ?? []
    arr.push(l)
    byTask.set(l.task, arr)
  }

  const now = Date.now()
  for (const [task, arr] of [...byTask.entries()].sort()) {
    const latest = arr[0]
    const ageH = ((now - latest.createdAt.getTime()) / 3600000).toFixed(1)
    const last5 = arr.slice(0, 5).map((l) => l.status[0].toUpperCase()).join("")
    console.log(
      `${task.padEnd(24)} runs=${String(arr.length).padStart(3)}  last=${ageH}h ago [${latest.status}]  recent:${last5}  | ${(latest.summary ?? "").slice(0, 90)}`,
    )
  }

  const errors = logs.filter((l) => l.status === "error")
  if (errors.length) {
    console.log(`\n--- ${errors.length} ERROR runs ---`)
    for (const e of errors.slice(0, 25)) {
      console.log(`${e.createdAt.toISOString()}  ${e.task}: ${e.summary}`)
    }
  } else {
    console.log("\nNo error runs in window.")
  }

  await prisma.$disconnect()
}

main().catch((e) => {
  console.error(e)
  process.exit(1)
})
