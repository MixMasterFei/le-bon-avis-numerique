/**
 * Revert titles enriched while still UNRELEASED back to "provisional" so
 * their fabricated content metrics stop showing. Thin CLI wrapper around
 * the shared core in src/lib/revert-unreleased.ts (also used by the admin
 * route /api/admin/revert-unreleased).
 *
 * Pass B (null-dated titles) needs TMDB_API_KEY → run where it's set.
 * Dry-run by default.
 *   npx tsx scripts/revert-unreleased-to-provisional.ts              (preview, both passes)
 *   npx tsx scripts/revert-unreleased-to-provisional.ts --apply      (write)
 *   npx tsx scripts/revert-unreleased-to-provisional.ts --skip-null  (pass A only, no TMDB)
 *   npx tsx scripts/revert-unreleased-to-provisional.ts --limit 200  (cap pass-B lookups)
 */
import { config } from "dotenv"
config({ path: ".env.local" })
config({ path: ".env" })

import { prisma } from "../src/lib/prisma"
import { revertUnreleasedToProvisional } from "../src/lib/revert-unreleased"

const APPLY = process.argv.includes("--apply")
const SKIP_NULL = process.argv.includes("--skip-null")
const LIMIT = (() => {
  const i = process.argv.indexOf("--limit")
  return i >= 0 ? parseInt(process.argv[i + 1] || "0") || 0 : 0
})()

async function main() {
  const result = await revertUnreleasedToProvisional({
    apply: APPLY,
    skipNull: SKIP_NULL,
    limit: LIMIT,
    onProgress: (m) => console.log(m),
  })

  console.log(`\n${result.dryRun ? "DRY-RUN" : "APPLIED"} — ${result.targets.length} unreleased-but-enriched titles\n`)
  for (const t of result.targets) {
    console.log(`  [${t.type}] ${t.title}  (${t.reason}; metrics ${t.hadMetrics ? "DELETE" : "none"})`)
  }
  if (result.dryRun) {
    console.log(`\nDry-run only. Re-run with --apply to write.`)
  } else {
    console.log(`\nDone. Reverted ${result.reverted} titles to provisional.`)
  }
}

main()
  .then(() => prisma.$disconnect())
  .catch((e) => {
    console.error(e)
    return prisma.$disconnect().then(() => process.exit(1))
  })
