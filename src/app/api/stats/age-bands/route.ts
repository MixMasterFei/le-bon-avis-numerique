import { NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { AGE_BANDS, ageBandCatalogWhere } from "@/lib/age-bands"

// Exclusive per-band catalog counts for the homepage "Par âge" grid — the
// same filter as the /age/[range] destination pages (shared via
// src/lib/age-bands.ts), so the number a parent clicks matches what the page
// lists. Public aggregate, CDN-cached for an hour.
export async function GET() {
  try {
    const entries = await Promise.all(
      AGE_BANDS.map(
        async (b) =>
          [b.key, await prisma.mediaItem.count({ where: ageBandCatalogWhere(b.min, b.max) })] as const,
      ),
    )
    return NextResponse.json(
      { counts: Object.fromEntries(entries) },
      {
        headers: {
          "Cache-Control": "public, s-maxage=3600, stale-while-revalidate=86400",
        },
      },
    )
  } catch (error) {
    console.error("age-bands stats error:", error)
    return NextResponse.json({ error: "Erreur de calcul" }, { status: 500 })
  }
}
