/**
 * Probes TMDB watch-providers directly for a sample of DB items so we can
 * see what TMDB *actually* returns for French providers. This tells us
 * whether "49/50 no providers" is a TMDB data gap or a bug in our
 * PROVIDER_NAME_MAP normalization.
 *
 *   npx tsx scripts/probe-streaming.ts
 */

import "dotenv/config"
import { PrismaClient } from "@prisma/client"

const prisma = new PrismaClient()

async function fetchWatch(type: "movie" | "tv", id: number) {
  const key = process.env.TMDB_API_KEY
  const res = await fetch(
    `https://api.themoviedb.org/3/${type}/${id}/watch/providers?api_key=${key}`,
  )
  if (!res.ok) return { error: `HTTP ${res.status}` }
  const json = await res.json()
  return json.results?.FR ?? null
}

async function main() {
  const sample = await prisma.mediaItem.findMany({
    where: { tmdbId: { not: null }, type: { in: ["MOVIE", "TV"] } },
    orderBy: { tmdbRating: "desc" }, // probe popular items first
    take: 15,
    select: { id: true, title: true, type: true, tmdbId: true, platforms: true },
  })

  console.log(`\nProbing ${sample.length} items for French streaming providers:\n`)

  let hadData = 0
  let empty = 0
  const unmappedNames = new Set<string>()

  for (const item of sample) {
    const type = item.type === "MOVIE" ? "movie" : "tv"
    const fr = await fetchWatch(type, item.tmdbId!)
    const label = `${item.title.padEnd(44).slice(0, 44)} (tmdb ${item.tmdbId})`
    if (fr && typeof fr === "object" && "error" in fr) {
      console.log(`✗ ${label}  ${fr.error}`)
      continue
    }
    if (!fr) {
      empty++
      console.log(`- ${label}  no FR data`)
      continue
    }
    hadData++
    const parts: string[] = []
    if (fr.flatrate?.length) {
      parts.push(`flatrate: ${fr.flatrate.map((p: { provider_name: string }) => p.provider_name).join(", ")}`)
      fr.flatrate.forEach((p: { provider_name: string }) => unmappedNames.add(p.provider_name))
    }
    if (fr.free?.length) {
      parts.push(`free: ${fr.free.map((p: { provider_name: string }) => p.provider_name).join(", ")}`)
    }
    if (fr.rent?.length) {
      parts.push(`rent: ${fr.rent.length} providers`)
    }
    if (fr.buy?.length) {
      parts.push(`buy: ${fr.buy.length} providers`)
    }
    if (parts.length === 0) parts.push("FR key exists but all arrays empty")
    console.log(`✓ ${label}  ${parts.join("  |  ")}`)
    // Tiny delay to respect TMDB rate limits
    await new Promise((r) => setTimeout(r, 150))
  }

  console.log(`\nSummary: ${hadData} with data, ${empty} empty`)
  if (unmappedNames.size > 0) {
    console.log(`\nAll flatrate provider_name values we saw:`)
    Array.from(unmappedNames).sort().forEach((n) => console.log(`  · ${n}`))
  }
}

main()
  .catch((e) => {
    console.error(e)
    process.exit(1)
  })
  .finally(() => prisma.$disconnect())
