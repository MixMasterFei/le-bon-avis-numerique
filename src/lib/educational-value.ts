/**
 * "Éducatif" (0-5) is not stored per-media — it's derived from the title's
 * topics and its positive-content scores. This is the single source of truth
 * for that derivation, matching what the classic fiche shows
 * (ContentGrid / DualMetricsDisplay) so the V3 dashboard's 8th KPI cell agrees
 * with the rest of the site.
 */
export function deriveEducationalValue(
  metrics: { positiveMessages: number; roleModels: number },
  topics: string[] = [],
): number {
  const lower = topics.map((t) => t.toLowerCase())
  if (lower.some((t) => t.includes("éducatif") || t.includes("educatif") || t.includes("documentaire"))) {
    return 5
  }
  if (lower.some((t) => t.includes("science") || t.includes("histoire") || t.includes("culture"))) {
    return 4
  }
  return Math.max(0, Math.min(5, Math.round((metrics.positiveMessages + metrics.roleModels) / 3)))
}
