/**
 * Read-only family-safety audit. Sizes the recurring exposure classes the
 * 2026-07 audit fixed, so a regression shows up as a non-zero count. Safe to
 * run against prod any time; writes nothing.
 *
 *   npx tsx scripts/audit-family-safety.ts
 *
 * Exit code is 1 if any "must be 0" check is non-zero (usable as a CI/smoke
 * gate), else 0.
 */
import { config } from "dotenv"
config({ path: ".env.local" })
config({ path: ".env" })

import { PrismaClient, type MediaType } from "@prisma/client"
import { floorExpertAgeBySignals } from "../src/lib/age-floor"

const prisma = new PrismaClient()

const VIDEO: MediaType[] = ["MOVIE", "TV"]
let failures = 0

function check(label: string, count: number, mustBeZero = false) {
  const flag = mustBeZero && count > 0 ? " ❌" : mustBeZero ? " ✓" : ""
  console.log(`  ${label}: ${count}${flag}`)
  if (mustBeZero && count > 0) failures++
}

async function main() {
  console.log("== Family-safety audit (read-only) ==\n")

  // 1. E2E fixtures must never live in the public catalogue.
  console.log("E2E fixtures in prod (must be 0):")
  const e2e = await prisma.mediaItem.count({
    where: { OR: [{ title: { contains: "(E2E)" } }, { title: { contains: "Test Horror Movie" } }, { title: { contains: "Test Family Movie" } }] },
  })
  check("test-fixture media rows", e2e, true)

  // 2. Horror titles below the deterministic age floor (the incident class).
  console.log("\nBelow the age floor (must be 0 — weekly sweep drains it):")
  const horrorGamesLow = await prisma.mediaItem.count({
    where: { type: "GAME", isEnriched: true, topics: { hasSome: ["Horreur", "Horror"] }, officialRating: null, expertAgeRec: { not: null, lt: 14 } },
  })
  check("horror games, no PEGI, < 14", horrorGamesLow, true)
  const horrorFilmsLow = await prisma.mediaItem.count({
    where: { type: { in: VIDEO }, isEnriched: true, topics: { hasSome: ["Horreur", "Horror"] }, expertAgeRec: { not: null, lt: 14 } },
  })
  check("horror films/TV, < 14", horrorFilmsLow, true)

  // 3. Full deterministic floor drift — re-run the real floor over the same
  //    candidate window as the sweep and count how many it WOULD still raise.
  console.log("\nDeterministic floor drift (would the sweep still raise anything?):")
  const candidates = await prisma.mediaItem.findMany({
    where: {
      isEnriched: true,
      OR: [
        { type: { in: VIDEO }, expertAgeRec: { not: null, lte: 13 }, contentMetrics: { isNot: null } },
        { type: "GAME", expertAgeRec: { not: null, lte: 17 } },
      ],
    },
    select: {
      id: true, type: true, genres: true, topics: true, expertAgeRec: true, officialRating: true,
      contentMetrics: { select: { violence: true, sexNudity: true, language: true, substanceUse: true, visualStyle: true } },
    },
  })
  let wouldRaise = 0
  for (const item of candidates) {
    if (typeof item.expertAgeRec !== "number") continue
    const floored = floorExpertAgeBySignals({
      expertAgeRec: item.expertAgeRec,
      metrics: item.contentMetrics,
      genres: item.genres,
      topics: item.topics,
      visualStyle: item.contentMetrics?.visualStyle ?? null,
      type: item.type,
      officialRating: item.officialRating,
    })
    if (floored > item.expertAgeRec) wouldRaise++
  }
  check(`titles the floor would still raise (of ${candidates.length} scanned)`, wouldRaise, true)

  // 4. Rating/metrics mismatch — informational (wrong source ratings, not
  //    auto-fixed; reported in the weekly debt digest).
  console.log("\nData-quality watchdogs (informational):")
  const mismatch = await prisma.mediaItem.count({
    where: { officialRating: { in: ["CSA_16", "CSA_18", "PEGI_16", "PEGI_18"] }, contentMetrics: { is: { violence: { lte: 2 }, sexNudity: { lte: 2 } } } },
  })
  check("official 16/18 with implausibly low metrics", mismatch)

  console.log(`\n== ${failures === 0 ? "PASS — all must-be-zero checks are clean" : `FAIL — ${failures} check(s) non-zero`} ==`)
  await prisma.$disconnect()
  process.exit(failures === 0 ? 0 : 1)
}

main().catch((e) => {
  console.error(e)
  process.exit(1)
})
