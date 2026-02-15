import { NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"

// Mapping from raw TMDB values to internal format
// NR (Not Rated) maps to null — unknown ≠ "Tous publics"
const certificationMap: Record<string, string | null> = {
  "U": "TOUS_PUBLICS",
  "TP": "TOUS_PUBLICS",
  "10": "CSA_10",
  "12": "CSA_12",
  "16": "CSA_16",
  "18": "CSA_18",
  "NR": null,
}

export async function POST() {
  try {
    // Get all movies and TV shows with raw certification values
    const mediaItems = await prisma.mediaItem.findMany({
      where: {
        type: { in: ["MOVIE", "TV"] },
        officialRating: { in: Object.keys(certificationMap) },
      },
      select: {
        id: true,
        title: true,
        type: true,
        officialRating: true,
      },
    })

    let fixed = 0
    const details: string[] = []

    for (const item of mediaItems) {
      const raw = item.officialRating!
      if (!(raw in certificationMap)) continue

      const newRating = certificationMap[raw]
      await prisma.mediaItem.update({
        where: { id: item.id },
        data: { officialRating: newRating },
      })
      fixed++
    }

    details.push(`Fixed ${fixed} items with raw certification values`)

    return NextResponse.json({
      success: true,
      fixed,
      total: mediaItems.length,
      details,
    })
  } catch (error) {
    console.error("Certification fix error:", error)
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : "Fix failed",
      },
      { status: 500 }
    )
  }
}

export async function GET() {
  // Check how many items need fixing
  const needsFixing = await prisma.mediaItem.count({
    where: {
      type: { in: ["MOVIE", "TV"] },
      officialRating: { in: Object.keys(certificationMap) },
    },
  })

  const alreadyFixed = await prisma.mediaItem.count({
    where: {
      type: { in: ["MOVIE", "TV"] },
      officialRating: { in: ["TOUS_PUBLICS", "CSA_10", "CSA_12", "CSA_16", "CSA_18"] },
    },
  })

  return NextResponse.json({
    needsFixing,
    alreadyFixed,
    message: needsFixing > 0
      ? `${needsFixing} éléments à corriger. Utilisez POST pour lancer la correction.`
      : "Toutes les certifications sont correctes.",
  })
}
