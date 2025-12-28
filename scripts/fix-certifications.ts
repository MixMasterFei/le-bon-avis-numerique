/**
 * Migration script to fix existing certification values in the database
 *
 * Run with: npx tsx scripts/fix-certifications.ts
 */

import { PrismaClient } from "@prisma/client"

const prisma = new PrismaClient()

// Mapping from raw TMDB values to internal format
const certificationMap: Record<string, string> = {
  "U": "TOUS_PUBLICS",
  "TP": "TOUS_PUBLICS",
  "10": "CSA_10",
  "12": "CSA_12",
  "16": "CSA_16",
  "18": "CSA_18",
  // TV-specific (some may come as NR)
  "NR": "TOUS_PUBLICS",
}

async function fixCertifications() {
  console.log("Starting certification fix migration...")

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

  console.log(`Found ${mediaItems.length} items with raw certification values to fix`)

  let fixed = 0
  let errors = 0

  for (const item of mediaItems) {
    const newRating = certificationMap[item.officialRating!]

    if (newRating) {
      try {
        await prisma.mediaItem.update({
          where: { id: item.id },
          data: { officialRating: newRating },
        })
        console.log(`✓ Fixed "${item.title}" (${item.type}): ${item.officialRating} → ${newRating}`)
        fixed++
      } catch (error) {
        console.error(`✗ Error fixing "${item.title}":`, error)
        errors++
      }
    }
  }

  console.log(`\nMigration complete:`)
  console.log(`  - Fixed: ${fixed}`)
  console.log(`  - Errors: ${errors}`)
  console.log(`  - Total processed: ${mediaItems.length}`)
}

fixCertifications()
  .catch(console.error)
  .finally(() => prisma.$disconnect())
