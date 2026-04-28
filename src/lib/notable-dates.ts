/**
 * Curated list of well-known French civic / cultural dates for the
 * "Jour à noter" sidebar widget. Strictly secular — religious
 * observances (Ramadan, Pâques, Yom Kippour, etc.) are deliberately
 * excluded per Xavier's brief. Christmas + Toussaint are included
 * because they're public holidays observed by virtually every
 * household regardless of religion.
 *
 * Mix of:
 *   - fixed-date entries (1er mai, 14 juillet)
 *   - floating entries (Nth weekday of a given month) — fête des
 *     mères, fête des pères, Nuit des étoiles, etc.
 */

interface FixedDate {
  kind: "fixed"
  month: number   // 1-12
  day: number     // 1-31
}

interface FloatingDate {
  kind: "floating"
  month: number       // 1-12
  weekday: 0 | 1 | 2 | 3 | 4 | 5 | 6  // 0=Sun, 1=Mon, ... 6=Sat
  occurrence: 1 | 2 | 3 | 4 | -1       // -1 = last
}

interface NotableDateRule {
  name: string
  rule: FixedDate | FloatingDate
  blurb?: string  // optional 1-line context
}

const NOTABLE_DATES: NotableDateRule[] = [
  { name: "Nouvel An", rule: { kind: "fixed", month: 1, day: 1 } },
  { name: "Fête des grand-mères", rule: { kind: "floating", month: 3, weekday: 0, occurrence: 1 } },
  { name: "Journée internationale des droits des femmes", rule: { kind: "fixed", month: 3, day: 8 } },
  { name: "Poisson d'avril", rule: { kind: "fixed", month: 4, day: 1 } },
  { name: "Fête du travail", rule: { kind: "fixed", month: 5, day: 1 } },
  { name: "Victoire 1945", rule: { kind: "fixed", month: 5, day: 8 } },
  { name: "Fête des mères", rule: { kind: "floating", month: 5, weekday: 0, occurrence: -1 }, blurb: "Dernier dimanche de mai" },
  { name: "Fête des pères", rule: { kind: "floating", month: 6, weekday: 0, occurrence: 3 }, blurb: "3ᵉ dimanche de juin" },
  { name: "Fête de la musique", rule: { kind: "fixed", month: 6, day: 21 } },
  { name: "Fête nationale", rule: { kind: "fixed", month: 7, day: 14 } },
  { name: "Nuit des étoiles", rule: { kind: "floating", month: 8, weekday: 5, occurrence: 1 }, blurb: "1ᵉʳ vendredi d'août" },
  { name: "Fête des grands-pères", rule: { kind: "floating", month: 10, weekday: 0, occurrence: 1 }, blurb: "1ᵉʳ dimanche d'octobre" },
  { name: "Halloween", rule: { kind: "fixed", month: 10, day: 31 } },
  { name: "Toussaint", rule: { kind: "fixed", month: 11, day: 1 } },
  { name: "Armistice 1918", rule: { kind: "fixed", month: 11, day: 11 } },
  { name: "Saint-Nicolas", rule: { kind: "fixed", month: 12, day: 6 }, blurb: "Tradition du nord-est" },
  { name: "Noël", rule: { kind: "fixed", month: 12, day: 25 } },
  { name: "Saint-Sylvestre", rule: { kind: "fixed", month: 12, day: 31 } },
]

export interface NotableDateInstance {
  name: string
  dateISO: string         // YYYY-MM-DD
  daysUntil: number       // 0 = today, 1 = tomorrow
  blurb: string | null
}

function nthWeekdayOfMonth(year: number, month: number, weekday: number, occurrence: number): Date {
  // month is 1-12 here; JS Date month is 0-11.
  if (occurrence === -1) {
    // Last <weekday> of month: walk backwards from the last day.
    const d = new Date(year, month, 0)  // last day of month (using month+1 minus one day)
    while (d.getDay() !== weekday) d.setDate(d.getDate() - 1)
    return d
  }
  const d = new Date(year, month - 1, 1)
  while (d.getDay() !== weekday) d.setDate(d.getDate() + 1)
  d.setDate(d.getDate() + (occurrence - 1) * 7)
  return d
}

function resolveRule(rule: NotableDateRule["rule"], year: number): Date {
  if (rule.kind === "fixed") return new Date(year, rule.month - 1, rule.day)
  return nthWeekdayOfMonth(year, rule.month, rule.weekday, rule.occurrence)
}

/**
 * Returns upcoming notable dates within the next `windowDays` window.
 * Sorted ascending by date. Crosses year boundaries naturally — if
 * "Nouvel An" is in the window and we're in late December, it shows.
 */
export function getUpcomingNotableDates(windowDays = 120): NotableDateInstance[] {
  const today = new Date()
  today.setHours(0, 0, 0, 0)
  const cutoff = today.getTime() + windowDays * 24 * 60 * 60 * 1000

  const candidates: NotableDateInstance[] = []
  for (const entry of NOTABLE_DATES) {
    // Resolve for this year and next year so we catch dates spanning
    // year-end without missing them.
    for (const year of [today.getFullYear(), today.getFullYear() + 1]) {
      const d = resolveRule(entry.rule, year)
      d.setHours(0, 0, 0, 0)
      const t = d.getTime()
      if (t < today.getTime() || t > cutoff) continue
      const daysUntil = Math.round((t - today.getTime()) / (24 * 60 * 60 * 1000))
      candidates.push({
        name: entry.name,
        dateISO: d.toISOString().slice(0, 10),
        daysUntil,
        blurb: entry.blurb ?? null,
      })
    }
  }
  candidates.sort((a, b) => a.daysUntil - b.daysUntil)
  return candidates
}
