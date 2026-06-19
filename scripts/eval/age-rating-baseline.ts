/**
 * Plan B — baseline (read-only, no LLM / no cost).
 *
 * Measures how Totem's current `expertAgeRec` compares to (a) the official answer
 * key (PEGI for games; CSA/CNC for films/TV) and (b) the hand-labeled golden set
 * once it's filled. This is the "score to beat" for any future Totem Score model.
 *
 * IMPORTANT framing: official ratings are a *floor*, not ground truth — Totem
 * intentionally goes stricter than a lenient legal rating (that's the whole
 * point of the age-floor guardrail). So for films/TV, "disagreement" is not the
 * same as "error": Totem ABOVE the official rating is expected/healthy; Totem
 * BELOW it is the audit-worthy signal. PEGI (games) is reliable, so there the
 * numbers read as genuine accuracy.
 *
 * Run: npx tsx scripts/eval/age-rating-baseline.ts
 * Writes: docs/reports/eval/age-rating-baseline.md
 */
import { writeFileSync, mkdirSync } from "fs"
import { join } from "path"
import { prisma } from "../../src/lib/prisma"
import { officialToAge, ratingSystem } from "./rating-map"
import { computeStats, pct, type Stats } from "./metrics"
import { loadGoldenSet, GOLDEN_SET_PATH, AXIS_COLUMNS, type AxisKey } from "./golden-set"

const REPORT_DATE = "2026-06-19"

interface Row {
  type: string
  expertAgeRec: number
  officialRating: string
}

function statsBlock(title: string, note: string, s: Stats): string {
  return [
    `### ${title}`,
    "",
    note,
    "",
    `| Metric | Value |`,
    `|---|---|`,
    `| Items evaluated | ${s.n} |`,
    `| Mean absolute error (years) | ${s.mae} |`,
    `| Within ±1 year | ${s.within1}% |`,
    `| Within ±2 years | ${s.within2}% |`,
    `| Totem stricter than official (age >) | ${s.stricter}% |`,
    `| Totem equal to official | ${s.equal}% |`,
    `| Totem more lenient than official (age <) | ${s.lenient}% |`,
    "",
  ].join("\n")
}

