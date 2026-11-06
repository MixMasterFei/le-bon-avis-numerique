import { NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { SimilaritySource, MediaType } from "@prisma/client"
import { logCronRun } from "@/lib/cron-log"
import { similarityDueWhere, SIMILARITY_ROTATION_ORDER } from "@/lib/similarity-rotation"

// Was 60s — at that ceiling a full-mode batch of even 10 items got
// killed mid-run, so the Saturday loop only ever cleared the first
// batch (~10 of 7700+ items) before subsequent calls timed out. With
// Fluid Compute the function ceiling is 300s; use it so a batch of
// 40-50 items completes comfortably and the catalog actually drains.
export const maxDuration = 300

/**
 * Compute media similarities based on:
 * - Same director
 * - Shared genres
 * - Similar age recommendation
 * - Shared topics
 *
 * Chunked rotation: each call takes the `limit` titles whose similarities are
 * the LEAST recently computed (never computed first) and stamps them
 * (similarityComputedAt), so consecutive calls — and consecutive Saturdays —
 * advance through the whole catalogue by themselves. Callers just loop until
 * `done`; no offset. See src/lib/similarity-rotation.ts.
 */
export async function POST(request: Request) {
  const startTime = Date.now()
  try {
    const body = await request.json().catch(() => ({}))
    const url = new URL(request.url)
    const mode = url.searchParams.get("mode") || body.mode || "full"
    // Full mode needs smaller batches (each item compared against many candidates)
    const defaultLimit = mode === "full" ? 30 : 20
    const limit = Math.min(body.limit || defaultLimit, mode === "full" ? 50 : 50)
    // `offset` (URL or body) is accepted and ignored: the cursor is the stamp.
    const minScore = body.minScore || 0.2

    // Count total enriched items for progress
    const totalItems = await prisma.mediaItem.count({
      where: { type: { in: ["MOVIE", "TV"] }, isEnriched: true },
    })

    const mediaItems = await prisma.mediaItem.findMany({
      where: similarityDueWhere(),
      select: {
        id: true,
        title: true,
        type: true,
        genres: true,
        topics: true,
        director: true,
        expertAgeRec: true,
        contentMetrics: {
          select: {
            toneTags: true,
            emotionalThemes: true,
          },
        },
      },
      take: limit,
      orderBy: SIMILARITY_ROTATION_ORDER,
    })

    let processed = 0
    let created = 0
    const updated = 0

    // Safety bail before Vercel's 300s ceiling. At ~7,900 enriched items a
    // full-mode item costs ~5-6s (candidates query + up to 10 upserts), so a
    // 50-item batch can no longer finish inside maxDuration — the gateway
    // killed the function mid-run, curl saw an empty response, and the whole
    // Saturday similarity step silently gave up after 3 tries (nothing logged;
    // the supervisor then flagged "similarity stale" a week later). Bailing at
    // 260s returns real progress; only the items actually computed are stamped,
    // so the next call resumes with the rest. Mirrors the enrich route's
    // TIME_BUDGET_MS pattern.
    const TIME_BUDGET_MS = 260_000
    const computedIds: string[] = []
    let bailedOnTime = false

    // Helper: save a similarity pair using upsert (avoids separate findFirst + create/update)
    async function savePair(idA: string, idB: string, score: number, reasons: string[]) {
      // Ensure consistent ordering (smaller ID first) to avoid duplicate pairs
      const [first, second] = idA < idB ? [idA, idB] : [idB, idA]
      try {
        // Don't clobber curated edges. EXPERT (e.g. the SEO maillage agent in
        // seo-autofix.ts) and COMMUNITY rows are hand-placed and would otherwise
        // be silently downgraded to ALGORITHM + rescored on the weekly recompute.
        const existing = await prisma.mediaSimilarity.findUnique({
          where: { mediaIdA_mediaIdB: { mediaIdA: first, mediaIdB: second } },
          select: { source: true },
        })
        if (existing && existing.source !== "ALGORITHM") {
          return
        }
        await prisma.mediaSimilarity.upsert({
          where: { mediaIdA_mediaIdB: { mediaIdA: first, mediaIdB: second } },
          create: {
            mediaIdA: first,
            mediaIdB: second,
            similarityScore: score,
            reasons,
            source: "ALGORITHM" as SimilaritySource,
          },
          update: {
            similarityScore: score,
            reasons,
            source: "ALGORITHM" as SimilaritySource,
          },
        })
        created++
      } catch {
        // Ignore duplicates from race conditions
      }
    }

    if (mode === "full") {
      // Full mode: compare each item against top candidates of same type
      for (const itemA of mediaItems) {
        if (Date.now() - startTime > TIME_BUDGET_MS) {
          bailedOnTime = true
          break
        }
        // Fetch candidates with at least some shared genres
        const candidates = await prisma.mediaItem.findMany({
          where: {
            id: { not: itemA.id },
            type: itemA.type as MediaType,
            isEnriched: true,
            posterUrl: { not: null },
            // Only fetch items that share at least one genre (drastically reduces candidates)
            genres: { hasSome: itemA.genres },
          },
          select: {
            id: true,
            title: true,
            type: true,
            genres: true,
            topics: true,
            director: true,
            expertAgeRec: true,
            contentMetrics: {
              select: {
                toneTags: true,
                emotionalThemes: true,
              },
            },
          },
          take: 200,
        })

        // Compute all scores in memory, then save only the best matches
        const matches: Array<{ item: typeof candidates[0]; score: number; reasons: string[] }> = []
        for (const itemB of candidates) {
          processed++
          const { score, reasons } = computeSimilarity(itemA, itemB)
          if (score >= minScore) {
            matches.push({ item: itemB, score, reasons })
          }
        }

        // Keep top 10 matches per item to avoid DB bloat
        matches.sort((a, b) => b.score - a.score)
        for (const match of matches.slice(0, 10)) {
          await savePair(itemA.id, match.item.id, match.score, match.reasons)
        }
        computedIds.push(itemA.id)
      }
    } else {
      // Batch mode: compare pairs within the batch only
      for (let i = 0; i < mediaItems.length; i++) {
        const itemA = mediaItems[i]
        for (let j = i + 1; j < mediaItems.length; j++) {
          const itemB = mediaItems[j]
          processed++
          const { score, reasons } = computeSimilarity(itemA, itemB)
          if (score >= minScore) {
            await savePair(itemA.id, itemB.id, score, reasons)
          }
        }
      }
      computedIds.push(...mediaItems.map((m) => m.id))
    }

    // Advance the rotation cursor for exactly the items computed. Raw UPDATE so
    // Prisma's @updatedAt doesn't record bookkeeping as an edit of the fiche
    // (same convention as src/lib/streaming-sync.ts).
    if (computedIds.length > 0) {
      await prisma.$executeRaw`
        UPDATE media_items SET similarity_computed_at = now()
        WHERE id = ANY(${computedIds}::text[])
      `
    }

    // Done once nothing is left due (or a call found fewer due items than it
    // asked for). A time bail is never "done": the uncomputed rest is still
    // due and goes first next call.
    const remaining = await prisma.mediaItem.count({ where: similarityDueWhere() })
    const done = !bailedOnTime && (remaining === 0 || mediaItems.length < limit)

    await logCronRun({
      task: "similarity",
      status: done ? "success" : "partial",
      summary: done
        ? `${created} nouvelles similarites, ${updated} MAJ (${processed} paires) — file a jour`
        : `Batch similarity: ${computedIds.length} titres recalcules (${processed} paires), ${remaining}/${totalItems} en attente${bailedOnTime ? " — bailed on time" : ""}`,
      details: {
        processed,
        created,
        updated,
        items: computedIds.length,
        limit,
        remaining,
        total: totalItems,
        done,
        bailedOnTime,
      },
      startTime,
    })

    return NextResponse.json({
      success: true,
      done,
      processed,
      created,
      updated,
      items: computedIds.length,
      remaining,
      total: totalItems,
      bailedOnTime,
    })
  } catch (error) {
    console.error("Similarity compute error:", error)

    await logCronRun({
      task: "similarity",
      status: "error",
      summary: error instanceof Error ? error.message : "Similarity compute failed",
      startTime,
    })

    return NextResponse.json(
      { success: false, error: "Failed to compute similarities" },
      { status: 500 }
    )
  }
}

interface MediaForComparison {
  id: string
  title: string
  type: string
  genres: string[]
  topics: string[]
  director: string | null
  expertAgeRec: number | null
  contentMetrics?: {
    toneTags: string[]
    emotionalThemes: string[]
  } | null
}

function computeSimilarity(
  itemA: MediaForComparison,
  itemB: MediaForComparison
): { score: number; reasons: string[] } {
  const reasons: string[] = []
  let totalWeight = 0
  let weightedScore = 0

  // Same type bonus (weight: 1)
  if (itemA.type === itemB.type) {
    weightedScore += 0.1
    totalWeight += 1
    reasons.push("same_type")
  }

  // Same director (weight: 3)
  if (
    itemA.director &&
    itemB.director &&
    itemA.director.toLowerCase() === itemB.director.toLowerCase()
  ) {
    weightedScore += 0.6 // 0.2 * 3
    totalWeight += 3
    reasons.push("same_director")
  }

  // Genre similarity (weight: 4)
  const genreOverlap = computeArrayOverlap(itemA.genres, itemB.genres)
  if (genreOverlap > 0) {
    weightedScore += genreOverlap * 4
    totalWeight += 4
    reasons.push("similar_genres")
  }

  // Topic similarity (weight: 3)
  const topicOverlap = computeArrayOverlap(itemA.topics, itemB.topics)
  if (topicOverlap > 0) {
    weightedScore += topicOverlap * 3
    totalWeight += 3
    reasons.push("similar_topics")
  }

  // Tone similarity (weight: 2) — from enrichment v2
  const toneA = itemA.contentMetrics?.toneTags ?? []
  const toneB = itemB.contentMetrics?.toneTags ?? []
  if (toneA.length > 0 && toneB.length > 0) {
    const toneOverlap = computeArrayOverlap(toneA, toneB)
    if (toneOverlap > 0) {
      weightedScore += toneOverlap * 2
      totalWeight += 2
      reasons.push("similar_tone")
    }
  }

  // Emotional theme similarity (weight: 2) — from enrichment v2
  const emotionA = itemA.contentMetrics?.emotionalThemes ?? []
  const emotionB = itemB.contentMetrics?.emotionalThemes ?? []
  if (emotionA.length > 0 && emotionB.length > 0) {
    const emotionOverlap = computeArrayOverlap(emotionA, emotionB)
    if (emotionOverlap > 0) {
      weightedScore += emotionOverlap * 2
      totalWeight += 2
      reasons.push("similar_emotions")
    }
  }

  // Age recommendation similarity (weight: 2)
  if (itemA.expertAgeRec !== null && itemB.expertAgeRec !== null) {
    const ageDiff = Math.abs(itemA.expertAgeRec - itemB.expertAgeRec)
    // Same age = 1.0, +/- 2 years = 0.5, +/- 4 years = 0.25
    const ageScore = ageDiff <= 2 ? 1 - ageDiff * 0.25 : Math.max(0, 1 - ageDiff * 0.1)
    weightedScore += ageScore * 2
    totalWeight += 2
    if (ageDiff <= 2) {
      reasons.push("similar_age_rec")
    }
  }

  // Normalize score
  const score = totalWeight > 0 ? weightedScore / totalWeight : 0

  return { score: Math.min(1, Math.max(0, score)), reasons }
}

function computeArrayOverlap(arr1: string[], arr2: string[]): number {
  if (!arr1?.length || !arr2?.length) return 0

  const set1 = new Set(arr1.map((s) => s.toLowerCase()))
  const set2 = new Set(arr2.map((s) => s.toLowerCase()))

  let overlap = 0
  for (const item of set1) {
    if (set2.has(item)) overlap++
  }

  // Jaccard similarity: intersection / union
  const union = new Set([...set1, ...set2])
  return overlap / union.size
}
