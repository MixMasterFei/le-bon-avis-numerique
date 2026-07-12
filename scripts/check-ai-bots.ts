/**
 * Dump recent ai_bot_hits so we can eyeball AI visibility: which AI crawlers
 * fetch us, what surfaces they read (md layer vs fiches vs llms.txt), and
 * whether AI assistants send us human referrals.
 *   npx tsx scripts/check-ai-bots.ts [days]   (default: 30)
 */
import { config } from "dotenv"
config({ path: ".env.local" })
config({ path: ".env" })

import { PrismaClient } from "@prisma/client"

const prisma = new PrismaClient()

async function main() {
  const days = parseInt(process.argv[2] || "30", 10)
  const since = new Date()
  since.setDate(since.getDate() - days)

  const rows = await prisma.aiBotHit.findMany({
    where: { day: { gte: since } },
    orderBy: [{ day: "desc" }, { count: "desc" }],
  })

  if (rows.length === 0) {
    console.log(`No AI bot hits recorded in the last ${days} days.`)
    console.log("(Table empty? Check that sql/create_ai_bot_hits.sql was applied and CRON_SECRET is set.)")
    await prisma.$disconnect()
    return
  }

  // Totals by bot
  const byBot = new Map<string, number>()
  const bySurface = new Map<string, number>()
  for (const r of rows) {
    byBot.set(r.bot, (byBot.get(r.bot) ?? 0) + r.count)
    bySurface.set(r.surface, (bySurface.get(r.surface) ?? 0) + r.count)
  }

  console.log(`=== AI visibility — last ${days} days ===\n`)

  console.log("By bot/assistant:")
  for (const [bot, count] of [...byBot.entries()].sort((a, b) => b[1] - a[1])) {
    console.log(`  ${String(count).padStart(6)}  ${bot}`)
  }

  console.log("\nBy surface:")
  for (const [surface, count] of [...bySurface.entries()].sort((a, b) => b[1] - a[1])) {
    console.log(`  ${String(count).padStart(6)}  ${surface}`)
  }

  console.log("\nDaily detail (most recent first):")
  let lastDay = ""
  for (const r of rows) {
    const d = r.day.toISOString().slice(0, 10)
    if (d !== lastDay) {
      console.log(`\n--- ${d}`)
      lastDay = d
    }
    console.log(
      `  ${String(r.count).padStart(5)}  [${r.kind}] ${r.bot} → ${r.surface}` +
        (r.samplePath ? `  (ex: ${r.samplePath})` : ""),
    )
  }

  await prisma.$disconnect()
}

main().catch(async (e) => {
  console.error(e)
  await prisma.$disconnect()
  process.exit(1)
})
