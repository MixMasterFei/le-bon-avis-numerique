/**
 * Reads the most recent `streaming` cron_logs rows and reports what the
 * per-item errors were. Use after a Saturday-morning run (or a manual
 * streaming trigger) to understand why `stats.errors` is high.
 *
 *   npx tsx scripts/check-streaming-errors.ts
 */

import "dotenv/config"
import { PrismaClient } from "@prisma/client"

const prisma = new PrismaClient()

interface StreamingDetails {
  total?: number
  processed?: number
  updated?: number
  noProviders?: number
  errors?: number
  details?: string[]
  mediaType?: string
  offset?: number
  statusBreakdown?: Record<string, number>
  remaining?: number
}

async function main() {
  const rows = await prisma.cronLog.findMany({
    where: { task: { in: ["streaming", "streaming-cache"] } },
    orderBy: { createdAt: "desc" },
    take: 5,
  })

  if (rows.length === 0) {
    console.log("No streaming cron logs found.")
    return
  }

  console.log(`\nLast ${rows.length} streaming runs:\n`)

  for (const row of rows) {
    const d = (row.details as StreamingDetails | null) ?? {}
    const when = row.createdAt.toLocaleString("fr-FR")
    console.log(`---`)
    console.log(`${when}  ·  ${row.status.toUpperCase()}  ·  ${row.task}`)
    console.log(`  ${row.summary ?? "(no summary)"}`)
    console.log(
      `  processed=${d.processed ?? d.total ?? "?"}  updated=${d.updated ?? 0}  noProviders=${d.noProviders ?? 0}  errors=${d.errors ?? 0}`,
    )

    // streaming-cache task exposes an HTTP status breakdown directly
    if (d.statusBreakdown && Object.keys(d.statusBreakdown).length > 0) {
      const entries = Object.entries(d.statusBreakdown).sort((a, b) => b[1] - a[1])
      console.log(`  HTTP status breakdown:`)
      for (const [code, count] of entries) {
        console.log(`    ${String(count).padStart(4)}× ${code}`)
      }
      continue
    }

    const errorLines = (d.details ?? []).filter((x) => x.startsWith("Error for"))
    if (errorLines.length === 0) {
      console.log(`  (no per-item error lines)`)
      continue
    }

    // Group errors by the message after "Error for <title>: "
    const groups = new Map<string, number>()
    for (const line of errorLines) {
      const m = line.match(/Error for .*?: (.*)$/)
      const key = (m ? m[1] : line).slice(0, 120)
      groups.set(key, (groups.get(key) ?? 0) + 1)
    }
    const sorted = Array.from(groups.entries()).sort((a, b) => b[1] - a[1])
    console.log(`  Top error patterns:`)
    for (const [msg, count] of sorted.slice(0, 10)) {
      console.log(`    ${String(count).padStart(3)}× ${msg}`)
    }
  }
  console.log(`---\n`)
}

main()
  .catch((e) => {
    console.error(e)
    process.exit(1)
  })
  .finally(() => prisma.$disconnect())
