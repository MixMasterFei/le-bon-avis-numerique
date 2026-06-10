/**
 * Revert films that were fully enriched while still unreleased back to
 * "provisional" state, so their fabricated content metrics stop showing.
 *
 *   - deletes their ContentMetrics row (the guessed 0–5 dimensions)
 *   - sets isEnriched = false  → re-enters the enrichment queue, which now
 *     skips it until release date passes (see enrich/route.ts guard)
 *   - KEEPS expertAgeRec so the title stays visible with a provisional,
 *     "à confirmer" age estimate (isProvisional = !isEnriched && age != null)
 *
 * Dry-run by default. Pass --apply to actually write.
 *   npx tsx scripts/revert-unreleased-to-provisional.ts            (preview)
 *   npx tsx scripts/revert-unreleased-to-provisional.ts --apply    (write)
 */
import { config } from "dotenv"
config({ path: ".env.local" })
config({ path: ".env" })

import { PrismaClient } from "@prisma/client"

const prisma = new PrismaClient()
const APPLY = process.argv.includes("--apply")

async function main() {
  const now = new Date()

  const targets = await prisma.mediaItem.findMany({
    where: { isEnriched: true, releaseDate: { gt: now } },
    select: {
      id: true,
      title: true,
      type: true,
      releaseDate: true,
      expertAgeRec: true,
      contentMetrics: { select: { id: true } },
    },
    orderBy: { releaseDate: "asc" },
  })

  console.log(`${APPLY ? "APPLYING" : "DRY-RUN"} — ${targets.length} unreleased-but-enriched titles\n`)
  for (const m of targets) {
    console.log(
      `  ${m.releaseDate?.toISOString().split("T")[0]}  [${m.type}]  ${m.title}` +
        `  (age ${m.expertAgeRec} kept, metrics ${m.contentMetrics ? "DELETE" : "none"})`,
    )
  }

  if (!APPLY) {
    console.log(`\nDry-run only. Re-run with --apply to write.`)
    return
  }

  let metricsDeleted = 0
  let reverted = 0
  for (const m of targets) {
    if (m.contentMetrics) {
      await prisma.contentMetrics.delete({ where: { mediaId: m.id } })
      metricsDeleted++
    }
    await prisma.mediaItem.update({
      where: { id: m.id },
      data: { isEnriched: false },
    })
    reverted++
  }

  console.log(`\nDone. Reverted ${reverted} titles, deleted ${metricsDeleted} ContentMetrics rows.`)
}

main()
  .then(() => prisma.$disconnect())
  .catch((e) => {
    console.error(e)
    return prisma.$disconnect().then(() => process.exit(1))
  })
