/**
 * Revert titles that were fully enriched while still UNRELEASED back to
 * "provisional", so their fabricated content metrics stop showing.
 *
 *   - deletes their ContentMetrics row (the guessed 0–5 dimensions)
 *   - sets isEnriched = false  → re-enters the enrichment queue, which now
 *     skips it until it's actually released (see enrich/route.ts guard)
 *   - writes releaseStatus from TMDB so the guard keeps blocking it even
 *     when the release date is unknown (the null-date case)
 *   - KEEPS expertAgeRec so the title stays visible with a provisional,
 *     "à confirmer" age estimate (isProvisional = !isEnriched && age != null)
 *
 * Two passes:
 *   A. future-dated + enriched  → revert (no API needed)
 *   B. NULL-dated + enriched (movies/TV) → cross-check TMDB lifecycle; revert
 *      only those whose status is a pre-release value (Planned / In
 *      Production / Post Production / Rumored). This is the "Les
 *      Indestructibles 3" case the date check alone misses.
 *
 * Pass B needs TMDB_API_KEY → run in prod. Dry-run by default.
 *   npx tsx scripts/revert-unreleased-to-provisional.ts                 (preview, both passes)
 *   npx tsx scripts/revert-unreleased-to-provisional.ts --apply         (write)
 *   npx tsx scripts/revert-unreleased-to-provisional.ts --skip-null     (pass A only, no TMDB)
 *   npx tsx scripts/revert-unreleased-to-provisional.ts --limit 200     (cap pass-B TMDB lookups)
 */
import { config } from "dotenv"
config({ path: ".env.local" })
config({ path: ".env" })

import { PrismaClient } from "@prisma/client"
import { getMovieDetails, getTVDetails } from "../src/lib/tmdb"
import { isUnreleasedStatus } from "../src/lib/release-status"

const prisma = new PrismaClient()
const APPLY = process.argv.includes("--apply")
const SKIP_NULL = process.argv.includes("--skip-null")
const LIMIT = (() => {
  const i = process.argv.indexOf("--limit")
  return i >= 0 ? parseInt(process.argv[i + 1] || "0") || 0 : 0
})()

interface Target {
  id: string
  title: string
  type: string
  reason: string
  releaseStatus: string | null
  hasMetrics: boolean
}

async function revert(t: Target) {
  if (t.hasMetrics) {
    await prisma.contentMetrics.delete({ where: { mediaId: t.id } }).catch(() => {})
  }
  await prisma.mediaItem.update({
    where: { id: t.id },
    data: { isEnriched: false, ...(t.releaseStatus ? { releaseStatus: t.releaseStatus } : {}) },
  })
}

async function main() {
  const now = new Date()
  const targets: Target[] = []

  // ── Pass A: future-dated + enriched ───────────────────────────────
  const futureDated = await prisma.mediaItem.findMany({
    where: { isEnriched: true, releaseDate: { gt: now } },
    select: { id: true, title: true, type: true, releaseDate: true, contentMetrics: { select: { id: true } } },
    orderBy: { releaseDate: "asc" },
  })
  for (const m of futureDated) {
    targets.push({
      id: m.id,
      title: m.title,
      type: m.type,
      reason: `date ${m.releaseDate?.toISOString().split("T")[0]}`,
      releaseStatus: null,
      hasMetrics: !!m.contentMetrics,
    })
  }

  // ── Pass B: null-dated + enriched (movies/TV) via TMDB status ──────
  if (!SKIP_NULL) {
    let candidates = await prisma.mediaItem.findMany({
      where: { isEnriched: true, releaseDate: null, tmdbId: { not: null }, type: { in: ["MOVIE", "TV"] } },
      select: { id: true, title: true, type: true, tmdbId: true, contentMetrics: { select: { id: true } } },
      orderBy: { updatedAt: "desc" },
    })
    if (LIMIT > 0) candidates = candidates.slice(0, LIMIT)
    console.log(`Pass B: checking TMDB status for ${candidates.length} null-dated enriched movies/TV…`)

    for (const m of candidates) {
      try {
        const details =
          m.type === "MOVIE"
            ? await getMovieDetails(m.tmdbId!)
            : await getTVDetails(m.tmdbId!)
        const status = (details as { status?: string }).status || null
        if (isUnreleasedStatus(status)) {
          targets.push({
            id: m.id,
            title: m.title,
            type: m.type,
            reason: `status "${status}"`,
            releaseStatus: status,
            hasMetrics: !!m.contentMetrics,
          })
        }
        await new Promise((r) => setTimeout(r, 120)) // be gentle on TMDB
      } catch (e) {
        console.warn(`  ! TMDB lookup failed for ${m.title}: ${e instanceof Error ? e.message : e}`)
      }
    }
  }

  console.log(`\n${APPLY ? "APPLYING" : "DRY-RUN"} — ${targets.length} unreleased-but-enriched titles\n`)
  for (const t of targets) {
    console.log(`  [${t.type}] ${t.title}  (${t.reason}; metrics ${t.hasMetrics ? "DELETE" : "none"})`)
  }

  if (!APPLY) {
    console.log(`\nDry-run only. Re-run with --apply to write.`)
    return
  }

  let reverted = 0
  for (const t of targets) {
    await revert(t)
    reverted++
  }
  console.log(`\nDone. Reverted ${reverted} titles to provisional.`)
}

main()
  .then(() => prisma.$disconnect())
  .catch((e) => {
    console.error(e)
    return prisma.$disconnect().then(() => process.exit(1))
  })
