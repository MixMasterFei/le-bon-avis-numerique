import { NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { SimilaritySource } from "@prisma/client"

/**
 * Compute media similarities based on:
 * - Same director
 * - Shared genres
 * - Similar age recommendation
 * - Shared topics
 * - Same franchise/series
 */
export async function POST(request: Request) {
  try {
    const body = await request.json().catch(() => ({}))
    const limit = Math.min(body.limit || 50, 100) // Max 100 items per batch
    const minScore = body.minScore || 0.3 // Minimum similarity score to save

    // Get media items with genres and topics for comparison
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
      take: limit,
      orderBy: { updatedAt: "desc" },
    })

    let processed = 0
    let created = 0
    let updated = 0
    const details: string[] = []

    // Compare each pair of media items
    for (let i = 0; i < mediaItems.length; i++) {
      const itemA = mediaItems[i]

      for (let j = i + 1; j < mediaItems.length; j++) {
        const itemB = mediaItems[j]
        processed++

        const { score, reasons } = computeSimilarity(itemA, itemB)

        // Only save if score is above threshold
        if (score < minScore) continue

        // Check if similarity already exists
        const existing = await prisma.mediaSimilarity.findFirst({
          where: {
            OR: [
              { mediaIdA: itemA.id, mediaIdB: itemB.id },
              { mediaIdA: itemB.id, mediaIdB: itemA.id },
            ],
          },
        })

        if (existing) {
          // Update if score changed significantly
          if (Math.abs(existing.similarityScore - score) > 0.05) {
            await prisma.mediaSimilarity.update({
              where: { id: existing.id },
              data: {
                similarityScore: score,
                reasons,
                source: "ALGORITHM" as SimilaritySource,
              },
            })
            updated++
            details.push(
              `↻ ${itemA.title} ↔ ${itemB.title}: ${Math.round(score * 100)}%`
            )
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
          details.push(
            `✓ ${itemA.title} ↔ ${itemB.title}: ${Math.round(score * 100)}%`
          )
        }
      }
    }

    return NextResponse.json({
      success: true,
      processed,
      created,
      updated,
      details: details.slice(0, 50), // Limit details
    })
  } catch (error) {
    console.error("Similarity compute error:", error)
    return NextResponse.json(
      { error: "Failed to compute similarities" },
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
