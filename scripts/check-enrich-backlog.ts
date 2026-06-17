/**
 * Read-only diagnostic: why does "enrich" do nothing while the dashboard still
 * shows N items "à enrichir"?
 *
 * The dashboard counts `isEnriched: false` with NO release guard, but the
 * /api/admin/enrich POST additionally requires `notUnreleased` (release date in
 * the past OR null, AND releaseStatus not a pre-release value). So unreleased
 * titles inflate the dashboard counter but are deliberately skipped by enrich.
 *
 * This script breaks the unenriched backlog down by type and by what's blocking
 * each item, so we can confirm the gap. Pure SELECTs — touches nothing.
 *
 *   npx tsx scripts/check-enrich-backlog.ts
 */

import { config } from "dotenv"
config({ path: ".env.local" })
config()

import { prisma } from "../src/lib/prisma"

const UNRELEASED_TMDB_STATUSES = ["Planned", "In Production", "Post Production", "Rumored"]

async function main() {
  const now = new Date()

  const items = await prisma.mediaItem.findMany({
    where: { isEnriched: false },
    select: {
      id: true,
      title: true,
      type: true,
      releaseDate: true,
      releaseStatus: true,
      expertAgeRec: true,
      contentMetrics: { select: { mediaId: true } },
    },
    orderBy: { createdAt: "desc" },
  })

  console.log(`\nTotal isEnriched:false = ${items.length} (this is the dashboard count)\n`)

  const futureDate = items.filter((i) => i.releaseDate && i.releaseDate.getTime() > now.getTime())
  const preReleaseStatus = items.filter(
    (i) => i.releaseStatus && UNRELEASED_TMDB_STATUSES.includes(i.releaseStatus),
  )
  // An item is BLOCKED from enrich if future date OR pre-release status.
  const blocked = items.filter(
    (i) =>
      (i.releaseDate && i.releaseDate.getTime() > now.getTime()) ||
      (i.releaseStatus && UNRELEASED_TMDB_STATUSES.includes(i.releaseStatus)),
  )
  const eligible = items.filter((i) => !blocked.includes(i))

  // by type
  const byType = (arr: typeof items) =>
    arr.reduce<Record<string, number>>((acc, i) => {
      acc[i.type] = (acc[i.type] || 0) + 1
      return acc
    }, {})

  console.log("By type (all unenriched):", byType(items))
  console.log("")
  console.log(`BLOCKED from enrich (unreleased) = ${blocked.length}`)
  console.log(`   · future release date        = ${futureDate.length}`)
  console.log(`   · pre-release TMDB status     = ${preReleaseStatus.length}`)
  console.log(`   blocked by type:`, byType(blocked))
  console.log("")
  console.log(`ELIGIBLE for enrich (should process) = ${eligible.length}`)
  console.log(`   eligible by type:`, byType(eligible))

  if (eligible.length > 0) {
    console.log(`\n   First eligible items (enrich SHOULD pick these up):`)
    for (const i of eligible.slice(0, 15)) {
      console.log(
        `     [${i.type}] ${i.title} — date=${i.releaseDate?.toISOString().slice(0, 10) ?? "null"} status=${i.releaseStatus ?? "null"} age=${i.expertAgeRec ?? "null"} hasMetricsRow=${!!i.contentMetrics}`,
      )
    }
  }

  if (blocked.length > 0) {
    console.log(`\n   Sample blocked (unreleased) items:`)
    for (const i of blocked.slice(0, 15)) {
      console.log(
        `     [${i.type}] ${i.title} — date=${i.releaseDate?.toISOString().slice(0, 10) ?? "null"} status=${i.releaseStatus ?? "null"}`,
      )
    }
  }

  await prisma.$disconnect()
}

main().catch((e) => {
  console.error(e)
  process.exit(1)
})
