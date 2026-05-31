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
  strikingQueries: StrikingQuery[]
  totalImpressionsAtStake: number
  report: string
}

const POSITION_MIN = 8
const POSITION_MAX = 20.5
const MIN_IMPRESSIONS = 5
const MAX_REPORTED = 25

function pageLabel(rawUrl: string): string {
  try {
    const path = new URL(rawUrl).pathname
    return path === "" ? "/" : path
  } catch {
    return rawUrl
  }
}

function recommendation(q: StrikingQuery): string {
  if (q.position <= 10) {
    return `Bas de page 1 — tout près du clic. Intègre « ${q.query} » dans le titre/H1 et le 1er paragraphe de ${pageLabel(q.page)}, et ajoute 2–3 liens internes vers cette page depuis des pages liées.`
  }
  return `Page 2 — à faire remonter. Renforce « ${q.query} » dans le titre + le chapô de ${pageLabel(q.page)}, étoffe le contenu pertinent, et maille en interne depuis des fiches/articles proches.`
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
  const striking: StrikingQuery[] = rows
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
    .slice(0, MAX_REPORTED)

  const totalImpressionsAtStake = striking.reduce((sum, q) => sum + q.impressions, 0)

  return {
    configured: true,
    range,
    strikingQueries: striking,
    totalImpressionsAtStake,
    report: buildReport(striking, range, totalImpressionsAtStake),
  }
}
