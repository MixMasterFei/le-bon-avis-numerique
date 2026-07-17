/**
 * Baromètre « Tous publics » — read-only cohort analysis (no writes).
 *
 *   npx tsx scripts/barometre-tp.ts                 # human report
 *   npx tsx scripts/barometre-tp.ts --csv           # + audit sample as CSV
 *   npx tsx scripts/barometre-tp.ts --sample 100    # audit sample size (default 40)
 *
 * The headline finding: of the films the French classification leaves
 * UNRESTRICTED ("Tous publics"), what share does Totem Avisé nonetheless
 * advise for 12 ans ou plus?
 *
 * COHORT HYGIENE — read this before quoting any number publicly.
 *
 * `officialRating` carries NO provenance column, and TMDB maps a bare "U"
 * (UK) or "TP" to TOUS_PUBLICS regardless of country (src/lib/tmdb.ts
 * mapCertificationToInternal). It can also hold stale false-default "TP"
 * values (that's why the admin "Fix faux TP" op exists). So a raw
 * TOUS_PUBLICS count is NOT a finding about *French* classification.
 *
 * To make the cohort French-traceable, run the cleanup FIRST:
 *
 *   POST /api/admin/fix-default-tp   (loop until { done: true })
 *
 * It re-checks each TOUS_PUBLICS movie/TV against its FR-region
 * certification (getFrenchCertification / getTVFrenchRating, both filtered
 * to iso_3166_1 === "FR") and resets anything not corroborated by a French
 * cert. Everything that survives is unrestricted *in France*.
 *
 * This script then applies the offline hygiene it can enforce without the
 * network — enriched only (needs a Totem age + metrics), tmdbId present
 * (so it was re-checkable by the cleanup), and de-duplicated by title+year
 * — and reports the surviving N so a large drop from the raw count is
 * visible. The sensitivity averages are EXPLANATION (what drives Totem's
 * advice), never independent VALIDATION: Totem's age and its sensitivity
 * axes come from the same pipeline, so their correlation is partly by
 * construction. The defensible external finding is the gap between
 * "unrestricted" and "advised for older children". See
 * docs/marketing/barometre-methodo.md.
 */
import { config } from "dotenv"
config({ path: ".env.local" })
config({ path: ".env" })

import { PrismaClient, type MediaType } from "@prisma/client"

const prisma = new PrismaClient()
const VIDEO: MediaType[] = ["MOVIE", "TV"]

const args = process.argv.slice(2)
const asCsv = args.includes("--csv")
const sampleSize = (() => {
  const i = args.indexOf("--sample")
  const n = i >= 0 ? parseInt(args[i + 1] ?? "", 10) : NaN
  return Number.isFinite(n) && n > 0 ? n : 40
})()

type Axis = "violence" | "sexNudity" | "language" | "substanceUse"
const AXES: Axis[] = ["violence", "sexNudity", "language", "substanceUse"]
const AXIS_FR: Record<Axis, string> = {
  violence: "Violence",
  sexNudity: "Sexe/nudité",
  language: "Langage",
  substanceUse: "Substances",
}

type Row = {
  title: string
  year: number | null
  age: number
  genres: string[]
  lang: string | null
  metrics: Record<Axis, number>
}

const pct = (n: number, d: number) => (d ? ((100 * n) / d).toFixed(1) + " %" : "—")
const mean = (xs: number[]) => (xs.length ? xs.reduce((a, b) => a + b, 0) / xs.length : 0)
const f2 = (x: number) => x.toFixed(2)

function normTitle(t: string) {
  return t.trim().toLowerCase().replace(/\s+/g, " ")
}

