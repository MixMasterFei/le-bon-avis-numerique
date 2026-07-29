/**
 * Diffs the curated heritage/seasonal watchlist against the catalogue and
 * prints a Markdown report of what is missing.
 *
 *   npx tsx scripts/heritage-gap.ts              # report to stdout
 *   npx tsx scripts/heritage-gap.ts --json       # machine-readable
 *   npx tsx scripts/heritage-gap.ts --out docs/catalogue-gap.md
 *
 * Read-only. The watchlist itself lives in src/lib/heritage-watchlist.ts —
 * add titles there, re-run this, and the report regenerates.
 */
import { config } from "dotenv"
config({ path: ".env.local" })
config({ path: ".env" })

import { writeFileSync } from "node:fs"
import { PrismaClient } from "@prisma/client"
import { buildHeritageGap, toCatalogTitle } from "../src/lib/heritage-gap"

const prisma = new PrismaClient()

async function main() {
  const asJson = process.argv.includes("--json")
  const outIdx = process.argv.indexOf("--out")
  const outPath = outIdx >= 0 ? process.argv[outIdx + 1] : null

  // Movies only — the watchlist is all MOVIE today. Pull id/title/date and do
  // the matching in JS: the normalisation rules (accents, "&"→"et", year
  // window, aliases) are unit-tested there and must not be re-implemented in
  // SQL, where an ordering slip between lower() and translate() silently
  // produces false "missing" verdicts.
  const catalog = await prisma.mediaItem.findMany({
    where: { type: "MOVIE" },
    select: { id: true, title: true, releaseDate: true },
  })

  const gap = buildHeritageGap(catalog.map(toCatalogTitle))

  if (asJson) {
    console.log(JSON.stringify(gap, null, 2))
  } else if (outPath) {
    writeFileSync(outPath, gap.report + "\n")
    console.log(`Rapport écrit dans ${outPath} — ${gap.missing}/${gap.total} manquants.`)
  } else {
    console.log(gap.report)
  }

  await prisma.$disconnect()
}

main().catch(async (e) => {
  console.error(e)
  await prisma.$disconnect()
  process.exit(1)
})
