/**
 * One-off deterministic recalibration: clamp the SENSIBILITY content metrics
 * (violence / sexNudity / language / substanceUse) to ≤ 2 for titles carrying
 * a young official rating (CSA "Tous publics"/"-10", PEGI 3/7, BBFC U/G).
 *
 * Mirrors the live enrichment guardrail (src/app/api/admin/enrich/route.ts
 * `clampMetricsByRating`) but applies it to EXISTING rows — no LLM, free,
 * instant. Fixes mislabeled young titles on the fiche right away.
 *
 * consumerism is intentionally NOT clamped (microtransactions aren't bounded
 * by an age rating). positiveMessages / roleModels are untouched.
 *
 * Usage:
 *   npx tsx scripts/recalibrate-young-ratings.ts           # dry run (default)
 *   npx tsx scripts/recalibrate-young-ratings.ts --apply   # write changes
 */
import { PrismaClient } from "@prisma/client"

const prisma = new PrismaClient()
const APPLY = process.argv.includes("--apply")

// IMPORTANT: officialRating is unreliable in this DB — "U" and even "TP"
// (Tous Publics) are attached to clearly-adult films (e.g. "La Chute" 16+ with
// TP). So we gate the clamp on the site's OWN curated age (`expertAgeRec`),
// which is the trustworthy signal and matches the on-card display anchor
// (≤8 → capped at "léger"). A title curated 8+ shouldn't carry a sensibility
// axis above 2 ("Léger"); cap the offenders.
const YOUNG_AGE = 8
const CAP = 2
const AXES = ["violence", "sexNudity", "language", "substanceUse"] as const

async function main() {
  // Candidates: have a metrics row with at least one sensibility axis > CAP.
  const rows = await prisma.mediaItem.findMany({
    where: {
      expertAgeRec: { not: null, lte: YOUNG_AGE },
      contentMetrics: {
        OR: [
          { violence: { gt: CAP } },
          { sexNudity: { gt: CAP } },
          { language: { gt: CAP } },
          { substanceUse: { gt: CAP } },
        ],
      },
    },
    select: {
      id: true,
      title: true,
      officialRating: true,
      expertAgeRec: true,
      contentMetrics: {
        select: { violence: true, sexNudity: true, language: true, substanceUse: true },
      },
    },
  })

  const young = rows // already gated on expertAgeRec ≤ YOUNG_AGE by the query

  console.log(`Titles curated ≤${YOUNG_AGE}+ with a sensibility axis > ${CAP}: ${young.length}`)
  console.log(`Mode: ${APPLY ? "APPLY (writing)" : "DRY RUN (no writes)"}\n`)

  // Distribution by curated age, for sanity.
  const byAge = new Map<number, number>()
  for (const r of young) {
    const k = r.expertAgeRec ?? -1
    byAge.set(k, (byAge.get(k) ?? 0) + 1)
  }
  console.log("By expertAgeRec:")
  for (const [k, n] of [...byAge.entries()].sort((a, b) => a[0] - b[0])) {
    console.log(`  ${k}+  ${n}`)
  }
  console.log("")

  let changed = 0
  for (const r of young) {
    const cm = r.contentMetrics
    if (!cm) continue
    const next: Record<string, number> = {}
    const before: string[] = []
    for (const a of AXES) {
      if (cm[a] > CAP) {
        next[a] = CAP
        before.push(`${a} ${cm[a]}→${CAP}`)
      }
    }
    if (Object.keys(next).length === 0) continue
    changed++
    if (changed <= 25) {
      console.log(`  [${r.expertAgeRec ?? "?"}+ ${r.officialRating}] ${r.title}: ${before.join(", ")}`)
    }
    if (APPLY) {
      await prisma.contentMetrics.update({ where: { mediaId: r.id }, data: next })
    }
  }

  console.log(`\n${APPLY ? "Updated" : "Would update"} ${changed} title(s).`)
  await prisma.$disconnect()
}

main().catch(async (e) => {
  console.error(e)
  await prisma.$disconnect()
  process.exit(1)
})
