/**
 * Plan B — Step 1: generate the golden-set labeling sheet.
 *
 * Selects a stratified ~150-title sample and writes a spreadsheet-friendly CSV
 * with read-only context columns + blank columns for the owner to fill (the
 * correct family age + per-axis content levels). Deterministic (seeded), so
 * re-running reproduces the same sample.
 *
 * Anti-anchoring: the sheet deliberately omits Totem's current expertAgeRec /
 * content metrics, so the labeler judges independently.
 *
 * Run: npx tsx scripts/eval/golden-set-generate.ts
 * Writes: data/golden-set/golden-set-v1.csv  (BLANK gold columns)
 */
import { writeFileSync, mkdirSync } from "fs"
import { join, dirname } from "path"
import { prisma } from "../../src/lib/prisma"
import { seededShuffle } from "../../src/lib/seeded-shuffle"
import { officialToAge, ratingSystem } from "./rating-map"
import { toCsvLine, GOLDEN_SET_PATH, AXIS_COLUMNS } from "./golden-set"

// Fixed seed → reproducible sample. Bump to roll a fresh selection.
const SEED = 20260619

const QUOTAS: Record<string, number> = { MOVIE: 70, TV: 35, GAME: 45 }

const AGE_BANDS: [number, number][] = [
  [0, 5], [6, 7], [8, 9], [10, 11], [12, 13], [14, 15], [16, 99],
]
const bandOf = (age: number) => AGE_BANDS.findIndex(([lo, hi]) => age >= lo && age <= hi)

interface Cand {
  id: string
  type: string
  title: string
  year: string
  genres: string[]
  officialRating: string
  officialAge: number | null
  expertAge: number
  tmdbVoteCount: number
  synopsis: string
  info: boolean // informative case (over-sampled)
}

function sanitize(s: string | null): string {
  return (s ?? "").replace(/\s+/g, " ").trim().slice(0, 300)
}

/** Stratified pick for one type: spread over age bands, informative cases first,
 *  non-informative fill ordered by popularity (well-known anchors). */
function selectForType(cands: Cand[], quota: number, seed: number): Cand[] {
  const byBand = new Map<number, Cand[]>()
  for (const c of cands) {
    const b = bandOf(c.expertAge)
    if (!byBand.has(b)) byBand.set(b, [])
    byBand.get(b)!.push(c)
  }
  const bands = [...byBand.keys()].sort((a, b) => a - b)
  const base = Math.floor(quota / Math.max(1, bands.length))
  let remainder = quota - base * bands.length

  const picked: Cand[] = []
  // Per band: ~70% informative (the divergent/high-signal cases), ~30%
  // representative — non-informative ordered by popularity so well-known anchors
  // come in. Top up from whichever pool has spares.
  for (const b of bands) {
    const alloc = base + (remainder-- > 0 ? 1 : 0)
    const pool = byBand.get(b)!
    const info = seededShuffle(pool.filter((c) => c.info), seed + b)
    const rest = pool.filter((c) => !c.info).sort((a, b2) => b2.tmdbVoteCount - a.tmdbVoteCount)
    const infoTake = Math.min(info.length, Math.ceil(alloc * 0.7))
    const chosen = info.slice(0, infoTake)
    chosen.push(...rest.slice(0, alloc - chosen.length))
    if (chosen.length < alloc) chosen.push(...info.slice(infoTake, infoTake + (alloc - chosen.length)))
    picked.push(...chosen)
  }
  // Fill any shortfall (bands smaller than their allocation) from leftovers,
  // informative-first, no duplicates.
  if (picked.length < quota) {
    const chosen = new Set(picked.map((c) => c.id))
    const leftover = [
      ...seededShuffle(cands.filter((c) => c.info && !chosen.has(c.id)), seed + 999),
      ...cands.filter((c) => !c.info && !chosen.has(c.id)).sort((a, b) => b.tmdbVoteCount - a.tmdbVoteCount),
    ]
    picked.push(...leftover.slice(0, quota - picked.length))
  }
  return picked.slice(0, quota)
}