async function main() {
  const items = (await prisma.mediaItem.findMany({
    where: { expertAgeRec: { not: null }, officialRating: { not: null }, type: { in: ["MOVIE", "TV", "GAME"] } },
    select: { type: true, expertAgeRec: true, officialRating: true },
  })) as Row[]

  const unmapped = new Map<string, number>()
  const games: { pred: number; ref: number }[] = []
  const filmTvRated: { pred: number; ref: number }[] = [] // official > 0 (a real age)
  const allAudienceFilmTv: number[] = [] // Totem age assigned where official = all-audiences (0)

  for (const it of items) {
    const age = officialToAge(it.officialRating)
    if (age === null) {
      unmapped.set(it.officialRating, (unmapped.get(it.officialRating) ?? 0) + 1)
      continue
    }
    if (it.type === "GAME" && ratingSystem(it.officialRating) === "PEGI") {
      games.push({ pred: it.expertAgeRec, ref: age })
    } else if (it.type === "MOVIE" || it.type === "TV") {
      if (age === 0) allAudienceFilmTv.push(it.expertAgeRec)
      else filmTvRated.push({ pred: it.expertAgeRec, ref: age })
    }
  }

  const totalFilmTv = filmTvRated.length + allAudienceFilmTv.length
  const gamesStats = computeStats(games)
  const filmStats = computeStats(filmTvRated)

  // All-audience (official = 0) Totem distribution — the meaningful guardrail
  // signal is how many "tous publics" titles Totem pushes to a pre-teen+ age
  // (the lenient-rating case, e.g. a war drama rated all-audiences).
  const aaDist = new Map<number, number>()
  for (const a of allAudienceFilmTv) aaDist.set(a, (aaDist.get(a) ?? 0) + 1)
  const aaTo10 = allAudienceFilmTv.filter((a) => a >= 10).length
  const aaTo12 = allAudienceFilmTv.filter((a) => a >= 12).length
  const aaSorted = [...aaDist.entries()].sort((a, b) => a[0] - b[0])

  // ── vs Gold (hand-labeled ground truth) ───────────────────
  // Unlike vs-official, BOTH directions are errors here, and "too lenient"
  // (Totem below gold) is the family-risk alert — so we relabel direction.
  const gold = loadGoldenSet()
  const goldLines: string[] = ["### vs Gold (hand-labeled ground truth)", ""]
  if (gold.size === 0) {
    goldLines.push(
      `_Awaiting labels — fill \`${GOLDEN_SET_PATH}\` (see \`data/golden-set/RUBRIC.md\`). Once rows are filled this scores Totem's current ratings against your hand-labeled family ages + content levels._`,
      "",
    )
  } else {
    const goldItems = await prisma.mediaItem.findMany({
      where: { id: { in: [...gold.keys()] } },
      select: {
        id: true, type: true, expertAgeRec: true,
        contentMetrics: {
          select: {
            violence: true, sexNudity: true, language: true, substanceUse: true,
            consumerism: true, positiveMessages: true, roleModels: true,
          },
        },
      },
    })
    const ageAll: { pred: number; ref: number }[] = []
    const ageByType: Record<string, { pred: number; ref: number }[]> = { MOVIE: [], TV: [], GAME: [] }
    const axisPairs: Record<string, { pred: number; ref: number }[]> = {}
    for (const it of goldItems) {
      const g = gold.get(it.id)!
      if (typeof it.expertAgeRec === "number") {
        ageAll.push({ pred: it.expertAgeRec, ref: g.age })
        ageByType[it.type]?.push({ pred: it.expertAgeRec, ref: g.age })
      }
      if (it.contentMetrics) {
        for (const axis of Object.keys(AXIS_COLUMNS) as AxisKey[]) {
          const gv = g.axes[axis]
          const pv = (it.contentMetrics as Record<string, number>)[axis]
          if (typeof gv === "number" && typeof pv === "number") {
            (axisPairs[axis] ??= []).push({ pred: pv, ref: gv })
          }
        }
      }
    }
    const a = computeStats(ageAll)
    goldLines.push(
      `Totem's current ratings vs your hand-labeled gold (**${a.n}** labeled of ${gold.size} in the sheet). Unlike the official sections, **both directions are errors**; **too lenient (Totem < gold) is the family-risk signal**.`,
      "",
      "**Age — overall**", "",
      "| Metric | Value |", "|---|---|",
      `| Labeled items | ${a.n} |`,
      `| Mean absolute error (years) | ${a.mae} |`,
      `| Within ±1 year | ${a.within1}% |`,
      `| Exact | ${a.equal}% |`,
      `| ⚠ Too lenient (Totem < gold) | ${a.lenient}% |`,
      `| Too strict (Totem > gold) | ${a.stricter}% |`,
      "",
      "**Age — by type**", "",
      "| Type | n | MAE | within ±1 | ⚠ too lenient |", "|---|---|---|---|---|",
      ...["MOVIE", "TV", "GAME"].map((t) => {
        const s = computeStats(ageByType[t])
        return s.n > 0 ? `| ${t} | ${s.n} | ${s.mae} | ${s.within1}% | ${s.lenient}% |` : null
      }).filter(Boolean) as string[],
      "",
      "**Content axes — Totem vs gold** (per-axis MAE / within ±1 level)", "",
      "| Axis | n | MAE | within ±1 |", "|---|---|---|---|",
      ...(Object.keys(AXIS_COLUMNS) as AxisKey[]).map((axis) => {
        const pairs = axisPairs[axis]
        if (!pairs || pairs.length === 0) return null
        const s = computeStats(pairs)
        return `| ${axis} | ${s.n} | ${s.mae} | ${s.within1}% |`
      }).filter(Boolean) as string[],
      "",
    )
  }

  const report = [
    `# Plan B — baseline: current ratings vs official + gold`,
    "",
    `_Generated ${REPORT_DATE}. Read-only DB measurement, no LLM calls. Source: \`scripts/eval/age-rating-baseline.ts\`._`,
    "",
    `**What this is:** how Totem's current \`expertAgeRec\` compares to the official answer key. This is the score any future Totem Score model must beat.`,
    "",
    `**How to read it:** official ratings are a legal *floor*, not ground truth. Totem deliberately goes stricter than lenient ratings, so **"Totem stricter" is expected/healthy**, and **"Totem more lenient than official" is the audit-worthy signal**. PEGI (games) is reliable, so those numbers read as genuine accuracy.`,
    "",
    `Total items with both a Totem age and a mappable official rating: **${games.length + totalFilmTv}** (games ${games.length}, films/TV ${totalFilmTv} — of which ${allAudienceFilmTv.length} are "tous publics", reported separately).`,
    "",
    statsBlock(
      "Games vs PEGI — cleanest accuracy signal",
      "PEGI is a dependable answer key and maps directly to an age. Treat these as the headline accuracy numbers.",
      gamesStats,
    ),
    statsBlock(
      "Rated films & TV vs CSA/CNC (official age > 0) — divergence from the legal floor",
      'Excludes "tous publics" (reported below), so the error is meaningful. Higher Totem ages are intended; watch the **more lenient** row — titles Totem rates *below* the legal rating, the cases worth auditing.',
      filmStats,
    ),
    `### All-audience films/TV (official = « tous publics »)`,
    "",
    `Totem never assigns 0+, so the useful question is how high it pushes these. Of **${allAudienceFilmTv.length}** "tous publics" films/TV, Totem rates **${aaTo10}** (${pct(aaTo10, allAudienceFilmTv.length)}%) at 10+ and **${aaTo12}** (${pct(aaTo12, allAudienceFilmTv.length)}%) at 12+ — the guardrail catching lenient ratings (the war-drama / Forrest Gump case). Totem age distribution for these:`,
    "",
    `| Totem age | Count |`,
    `|---|---|`,
    ...aaSorted.map(([age, count]) => `| ${age}+ | ${count} |`),
    "",
    ...goldLines,
    `### Unmapped official ratings`,
    "",
    unmapped.size === 0
      ? `None — every official rating mapped cleanly. ✅`
      : [...unmapped.entries()].map(([v, c]) => `- \`${v}\` ×${c}`).join("\n"),
    "",
    `### Takeaways for Plan B`,
    "",
    `- The games/PEGI numbers show how well the current pipeline already tracks a reliable answer key — the bar a Totem Score model must clear.`,
    `- The films/TV "more lenient than official" percentage is the **risk surface**: ideally near zero (Totem should rarely sit below the legal floor).`,
    `- The **vs Gold** section above is the real target (family age, not the legal floor). Fill \`${GOLDEN_SET_PATH}\` to populate it; "too lenient vs gold" is the metric that matters most.`,
    "",
  ].join("\n")

  // Console summary
  console.log("=== AGE-RATING BASELINE ===")
  console.log(`Eval set: ${games.length + totalFilmTv} items (games ${games.length}, film/TV ${totalFilmTv}; of which ${allAudienceFilmTv.length} tous-publics)`)
  console.log(`GAMES vs PEGI:      MAE ${gamesStats.mae}y | ±1 ${gamesStats.within1}% | ±2 ${gamesStats.within2}% | stricter ${gamesStats.stricter}% / equal ${gamesStats.equal}% / lenient ${gamesStats.lenient}%`)
  console.log(`RATED FILM/TV vs CSA: MAE ${filmStats.mae}y | ±1 ${filmStats.within1}% | ±2 ${filmStats.within2}% | stricter ${filmStats.stricter}% / equal ${filmStats.equal}% / lenient ${filmStats.lenient}%`)
  console.log(`All-audience film/TV: ${aaTo10}/${allAudienceFilmTv.length} at 10+ (${pct(aaTo10, allAudienceFilmTv.length)}%), ${aaTo12} at 12+ (${pct(aaTo12, allAudienceFilmTv.length)}%)`)
  console.log(`vs GOLD: ${gold.size === 0 ? "awaiting labels (sheet empty/unfilled)" : `${gold.size} rows in sheet, scored above`}`)
  if (unmapped.size > 0) console.log("Unmapped (excluded):", [...unmapped.entries()])

  const outDir = join(process.cwd(), "docs", "reports", "eval")
  mkdirSync(outDir, { recursive: true })
  const outPath = join(outDir, "age-rating-baseline.md")
  writeFileSync(outPath, report, "utf8")
  console.log(`\nReport written: ${outPath}`)
}

main()
  .catch((e) => {
    console.error(e)
    process.exit(1)
  })
  .finally(() => prisma.$disconnect())
