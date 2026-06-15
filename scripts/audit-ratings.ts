/**
 * Read-only rating-quality audit (basis for the weekly watchdog). Quantifies
 * how trustworthy the catalog's ratings/evals are. No writes.
 *   npx tsx scripts/audit-ratings.ts
 */
import { PrismaClient, Prisma } from "@prisma/client"

const prisma = new PrismaClient()
const VIDEO = ["MOVIE", "TV"] as const
const SENS = ["violence", "sexNudity", "language", "substanceUse"] as const

async function main() {
  const enrichedVideo: Prisma.MediaItemWhereInput = {
    isEnriched: true,
    type: { in: [...VIDEO] },
    contentMetrics: { isNot: null },
  }

  const [
    total,
    enriched,
    enrichedVid,
    notEnriched,
    noAge,
    confNull,
    confLt50,
    confLt65,
    incoherent8,
    incoherent12,
    allZero,
    docViolent,
  ] = await Promise.all([
    prisma.mediaItem.count({ where: { type: { not: "MANGA" } } }),
    prisma.mediaItem.count({ where: { isEnriched: true, type: { not: "MANGA" } } }),
    prisma.mediaItem.count({ where: enrichedVideo }),
    prisma.mediaItem.count({ where: { isEnriched: false, type: { not: "MANGA" } } }),
    prisma.mediaItem.count({ where: { isEnriched: true, expertAgeRec: null, type: { not: "MANGA" } } }),
    prisma.mediaItem.count({ where: { ...enrichedVideo, contentMetrics: { is: { enrichmentConfidence: null } } } }),
    prisma.mediaItem.count({ where: { ...enrichedVideo, contentMetrics: { is: { enrichmentConfidence: { lt: 0.5 } } } } }),
    prisma.mediaItem.count({ where: { ...enrichedVideo, contentMetrics: { is: { enrichmentConfidence: { lt: 0.65 } } } } }),
    // Age↔metrics incoherence: young curated but a sensibility axis still high.
    prisma.mediaItem.count({
      where: {
        isEnriched: true, type: { not: "MANGA" }, expertAgeRec: { not: null, lte: 8 },
        contentMetrics: { OR: SENS.map((k) => ({ [k]: { gte: 3 } })) },
      },
    }),
    prisma.mediaItem.count({
      where: {
        isEnriched: true, type: { not: "MANGA" }, expertAgeRec: { not: null, lte: 12 },
        contentMetrics: { OR: SENS.map((k) => ({ [k]: { gte: 4 } })) },
      },
    }),
    // All sensibility axes 0 among enriched video (suspicious = possibly failed/empty).
    prisma.mediaItem.count({
      where: {
        ...enrichedVideo,
        contentMetrics: { is: { violence: 0, sexNudity: 0, language: 0, substanceUse: 0 } },
      },
    }),
    // Documentaries flagged very violent (genre outlier sanity).
    prisma.mediaItem.count({
      where: {
        isEnriched: true, genres: { hasSome: ["Documentaire", "Documentary"] },
        contentMetrics: { is: { violence: { gte: 4 } } },
      },
    }),
  ])

  // Violence distribution among enriched video.
  const violenceDist: Record<number, number> = {}
  for (let v = 0; v <= 5; v++) {
    violenceDist[v] = await prisma.mediaItem.count({
      where: { ...enrichedVideo, contentMetrics: { is: { violence: v } } },
    })
  }

  const pct = (n: number, d: number) => (d ? ((100 * n) / d).toFixed(1) + "%" : "—")

  console.log("=== RATING-QUALITY AUDIT (prod) ===\n")
  console.log(`Catalog (excl. manga): ${total}`)
  console.log(`  enriched: ${enriched} (${pct(enriched, total)}) — of which video: ${enrichedVid}`)
  console.log(`  not enriched: ${notEnriched}`)
  console.log(`  enriched but no expertAgeRec: ${noAge}`)
  console.log("")
  console.log("Confidence (enriched video):")
  console.log(`  null confidence: ${confNull} (${pct(confNull, enrichedVid)})`)
  console.log(`  < 0.50: ${confLt50} (${pct(confLt50, enrichedVid)})`)
  console.log(`  < 0.65: ${confLt65} (${pct(confLt65, enrichedVid)})`)
  console.log("")
  console.log("Coherence / sanity:")
  console.log(`  ≤8+ with a sensibility axis ≥3 (should be ~0 post-backfill): ${incoherent8}`)
  console.log(`  ≤12+ with a sensibility axis ≥4 (suspicious): ${incoherent12}`)
  console.log(`  enriched video with ALL sensibility axes = 0: ${allZero} (${pct(allZero, enrichedVid)})`)
  console.log(`  documentaries flagged violence ≥4: ${docViolent}`)
  console.log("")
  console.log("Violence distribution (enriched video):")
  for (let v = 0; v <= 5; v++) console.log(`  ${v}: ${violenceDist[v]} (${pct(violenceDist[v], enrichedVid)})`)

  await prisma.$disconnect()
}

main().catch(async (e) => { console.error(e); await prisma.$disconnect(); process.exit(1) })
