/**
 * Backfill existing GAME rows' genres from English (IGDB) to French, so
 * `/jeux` genre filtering and game personalization match the French UI.
 * Pure DB remap of stored strings via normalizeGameGenres — no IGDB calls,
 * runs anywhere DATABASE_URL is set. Idempotent (already-French rows skip).
 *
 *   npx tsx scripts/backfill-game-genres-fr.ts            (preview)
 *   npx tsx scripts/backfill-game-genres-fr.ts --apply    (write)
 */
import { config } from "dotenv"
config({ path: ".env.local" })
config({ path: ".env" })

import { prisma } from "../src/lib/prisma"
import { normalizeGameGenres } from "../src/lib/igdb-genres"

const APPLY = process.argv.includes("--apply")

async function main() {
  const games = await prisma.mediaItem.findMany({
    where: { type: "GAME" },
    select: { id: true, title: true, genres: true },
  })

  let changed = 0
  const sample: string[] = []
  for (const g of games) {
    const next = normalizeGameGenres(g.genres)
    if (JSON.stringify(next) === JSON.stringify(g.genres)) continue
    changed++
    if (sample.length < 15) {
      sample.push(`  ${g.title}: [${g.genres.join(", ")}] → [${next.join(", ")}]`)
    }
    if (APPLY) {
      await prisma.mediaItem.update({ where: { id: g.id }, data: { genres: next } })
    }
  }

  console.log(`${APPLY ? "APPLIED" : "DRY-RUN"} — ${games.length} games, ${changed} remapped`)
  sample.forEach((s) => console.log(s))
  if (!APPLY && changed > 0) console.log("\nRe-run with --apply to write.")
}

main()
  .then(() => prisma.$disconnect())
  .catch((e) => {
    console.error(e)
    return prisma.$disconnect().then(() => process.exit(1))
  })
