// "Striking distance" SEO agent: pulls the last 28 days of Search Console
// query data, finds the queries already ranking on the cusp of page 1
// (positions ~8–20 with real impressions), maps each to the page that ranks,
// and proposes the concrete on-page nudge to push it up. These are the
// cheapest wins — you're already shown, you're just not clicked yet.

import { querySearchAnalytics, gscDateRange, isGscConfigured } from "./gsc"
import { withVerdict } from "./agent-verdict"

export interface StrikingQuery {
  query: string
  page: string
  position: number
  impressions: number
  clicks: number
  ctr: number
  opportunity: number
}

export interface SeoStrikingResult {
  configured: boolean
  range: { startDate: string; endDate: string }
  /** Top opportunities, for the human-readable email. Capped at MAX_REPORTED. */
  strikingQueries: StrikingQuery[]
  /**
   * The deeper pool the write-side agent works from. Same filter, same order,
   * just a much longer tail — see MAX_ACTIONABLE.
   */
  actionableQueries: StrikingQuery[]
  /** Number of queries matching the striking-distance filter, before any cap. */
  totalStriking: number
  totalImpressionsAtStake: number
  report: string
}

const POSITION_MIN = 8
const POSITION_MAX = 20.5
const MIN_IMPRESSIONS = 5
const MAX_REPORTED = 25
// The write-side agent used to be handed the SAME 25 rows the email displays.
// Those map to ~20 distinct fiches, and once the agent had saturated them
// (4 maillage edges + a seoTitle + a keyword-bearing synopsis each) every
// later run could only report "0 lien · 0 synopsis · 0 titre" — not because
// anything was broken, but because it had run out of reachable work while
// hundreds of further pos. 8-20 queries sat just past the cut. The agent now
// works from a much deeper pool; the email still shows the top 25.
//
// The pool must be capped in DISTINCT FICHES, not queries: hot fiches emit
// dozens of query variants each ("wicked âge", "wicked à partir de quel âge",
// "avis wicked parents"…) and, opportunity being impressions-weighted, those
// variants monopolise the head of the ranking. A 150-query window had shrunk
// to 7 distinct fiches by Aug 2026 (all already saturated) — the exact
// starvation this pool was meant to fix, reproduced one level up. The
// per-fiche cap lives downstream (MAX_TARGETS in seo-autofix.ts, applied
// AFTER dedup); this bound only mirrors the GSC rowLimit so the query-level
// slice can never bind first.
const MAX_ACTIONABLE = 5000

function pageLabel(rawUrl: string): string {
  try {
    const path = new URL(rawUrl).pathname
    return path === "" ? "/" : path
  } catch {
    return rawUrl
  }
}

function recommendation(q: StrikingQuery): string {
  // The maillage interne + chapô/synopsis nudges are handled automatically by the
  // write-side agent (seo-autofix.ts) — see the "Actions de l'agent" section below.
  // What stays manual is the title/H1, which is never auto-edited (global rename risk).
  const proximity = q.position <= 10 ? "Bas de page 1 — tout près du clic." : "Page 2 — à faire remonter."
  return `${proximity} L'agent renforce le maillage interne et le chapô (synopsis) de ${pageLabel(q.page)} si nécessaire. Reste manuel : vérifie que le titre/H1 reflète bien « ${q.query} » (ajustement à la main si pertinent).`
}

function buildReport(
  striking: StrikingQuery[],
  range: { startDate: string; endDate: string },
  totalImpressionsAtStake: number,
): string {
  const lines: string[] = [
    "# SEO — Requêtes à portée de page 1 (striking distance)",
    "",
    `Fenêtre : ${range.startDate} → ${range.endDate} (28 j, données GSC).`,
    "",
  ]

  if (striking.length === 0) {
    lines.push(
      "Aucune requête en position 8–20 avec assez d'impressions sur la période.",
      "C'est normal sur un site jeune : le volume d'impressions est encore faible.",
      "Le rapport deviendra utile à mesure que le trafic monte.",
    )
    return withVerdict(lines.join("\n"), { count: 0 })
  }

  lines.push(
    "## Lecture rapide",
    "",
    `- ${striking.length} requête(s) déjà bien classées (pos. 8–20) — un petit effort on-page peut les faire passer en page 1.`,
    `- ~${totalImpressionsAtStake} impressions/mois en jeu sur ces requêtes.`,
    "- Priorise les premières du tableau : meilleur ratio impressions × proximité du top 10.",
    "",
    "## Opportunités priorisées",
    "",
  )

  striking.forEach((q, i) => {
    lines.push(
      `### ${i + 1}. « ${q.query} »`,
      `- Page : ${pageLabel(q.page)}`,
      `- Position moyenne : ${q.position.toFixed(1)} · Impressions : ${q.impressions} · Clics : ${q.clicks} · CTR : ${(q.ctr * 100).toFixed(1)}%`,
      `- Action : ${recommendation(q)}`,
      "",
    )
  })

  lines.push(
    "## Rappel méthode",
    "- « Striking distance » = déjà visible (pos. 8–20) mais rarement cliqué car en bas de page 1 / page 2.",
    "- Le levier n'est pas de nouveaux mots-clés, mais de pousser ceux-ci de quelques positions.",
  )

  const lead = striking[0]
  return withVerdict(lines.join("\n"), {
    count: striking.length,
    kind: "opportunity",
    top: lead ? `top : « ${lead.query} » (pos. ${lead.position.toFixed(0)})` : undefined,
  })
}

export async function runSeoStrikingDistance(opts: { minImpressions?: number } = {}): Promise<SeoStrikingResult> {
  const emptyRange = { startDate: "", endDate: "" }
  if (!isGscConfigured()) {
    return {
      configured: false,
      range: emptyRange,
      strikingQueries: [],
      actionableQueries: [],
      totalStriking: 0,
      totalImpressionsAtStake: 0,
      report: "GSC non configuré (variables d'environnement OAuth manquantes).",
    }
  }

  const range = gscDateRange(28, 3)
  const rows = await querySearchAnalytics({
    startDate: range.startDate,
    endDate: range.endDate,
    dimensions: ["query", "page"],
    rowLimit: 5000,
  })

  const floor = opts.minImpressions ?? MIN_IMPRESSIONS
  const ranked: StrikingQuery[] = rows
    .filter((r) => r.position >= POSITION_MIN && r.position <= POSITION_MAX && r.impressions >= floor && r.keys.length >= 2)
    .map((r) => ({
      query: r.keys[0],
      page: r.keys[1],
      position: r.position,
      impressions: r.impressions,
      clicks: r.clicks,
      ctr: r.ctr,
      // Opportunity = impressions weighted by how close to the top 10 it is.
      opportunity: r.impressions * ((21 - r.position) / 21),
    }))
    .sort((a, b) => b.opportunity - a.opportunity)

  const striking = ranked.slice(0, MAX_REPORTED)
  const actionable = ranked.slice(0, MAX_ACTIONABLE)

  const totalImpressionsAtStake = striking.reduce((sum, q) => sum + q.impressions, 0)

  return {
    configured: true,
    range,
    strikingQueries: striking,
    actionableQueries: actionable,
    totalStriking: ranked.length,
    totalImpressionsAtStake,
    report: buildReport(striking, range, totalImpressionsAtStake),
  }
}
