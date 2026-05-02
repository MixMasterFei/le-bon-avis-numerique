import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { isCronOrAdminAuthorized } from "@/lib/cron-auth"
import { logCronRun } from "@/lib/cron-log"

// One-shot backfill — stamps `imageSourceType` + `imageCredit` on
// every legacy NewsStory whose provenance is null. Pre-refactor the
// pipeline did OG-first then RSS-fallback, so most legacy stored
// images are PUBLISHER_OG. We don't try to re-classify by inspecting
// the stored Supabase URL (the source domain is gone after mirroring);
// instead we use the `sources[]` JSON that's already on the row:
//
//   - Any source domain on the AGENCY allowlist → AGENCY (with that
//     publisher's name as credit)
//   - Otherwise → PUBLISHER_OG (with the primary source's name as
//     credit, since pre-refactor that's what the image was scraped
//     from)
//
// Stock backfill isn't possible here without the original story title
// keywords feeding a fresh Pexels/Unsplash call, and we don't want to
// burn the free-tier quota on hundreds of legacy rows. New stories
// get the full 5-tier hierarchy; legacy rows get a best-guess label.
//
// Idempotent — only touches rows where `image_source_type IS NULL`.
// Safe to re-run.

const AGENCY_DOMAINS = [
  "reuters.com",
  "apnews.com",
  "ap.org",
  "afp.com",
  "gettyimages.com",
  "epa.eu",
  "shutterstock.com",
  "belga.be",
  "sipa.com",
  "aa.com.tr",
  "efe.com",
  "ansa.it",
  "dpa.com",
]

interface SourceEntry {
  name?: string
  url?: string
}

function hostFromUrl(url: string | undefined): string | null {
  if (!url) return null
  try {
    return new URL(url).hostname.toLowerCase()
  } catch {
    return null
  }
}

function isAgencyDomain(host: string | null): boolean {
  if (!host) return false
  return AGENCY_DOMAINS.some((d) => host === d || host.endsWith(`.${d}`))
}

function classify(sourcesJson: unknown): {
  imageSourceType: "AGENCY" | "PUBLISHER_OG"
  imageCredit: string
} {
  const sources: SourceEntry[] = Array.isArray(sourcesJson) ? (sourcesJson as SourceEntry[]) : []

  // First pass: any agency source wins.
  for (const s of sources) {
    if (isAgencyDomain(hostFromUrl(s.url))) {
      return {
        imageSourceType: "AGENCY",
        imageCredit: typeof s.name === "string" && s.name ? s.name : (hostFromUrl(s.url) ?? "Agence"),
      }
    }
  }

  // No agency in the cited sources → tag as PUBLISHER_OG with the
  // primary source's name (pre-refactor pipeline scraped OG from the
  // article URL, which is the first source).
  const primary = sources[0]
  const credit = typeof primary?.name === "string" && primary.name
    ? primary.name
    : hostFromUrl(primary?.url) ?? "Source"
  return { imageSourceType: "PUBLISHER_OG", imageCredit: credit }
}

const BATCH_SIZE = 200

export async function POST(req: NextRequest) {
  if (!(await isCronOrAdminAuthorized(req))) {
    return NextResponse.json({ error: "Non autorisé" }, { status: 401 })
  }

  const startTime = Date.now()
  let scanned = 0
  let updated = 0
  const counts: Record<string, number> = { AGENCY: 0, PUBLISHER_OG: 0 }

  try {
    // Cursor-paginated to keep us under Vercel's 60s serverless limit
    // even on large legacy backlogs. Caller can hit the endpoint
    // repeatedly until `remaining` reaches 0.
    let cursor: string | undefined
    while (true) {
      const rows = await prisma.newsStory.findMany({
        where: { imageSourceType: null },
        select: { id: true, sources: true },
        orderBy: { id: "asc" },
        take: BATCH_SIZE,
        ...(cursor ? { cursor: { id: cursor }, skip: 1 } : {}),
      })
      if (rows.length === 0) break

      for (const row of rows) {
        scanned++
        const verdict = classify(row.sources)
        await prisma.newsStory.update({
          where: { id: row.id },
          data: {
            imageSourceType: verdict.imageSourceType,
            imageCredit: verdict.imageCredit,
          },
        })
        updated++
        counts[verdict.imageSourceType] = (counts[verdict.imageSourceType] ?? 0) + 1
      }

      cursor = rows[rows.length - 1]!.id

      // Safety bail: if we're approaching the time budget, stop and
      // let the caller resume with another invocation. 50s leaves
      // headroom for the response + tail logging.
      if (Date.now() - startTime > 50_000) break
    }

    const remaining = await prisma.newsStory.count({ where: { imageSourceType: null } })

    await logCronRun({
      task: "news.reprocessImages",
      status: "success",
      summary: `Backfilled ${updated} of ${scanned} scanned (${remaining} remaining)`,
      details: { scanned, updated, remaining, tierCounts: counts },
      startTime,
    })

    return NextResponse.json({
      ok: true,
      // `done` + `processed` shape matches the chunked-operation
      // contract in src/hooks/useOperation.ts so the Operations
      // Center tile can auto-loop until the backlog is cleared.
      done: remaining === 0,
      processed: updated,
      scanned,
      updated,
      remaining,
      tierCounts: counts,
      durationMs: Date.now() - startTime,
    })
  } catch (err) {
    const message = err instanceof Error ? err.message : "unknown error"
    await logCronRun({
      task: "news.reprocessImages",
      status: "error",
      summary: `Backfill failed after ${updated} of ${scanned}: ${message}`,
      details: { scanned, updated, error: message },
      startTime,
    })
    console.error("[reprocess-images] failed:", err)
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