async function main() {
  const rows = await prisma.mediaItem.findMany({
    where: {
      isEnriched: true,
      expertAgeRec: { not: null },
      officialRating: { not: null },
      synopsisFr: { not: null },
      type: { in: ["MOVIE", "TV", "GAME"] },
    },
    select: {
      id: true, type: true, title: true, genres: true, expertAgeRec: true,
      officialRating: true, synopsisFr: true, releaseDate: true, tmdbVoteCount: true,
    },
  })

  const selected: Cand[] = []
  for (const type of ["MOVIE", "TV", "GAME"] as const) {
    const cands: Cand[] = rows
      .filter((r) => r.type === type)
      .map((r) => {
        const expertAge = r.expertAgeRec as number
        const officialAge = officialToAge(r.officialRating)
        // Disagreement only counts for RATED titles (official > 0); vs an
        // all-audience floor (0) it's trivially true for every film, so that
        // case is captured by lenientTP instead.
        const disagree = officialAge !== null && officialAge > 0 && Math.abs(expertAge - officialAge) >= 2
        const lenientTP = officialAge === 0 && expertAge >= 10
        const lenientPegi =
          type === "GAME" &&
          ratingSystem(r.officialRating) === "PEGI" &&
          officialAge !== null && officialAge > 0 && expertAge < officialAge
        return {
          id: r.id,
          type,
          title: r.title,
          year: r.releaseDate ? String(r.releaseDate.getFullYear()) : "",
          genres: r.genres ?? [],
          officialRating: r.officialRating as string,
          officialAge,
          expertAge,
          tmdbVoteCount: r.tmdbVoteCount ?? 0,
          synopsis: sanitize(r.synopsisFr),
          info: disagree || lenientTP || lenientPegi,
        }
      })
    selected.push(...selectForType(cands, QUOTAS[type], SEED))
  }

  // Stable order in the sheet: by type then title.
  selected.sort((a, b) => a.type.localeCompare(b.type) || a.title.localeCompare(b.title))

  const axisCols = Object.values(AXIS_COLUMNS)
  const header = [
    "id", "type", "title", "year", "genres", "official_rating", "synopsis", "fiche_url",
    "gold_age", ...axisCols, "notes",
  ]
  const lines = [toCsvLine(header)]
  for (const c of selected) {
    lines.push(
      toCsvLine([
        c.id, c.type, c.title, c.year, c.genres.join("; "), c.officialRating, c.synopsis,
        `https://totemavise.com/media/${c.id}`,
        "", ...axisCols.map(() => ""), "", // blank gold cols + notes
      ]),
    )
  }

  const outPath = join(process.cwd(), GOLDEN_SET_PATH)
  mkdirSync(dirname(outPath), { recursive: true })
  writeFileSync(outPath, lines.join("\n") + "\n", "utf8")

  // Report distribution
  const byType: Record<string, number> = {}
  const infoByType: Record<string, number> = {}
  const bandCount: Record<number, number> = {}
  for (const c of selected) {
    byType[c.type] = (byType[c.type] ?? 0) + 1
    if (c.info) infoByType[c.type] = (infoByType[c.type] ?? 0) + 1
    const b = bandOf(c.expertAge)
    bandCount[b] = (bandCount[b] ?? 0) + 1
  }
  console.log("=== GOLDEN SET GENERATED ===")
  console.log(`Seed: ${SEED} (constant in script — reproducible)`)
  console.log(`Total: ${selected.length} rows → ${GOLDEN_SET_PATH}`)
  console.log("By type:", byType)
  console.log("Informative (over-sampled) by type:", infoByType)
  console.log(
    "By age band:",
    AGE_BANDS.map(([lo, hi], i) => `${lo}-${hi === 99 ? "16+" : hi}:${bandCount[i] ?? 0}`).join("  "),
  )
  console.log("\nNext: fill gold_age + axis columns in a spreadsheet (see data/golden-set/RUBRIC.md). Blank rows are skipped by the harness.")
}

main()
  .catch((e) => { console.error(e); process.exit(1) })
  .finally(() => prisma.$disconnect())
