// Diffs the curated heritage/seasonal watchlist against the catalogue.
//
// Matching is deliberately strict-but-tolerant: normalised title equality plus a
// ±1 year window. A substring/ILIKE match is NOT usable here — "Les Visiteurs"
// would match "Les Visiteurs d'un autre monde" (1978) and "Les Visiteurs : La
// Révolution" (2016) and report a title as present that we do not actually have,
// which is the worst possible failure for a gap report. The year window absorbs
// TMDB's country-dependent release dates; `aliases` absorb localised titles.
//
// This module stays free of any DB import so the matching rules can be unit
// tested (and reused from a script) without a generated Prisma client. The
// caller supplies the catalogue slice — see `buildHeritageGap`.

import {
  HERITAGE_WATCHLIST,
  HERITAGE_CATEGORY_LABELS,
  type HeritageEntry,
  type HeritageCategory,
} from "./heritage-watchlist"

/**
 * Lowercase, strip accents/punctuation, normalise "&"→"et", collapse spaces.
 *
 * Order matters: `toLowerCase()` runs BEFORE the diacritic strip. A SQL mirror
 * of this function that ran a lowercase-only `translate()` first left uppercase
 * "É" untouched and silently reported "L'Étrange Noël de monsieur Jack" as
 * missing when we had it.
 */
export function normalizeTitle(s: string): string {
  return s
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "") // combining diacritics
    .replace(/&/g, " et ")
    .replace(/[^a-z0-9]+/g, " ")
    .trim()
}

/** Every spelling an entry may legitimately appear under. */
export function entryTitleForms(entry: HeritageEntry): string[] {
  return [entry.title, ...(entry.aliases ?? [])].map(normalizeTitle)
}

export interface CatalogTitle {
  id: string
  title: string
  year: number | null
}

/** How far a catalogue release year may drift from the canonical one. */
const YEAR_TOLERANCE = 1

export function matchesEntry(entry: HeritageEntry, candidate: CatalogTitle): boolean {
  const forms = entryTitleForms(entry)
  if (!forms.includes(normalizeTitle(candidate.title))) return false
  // A title with no date can't be disambiguated from a remake — accept it, but
  // only because the title matched exactly.
  if (candidate.year == null) return true
  return Math.abs(candidate.year - entry.year) <= YEAR_TOLERANCE
}

export interface HeritageGapRow {
  entry: HeritageEntry
  present: boolean
  /** The catalogue row that satisfied the entry, when present. */
  matchedTitle?: string
  matchedId?: string
}

export interface HeritageGapReport {
  rows: HeritageGapRow[]
  total: number
  present: number
  missing: number
  byCategory: Array<{
    category: HeritageCategory
    label: string
    total: number
    missing: number
    missingTitles: string[]
  }>
  report: string
}

/** Shape a catalogue row for `buildHeritageGap`. */
export function toCatalogTitle(item: {
  id: string
  title: string
  releaseDate: Date | null
}): CatalogTitle {
  return {
    id: item.id,
    title: item.title,
    year: item.releaseDate ? item.releaseDate.getUTCFullYear() : null,
  }
}

/**
 * Build the diff from an already-loaded catalogue slice. Pure, so the matching
 * rules are unit-testable without a database.
 */
export function buildHeritageGap(catalog: CatalogTitle[]): HeritageGapReport {
  // Bucket by normalised title so each entry is an O(1) lookup instead of a
  // full scan of ~12k rows.
  const byTitle = new Map<string, CatalogTitle[]>()
  for (const c of catalog) {
    const key = normalizeTitle(c.title)
    const bucket = byTitle.get(key)
    if (bucket) bucket.push(c)
    else byTitle.set(key, [c])
  }

  const rows: HeritageGapRow[] = HERITAGE_WATCHLIST.map((entry) => {
    for (const form of entryTitleForms(entry)) {
      const hit = (byTitle.get(form) ?? []).find((c) => matchesEntry(entry, c))
      if (hit) {
        return {
          entry,
          present: true,
          matchedTitle: `${hit.title} (${hit.year ?? "?"})`,
          matchedId: hit.id,
        }
      }
    }
    return { entry, present: false }
  })

  const present = rows.filter((r) => r.present).length
  const missing = rows.length - present

  const categories = [...new Set(HERITAGE_WATCHLIST.map((e) => e.category))]
  const byCategory = categories.map((category) => {
    const catRows = rows.filter((r) => r.entry.category === category)
    const missingRows = catRows.filter((r) => !r.present)
    return {
      category,
      label: HERITAGE_CATEGORY_LABELS[category],
      total: catRows.length,
      missing: missingRows.length,
      missingTitles: missingRows.map((r) => `${r.entry.title} (${r.entry.year})`),
    }
  })

  return {
    rows,
    total: rows.length,
    present,
    missing,
    byCategory,
    report: buildReport({ rows, total: rows.length, present, missing, byCategory }),
  }
}

function buildReport(input: Omit<HeritageGapReport, "report">): string {
  const { rows, total, present, missing, byCategory } = input
  const pct = total > 0 ? Math.round((present / total) * 100) : 0

  const lines: string[] = [
    "# Catalogue — classiques et titres saisonniers",
    "",
    `Couverture : **${present}/${total}** titres de référence présents (${pct} %). **${missing} manquant(s).**`,
    "",
    "## Par catégorie",
    "",
  ]

  byCategory
    .slice()
    .sort((a, b) => b.missing - a.missing)
    .forEach((c) => {
      lines.push(`### ${c.label} — ${c.total - c.missing}/${c.total}`)
      if (c.missing === 0) {
        lines.push("- Complet.", "")
        return
      }
      c.missingTitles.forEach((t) => {
        const entry = rows.find((r) => `${r.entry.title} (${r.entry.year})` === t)?.entry
        lines.push(`- ❌ ${t}${entry?.note ? ` — _${entry.note}_` : ""}`)
      })
      lines.push("")
    })

  lines.push(
    "## Méthode",
    "- Liste de référence éditoriale : `src/lib/heritage-watchlist.ts`.",
    "- Comparaison sur titre normalisé (sans accents ni ponctuation) + année ±1.",
    "- Les imports automatiques suivent la *popularité* TMDB : ils ne peuvent pas",
    "  ramener ces titres. L'ajout doit passer par cette liste.",
  )

  return lines.join("\n")
}
