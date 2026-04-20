type SeasonalWindow = {
  keywords: string[]
  // Zero-indexed months (0 = Jan) where the content is in-season.
  months: number[]
}

const SEASONS: SeasonalWindow[] = [
  {
    // Christmas — Nov + Dec only
    keywords: [
      "noël",
      "noel",
      "christmas",
      "xmas",
      "santa",
      "père noël",
      "pere noel",
      "jingle",
      "grinch",
      "scrooge",
    ],
    months: [10, 11],
  },
  {
    // Halloween — Oct only
    keywords: ["halloween", "hallowe'en"],
    months: [9],
  },
]

function matchesKeyword(haystack: string, keyword: string): boolean {
  const escaped = keyword.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")
  return new RegExp(`\\b${escaped}\\b`, "i").test(haystack)
}

export function isSeasonalMismatch(
  data: { title?: string | null; topics?: string[] | null },
  now: Date = new Date()
): boolean {
  const month = now.getMonth()
  const parts: string[] = []
  if (data.title) parts.push(data.title)
  if (data.topics && data.topics.length > 0) parts.push(...data.topics)
  if (parts.length === 0) return false
  const haystack = parts.join(" | ")

  for (const season of SEASONS) {
    const matched = season.keywords.some((kw) => matchesKeyword(haystack, kw))
    if (matched && !season.months.includes(month)) return true
  }
  return false
}