async function main() {
  // --- Raw counts, to make the hygiene drop visible ---------------------
  const rawTP = await prisma.mediaItem.count({
    where: { type: { in: VIDEO }, officialRating: "TOUS_PUBLICS" },
  })
  const rawTPRecheckable = await prisma.mediaItem.count({
    where: { type: { in: VIDEO }, officialRating: "TOUS_PUBLICS", tmdbId: { not: null } },
  })

  // --- Cohort: French-unrestricted, enriched, offline-clean -------------
  const raw = await prisma.mediaItem.findMany({
    where: {
      type: { in: VIDEO },
      officialRating: "TOUS_PUBLICS",
      isEnriched: true,
      expertAgeRec: { not: null },
      tmdbId: { not: null },
      contentMetrics: { isNot: null },
    },
    select: {
      title: true,
      releaseDate: true,
      genres: true,
      originalLanguage: true,
      expertAgeRec: true,
      contentMetrics: {
        select: { violence: true, sexNudity: true, language: true, substanceUse: true },
      },
    },
  })

  // De-dup defensively by normalized title + year (catches the rare remake
  // /alternate-edition double that shares neither tmdbId). Keep the first.
  const seen = new Set<string>()
  const rows: Row[] = []
  let collapsed = 0
  for (const r of raw) {
    const year = r.releaseDate ? new Date(r.releaseDate).getUTCFullYear() : null
    const key = `${normTitle(r.title)}|${year ?? "?"}`
    if (seen.has(key)) {
      collapsed++
      continue
    }
    seen.add(key)
    rows.push({
      title: r.title,
      year,
      age: r.expertAgeRec as number,
      genres: r.genres,
      lang: r.originalLanguage,
      metrics: {
        violence: r.contentMetrics!.violence,
        sexNudity: r.contentMetrics!.sexNudity,
        language: r.contentMetrics!.language,
        substanceUse: r.contentMetrics!.substanceUse,
      },
    })
  }

  const N = rows.length
  const ages = rows.map((r) => r.age)

  console.log("======================================================================")
  console.log("  BAROMÈTRE « TOUS PUBLICS » — cohorte")
  console.log("  (snapshot: fige la date + la version de la méthodo au moment du run)")
  console.log("======================================================================\n")

  console.log("Hygiène de la cohorte :")
  console.log(`  TOUS_PUBLICS bruts (film/série)          : ${rawTP}`)
  console.log(`  … re-vérifiables (tmdbId présent)        : ${rawTPRecheckable}`)
  console.log(`  Cohorte retenue (enrichis, dédupliqués)  : ${N}`)
  console.log(`  Doublons titre+année écartés             : ${collapsed}`)
  if (rawTPRecheckable < rawTP) {
    console.log(
      `  ⚠︎  ${rawTP - rawTPRecheckable} TP sans tmdbId ne sont pas re-vérifiables — écartés de fait.`,
    )
  }
  console.log(
    "  ⚠︎  Lancez d'abord POST /api/admin/fix-default-tp (jusqu'à done:true) pour",
  )
  console.log("      que TOUS_PUBLICS = « non restreint EN FRANCE » (certif FR corroborée).\n")

  if (N === 0) {
    console.log("Cohorte vide — rien à analyser.")
    await prisma.$disconnect()
    return
  }

  // --- Headline distribution -------------------------------------------
  const ge12 = ages.filter((a) => a >= 12).length
  const ge8 = ages.filter((a) => a >= 8).length
  const le6 = ages.filter((a) => a <= 6).length

  console.log("Distribution des âges conseillés par Totem (sur une cohorte non restreinte) :")
  console.log(`  ★ conseillé 12 ans ou plus  : ${ge12}/${N}  (${pct(ge12, N)})   ← titre`)
  console.log(`    conseillé 8 ans ou plus   : ${ge8}/${N}  (${pct(ge8, N)})`)
  console.log(`    conseillé 6 ans ou moins  : ${le6}/${N}  (${pct(le6, N)})`)
  console.log("")
  console.log("  Histogramme (âge conseillé → nb, part) :")
  const histo = new Map<number, number>()
  for (const a of ages) histo.set(a, (histo.get(a) ?? 0) + 1)
  for (const age of [...histo.keys()].sort((a, b) => a - b)) {
    const c = histo.get(age)!
    console.log(`    ${String(age).padStart(2)} ans : ${String(c).padStart(4)}  (${pct(c, N)})`)
  }
  console.log("")

  // --- Sensitivity contrast (EXPLANATION, not validation) --------------
  const grpHigh = rows.filter((r) => r.age >= 12)
  const grpLow = rows.filter((r) => r.age <= 11)
  console.log("Moyennes de sensibilité (0–5) — EXPLICATION, pas validation :")
  console.log(`  ${"Axe".padEnd(14)} ${"≥12 ans".padStart(10)} ${"≤11 ans".padStart(10)} ${"écart".padStart(8)}`)
  for (const ax of AXES) {
    const hi = mean(grpHigh.map((r) => r.metrics[ax]))
    const lo = mean(grpLow.map((r) => r.metrics[ax]))
    console.log(
      `  ${AXIS_FR[ax].padEnd(14)} ${f2(hi).padStart(10)} ${f2(lo).padStart(10)} ${("+" + f2(hi - lo)).padStart(8)}`,
    )
  }
  console.log(`  (n ≥12 = ${grpHigh.length} · n ≤11 = ${grpLow.length})\n`)

  // --- Genre cut --------------------------------------------------------
  const byGenre = new Map<string, Row[]>()
  for (const r of rows) for (const g of r.genres) {
    if (!byGenre.has(g)) byGenre.set(g, [])
    byGenre.get(g)!.push(r)
  }
  const GENRE_MIN = 20
  const genreTable = [...byGenre.entries()]
    .filter(([, rs]) => rs.length >= GENRE_MIN)
    .map(([g, rs]) => ({
      g,
      n: rs.length,
      share12: rs.filter((r) => r.age >= 12).length / rs.length,
      meanAge: mean(rs.map((r) => r.age)),
    }))
    .sort((a, b) => b.share12 - a.share12)
  console.log(`Par genre (≥ ${GENRE_MIN} titres), trié par part conseillée 12+ :`)
  console.log(`  ${"Genre".padEnd(22)} ${"n".padStart(5)} ${"part 12+".padStart(10)} ${"âge moy.".padStart(9)}`)
  for (const row of genreTable) {
    console.log(
      `  ${row.g.padEnd(22)} ${String(row.n).padStart(5)} ${pct(Math.round(row.share12 * row.n), row.n).padStart(10)} ${row.meanAge.toFixed(1).padStart(9)}`,
    )
  }
  console.log("")

  // --- Decade cut -------------------------------------------------------
  const byDecade = new Map<number, Row[]>()
  for (const r of rows) {
    if (r.year == null) continue
    const d = Math.floor(r.year / 10) * 10
    if (!byDecade.has(d)) byDecade.set(d, [])
    byDecade.get(d)!.push(r)
  }
  console.log("Par décennie de sortie (le « second récit » : classiques vs récents) :")
  console.log(`  ${"Décennie".padEnd(10)} ${"n".padStart(5)} ${"part 12+".padStart(10)} ${"âge moy.".padStart(9)}`)
  for (const d of [...byDecade.keys()].sort((a, b) => a - b)) {
    const rs = byDecade.get(d)!
    const share12 = rs.filter((r) => r.age >= 12).length
    console.log(
      `  ${(d + "s").padEnd(10)} ${String(rs.length).padStart(5)} ${pct(share12, rs.length).padStart(10)} ${mean(rs.map((r) => r.age)).toFixed(1).padStart(9)}`,
    )
  }
  console.log("")

  // --- Manual-audit sample (biggest official↔Totem disagreements) -------
  // Every row is officially unrestricted (implied age 0), so the gap is the
  // Totem age itself; tie-break on total sensitivity. This seeds the ~100-
  // film human audit AND the "ten recognizable examples" for the press kit.
  const sample = [...rows]
    .sort((a, b) => {
      if (b.age !== a.age) return b.age - a.age
      const sb = AXES.reduce((s, ax) => s + b.metrics[ax], 0)
      const sa = AXES.reduce((s, ax) => s + a.metrics[ax], 0)
      return sb - sa
    })
    .slice(0, sampleSize)

  if (asCsv) {
    console.log("titre,annee,age_totem,violence,sexe_nudite,langage,substances,langue")
    for (const r of sample) {
      const t = `"${r.title.replace(/"/g, '""')}"`
      console.log(
        [t, r.year ?? "", r.age, r.metrics.violence, r.metrics.sexNudity, r.metrics.language, r.metrics.substanceUse, r.lang ?? ""].join(","),
      )
    }
  } else {
    console.log(`Échantillon d'audit manuel — ${sample.length} plus gros écarts (relire à la main) :`)
    for (const r of sample) {
      const v = AXES.map((ax) => `${ax[0]}${r.metrics[ax]}`).join(" ")
      console.log(`  ${String(r.age).padStart(2)}+  ${(r.title + (r.year ? ` (${r.year})` : "")).padEnd(48).slice(0, 48)}  ${v}`)
    }
    console.log("\n  (relancez avec --csv pour un fichier tableur, --sample 100 pour 100 titres)")
  }

  await prisma.$disconnect()
}

main().catch(async (e) => {
  console.error(e)
  await prisma.$disconnect()
  process.exit(1)
})
