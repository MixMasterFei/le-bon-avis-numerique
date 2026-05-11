/**
 * Backfill editorial supervision tags (editorialTone, topicCluster) on
 * existing news_stories rows.
 *
 * Runs the same Haiku-based classifier the cron now uses, but against
 * historical PUBLISHED rows so the V3 balancer has signal from day 0.
 *
 * Usage:
 *   npx tsx scripts/backfill-news-editorial-tags.ts
 *   npx tsx scripts/backfill-news-editorial-tags.ts --limit 50
 *   npx tsx scripts/backfill-news-editorial-tags.ts --redo  # also retag
 *
 * Cost: ~$0.0002 per row via Haiku 4.5 (max_tokens=80). 500 rows ≈ $0.10.
 * Throughput: ~4-6 rows/sec serial, faster with parallel batches.
 */
import { config } from "dotenv"
config()

import { PrismaClient } from "@prisma/client"
import { judgeEditorial } from "../src/lib/news-editorial-judge"

const prisma = new PrismaClient()

interface Args {
  limit: number | null
  redo: boolean
}

function parseArgs(): Args {
  const args = process.argv.slice(2)
  let limit: number | null = null
  let redo = false
  for (let i = 0; i < args.length; i++) {
    const a = args[i]
    if (a === "--limit") {
      limit = Number.parseInt(args[++i] ?? "0", 10)
      if (!Number.isFinite(limit) || limit <= 0) limit = null
    } else if (a === "--redo") {
      redo = true
    }
  }
  return { limit, redo }
}

async function main() {
  const { limit, redo } = parseArgs()
  console.log(`[backfill-news-editorial] limit=${limit ?? "ALL"} redo=${redo}`)

  // Default: only rows that don't have tags yet. --redo retags every
  // PUBLISHED row (useful if the classifier prompt changes).
  const where = redo
    ? { status: "PUBLISHED" as const }
    : {
        status: "PUBLISHED" as const,
        OR: [{ editorialTone: null }, { topicCluster: null }],
      }

  const total = await prisma.newsStory.count({ where })
  console.log(`[backfill-news-editorial] candidates: ${total}`)
  if (total === 0) {
    await prisma.$disconnect()
    return
  }

  const take = limit ? Math.min(limit, total) : total
  const rows = await prisma.newsStory.findMany({
    where,
    orderBy: { publishedAt: "desc" },
    take,
    select: { id: true, title: true, summary: true, body: true, category: true },
  })

  let done = 0
  let failed = 0
  const BATCH = 4 // parallel calls per round; Haiku has plenty of headroom
  for (let i = 0; i < rows.length; i += BATCH) {
    const batch = rows.slice(i, i + BATCH)
    await Promise.all(
      batch.map(async (row) => {
        try {
          const verdict = await judgeEditorial({
            title: row.title,
            summary: row.summary,
            body: row.body,
            category: row.category,
          })
          if (!verdict) {
            // Classifier failed (no key, timeout, parse error). Skip
            // the write so a transient outage doesn't pin every row
            // to "neutral" forever — the next run picks it up again.
            failed++
            return
          }
          await prisma.newsStory.update({
            where: { id: row.id },
            data: { editorialTone: verdict.tone, topicCluster: verdict.cluster },
          })
          done++
        } catch (err) {
          failed++
          console.warn(`[backfill-news-editorial] row ${row.id} failed`, err)
        }
      }),
    )
    if ((done + failed) % 20 === 0 || done + failed === rows.length) {
      console.log(`  progress: ${done + failed}/${rows.length} (failed=${failed})`)
    }
  }

  console.log(`[backfill-news-editorial] done. tagged=${done} failed=${failed}`)
  await prisma.$disconnect()
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})
