import type { Prisma } from "@prisma/client"

/**
 * Rotation queue of the weekly "titres proches" recompute
 * (/api/admin/similarity/compute). Each call takes the titles whose
 * similarities are the LEAST recently computed — never computed first — and
 * stamps `similarityComputedAt`, so consecutive calls and consecutive Saturdays
 * cover the whole catalogue instead of restarting from the same place.
 *
 * It used to page with skip/offset over ORDER BY updatedAt DESC from offset 0
 * every Saturday: the same ~1 000 of ~9 700 enriched titles were recomputed
 * each week and the rest never were.
 */

/**
 * A title is due once its similarities are older than this. At ~1 000 titles
 * per Saturday run the ~9 700 enriched films/series take about ten weeks to
 * cover; 90 days keeps the steady-state load under that capacity, while
 * never-computed titles (new enrichments) always go first.
 */
export const SIMILARITY_RECOMPUTE_DAYS = 90

export function similarityDueWhere(now: Date = new Date()): Prisma.MediaItemWhereInput {
  return {
    type: { in: ["MOVIE", "TV"] },
    isEnriched: true,
    OR: [
      { similarityComputedAt: null },
      { similarityComputedAt: { lt: new Date(now.getTime() - SIMILARITY_RECOMPUTE_DAYS * 24 * 60 * 60 * 1000) } },
    ],
  }
}

export const SIMILARITY_ROTATION_ORDER: Prisma.MediaItemOrderByWithRelationInput[] = [
  { similarityComputedAt: { sort: "asc", nulls: "first" } },
  { id: "asc" },
]
