// Shared by the visible scorecards and the Markdown/MCP exports.
// This is a derived indicator, not a separately assessed content metric.
export function deriveEducationalValue(
  metrics: { positiveMessages: number; roleModels: number },
  topics: string[] = [],
): number {
  const tags = new Set(topics.map((topic) => topic.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().trim()))
  if (["educatif", "education", "documentaire"].some((tag) => tags.has(tag))) return 5
  if (["science", "sciences", "histoire", "culture"].some((tag) => tags.has(tag))) return 4
  return Math.max(0, Math.min(5, Math.round((metrics.positiveMessages + metrics.roleModels) / 3)))
}
