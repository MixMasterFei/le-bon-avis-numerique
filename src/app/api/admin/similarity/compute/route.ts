import { NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { SimilaritySource } from "@prisma/client"
import { logCronRun } from "@/lib/cron-log"

export const maxDuration = 60

/**
 * Compute media similarities based on:
 * - Same director
 * - Shared genres
 * - Similar age recommendation
 * - Shared topics
 *
 * Chunked: processes a batch of items, compares all pairs within the batch.
 * Frontend loops with increasing offset until done.
 */
export async function POST(request: Request) {
  const startTime = Date.now()
  try {
    const body = await request.json().catch(() => ({}))
    // Read offset from URL params (set by getNextParams in hook) or body
    const url = new URL(request.url)
    const limit = Math.min(body.limit || 20, 50)
    const offset = parseInt(url.searchParams.get("offset") || "0") || body.offset || 0
    const minScore = body.minScore || 0.2
    const mode = url.searchParams.get("mode") || body.mode || "batch" // "batch" (default) or "full"

    // Count total items for progress
    const totalItems = await prisma.mediaItem.count({
      where: { type: { in: ["MOVIE", "TV"] } },
    })

    const mediaItems = await prisma.mediaItem.findMany({
      where: {
        type: { in: ["MOVIE", "TV"] },
      },
      select: {
        id: true,
        title: true,
        type: true,
        genres: true,
        topics: true,
        director: true,
        expertAgeRec: true,
      },
      skip: offset,
      take: limit,
      orderBy: { updatedAt: "desc" },
    })

    let processed = 0
    let created = 0
    let updated = 0

    if (mode === "full") {
      // Full mode: compare each item in batch against ALL enriched items of same type
      for (const itemA of mediaItems) {
        // Fetch candidates of same type (enriched, with poster)
        const candidates = await prisma.mediaItem.findMany({
          where: {
            id: { not: itemA.id },
            type: itemA.type as any,
            isEnriched: true,
            posterUrl: { not: null },
          },
          select: {
            id: true,
            title: true,
            type: true,
            genres: true,
            topics: true,
            director: true,
            expertAgeRec: true,
          },
          take: 500, // Cap to avoid memory issues
        })

        for (const itemB of candidates) {
          processed++
          const { score, reasons } = computeSimilarity(itemA, itemB)
          if (score < minScore) continue

          const existing = await prisma.mediaSimilarity.findFirst({
            where: {
              OR: [
                { mediaIdA: itemA.id, mediaIdB: itemB.id },
                { mediaIdA: itemB.id, mediaIdB: itemA.id },
              ],
            },
          })

          if (existing) {
            if (Math.abs(existing.similarityScore - score) > 0.05) {
              await prisma.mediaSimilarity.update({
                where: { id: existing.id },
                data: { similarityScore: score, reasons, source: "ALGORITHM" as SimilaritySource },
              })
              updated++
            }
          } else {
            await prisma.mediaSimilarity.create({
              data: {
                mediaIdA: itemA.id,
                mediaIdB: itemB.id,
                similarityScore: score,
                reasons,
                source: "ALGORITHM" as SimilaritySource,
              },
            })
            created++
          }
        }
      }
    } else {
      // Batch mode (original): compare pairs within the batch only
      for (let i = 0; i < mediaItems.length; i++) {
        const itemA = mediaItems[i]

        for (let j = i + 1; j < mediaItems.length; j++) {
          const itemB = mediaItems[j]
          processed++

          const { score, reasons } = computeSimilarity(itemA, itemB)
          if (score < minScore) continue

          const existing = await prisma.mediaSimilarity.findFirst({
            where: {
              OR: [
                { mediaIdA: itemA.id, mediaIdB: itemB.id },
                { mediaIdA: itemB.id, mediaIdB: itemA.id },
              ],
            },
          })

          if (existing) {
            if (Math.abs(existing.similarityScore - score) > 0.05) {
              await prisma.mediaSimilarity.update({
                where: { id: existing.id },
                data: { similarityScore: score, reasons, source: "ALGORITHM" as SimilaritySource },
              })
              updated++
            }
          } else {
            await prisma.mediaSimilarity.create({
              data: {
                mediaIdA: itemA.id,
                mediaIdB: itemB.id,
                similarityScore: score,
                reasons,
                source: "ALGORITHM" as SimilaritySource,
              },
            })
            created++
          }
        }
      }
    }

    const nextOffset = offset + limit
    const done = nextOffset >= totalItems || mediaItems.length < limit

    if (done) {
      await logCronRun({
        task: "similarity",
        status: "success",
        summary: `${created} nouvelles similarites, ${updated} MAJ (${processed} paires)`,
        details: { processed, created, updated },
        startTime,
      })
    }

    return NextResponse.json({
      success: true,
      done,
      processed,
      created,
      updated,
      total: totalItems,
      nextOffset: done ? null : nextOffset,
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
