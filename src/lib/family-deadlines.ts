/**
 * Curated list of recurring administrative deadlines that French
 * families care about. Powers the "Pense-Bête" sidebar widget.
 *
 * Each entry is either a fixed-date deadline (e.g. taxe foncière in
 * mid-October) or a window (e.g. déclaration impôts mi-mai → début
 * juin, exact date depends on department zone). Dates are
 * approximate and updated as the calendar shifts year-to-year — the
 * goal is "don't forget", not legal precision.
 *
 * Curation principles:
 *   - Only deadlines that affect the median French household (not
 *     niche edge cases).
 *   - Concrete actions, not abstract awareness ("déclaration impôts"
 *     yes, "rentrée scolaire" no — that's a date, not a to-do).
 *   - Public administration, public schools, CAF — not private
 *     subscriptions or insurance renewals (too personal).
 */

interface DeadlineRule {
  name: string
  // Approximate end date. Some are real cutoffs (e.g. déclaration en
  // ligne en fin mai/début juin), others are reminder-style ("avant
  // la rentrée").
  month: number   // 1-12
  day: number     // 1-31, the conservative latest day of the window
  blurb: string   // 1-line action guidance
  category: "impôts" | "école" | "famille" | "santé" | "civique"
}

const FAMILY_DEADLINES: DeadlineRule[] = [
  // ── Impôts ─────────────────────────────────────────────────────
  {
    name: "Déclaration des revenus",
    month: 6,
    day: 5,
    blurb: "Date limite en ligne (varie selon la zone). Vérifier sur impots.gouv.fr.",
    category: "impôts",
  },
  {
    name: "Acompte impôt sur le revenu",
    month: 9,
    day: 15,
    blurb: "2ᵉ acompte trimestriel (si non mensualisé).",
    category: "impôts",
  },
  {
    name: "Taxe foncière",
    month: 10,
    day: 15,
    blurb: "Avis fin août, paiement mi-octobre. Mensualisation possible.",
    category: "impôts",
  },
  {
    name: "Taxe d'habitation (résidence secondaire)",
    month: 12,
    day: 15,
    blurb: "Si applicable. La résidence principale n'est plus concernée.",
    category: "impôts",
  },

  // ── École & enfance ─────────────────────────────────────────────
  {
    name: "Inscription à l'école (CP, collège, lycée)",
    month: 6,
    day: 30,
    blurb: "Mairie pour le primaire, établissement pour le secondaire. Certaines villes ferment dès mai.",
    category: "école",
  },
  {
    name: "Affelnet collège → lycée",
    month: 5,
    day: 25,
    blurb: "Vœux d'orientation lycée saisis par le collège. Vérifier les choix.",
    category: "école",
  },
  {
    name: "Parcoursup — vœux",
    month: 3,
    day: 13,
    blurb: "Date limite de formulation des vœux post-bac. Ouvrir son dossier dès janvier.",
    category: "école",
  },
  {
    name: "Inscriptions périscolaires",
    month: 9,
    day: 5,
    blurb: "Centres de loisirs, conservatoire, sports municipaux. Souvent en juin-juillet.",
    category: "école",
  },

  // ── Famille / CAF ───────────────────────────────────────────────
  {
    name: "Allocation rentrée scolaire (ARS)",
    month: 8,
    day: 20,
    blurb: "Versée mi-août par la CAF aux familles éligibles (enfants 6-18 ans).",
    category: "famille",
  },
  {
    name: "Déclaration trimestrielle CAF (RSA / Prime d'activité)",
    month: 4,
    day: 20,
    blurb: "Tous les 3 mois sur caf.fr si concerné.",
    category: "famille",
  },

  // ── Santé ──────────────────────────────────────────────────────
  {
    name: "Mutuelle — résiliation infra-annuelle",
    month: 11,
    day: 30,
    blurb: "Possible à tout moment après un an d'engagement (loi du 14 juillet 2019).",
    category: "santé",
  },
  {
    name: "Vaccins obligatoires — rappel 6 ans",
    month: 9,
    day: 30,
    blurb: "DTP + ROR si non à jour avant l'entrée au CP.",
    category: "santé",
  },

  // ── Civique ────────────────────────────────────────────────────
  {
    name: "Recensement citoyen (16 ans)",
    month: 12,
    day: 31,
    blurb: "Dans les 3 mois suivant les 16 ans de l'enfant. Mairie ou en ligne.",
    category: "civique",
  },
]

export interface DeadlineInstance {
  name: string
  dateISO: string         // YYYY-MM-DD
  daysUntil: number       // 0 = today
  blurb: string
  category: DeadlineRule["category"]
}

/**
 * Returns upcoming deadlines within the next `windowDays`, sorted
 * ascending. Cycles to next year for entries already past.
 */
export function getUpcomingDeadlines(windowDays = 180): DeadlineInstance[] {
  const today = new Date()
  today.setHours(0, 0, 0, 0)
  const cutoff = today.getTime() + windowDays * 24 * 60 * 60 * 1000

  const out: DeadlineInstance[] = []
  for (const entry of FAMILY_DEADLINES) {
    // Try this year first, then next year if already past.
    for (const year of [today.getFullYear(), today.getFullYear() + 1]) {
      const d = new Date(year, entry.month - 1, entry.day)
      d.setHours(0, 0, 0, 0)
      const t = d.getTime()
      if (t < today.getTime() || t > cutoff) continue
      const daysUntil = Math.round((t - today.getTime()) / (24 * 60 * 60 * 1000))
      out.push({
        name: entry.name,
        dateISO: d.toISOString().slice(0, 10),
        daysUntil,
        blurb: entry.blurb,
        category: entry.category,
      })
      break  // one occurrence per entry is enough
    }
  }
  out.sort((a, b) => a.daysUntil - b.daysUntil)
  return out
}
