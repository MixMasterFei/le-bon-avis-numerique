// Vocabulary normalization for the per-member preference vector.
//
// The catalog has both French and English tag spellings ("Family" / "Famille",
// "Animation" / "animation", accented variants). Without normalization the
// cosine similarity sees them as different axes and the vector gets diluted.
//
// Rules:
//  1. Lowercase + trim.
//  2. Accent-fold (so "Comédie" == "comedie").
//  3. Apply a small alias map (EN → FR canonical) for the most common dupes.
//
// Keep this list short and conservative — over-aliasing makes the vector
// collapse distinctions parents care about.

const ALIASES: Record<string, string> = {
  // Genre aliases (English → French canonical, lowercased + folded)
  "family": "famille",
  "familial": "famille",
  "comedy": "comedie",
  "horror": "horreur",
  "thriller": "thriller",
  "adventure": "aventure",
  "drama": "drame",
  "romance": "romance",
  "animation": "animation",
  "fantasy": "fantastique",
  "documentary": "documentaire",
  "musical": "musical",
  "action": "action",
  "science fiction": "science-fiction",
  "sci-fi": "science-fiction",
  "scifi": "science-fiction",
  // Game-native genres. IGDB writes English ("Strategy", "Simulator",
  // "Platform"); the quiz lets parents pick the French names. Aliases
  // collapse both into the same canonical key so a "Stratégie" pick
  // actually boosts strategy games.
  "strategy": "strategie",
  "real time strategy (rts)": "strategie",
  "turn-based strategy (tbs)": "strategie",
  "simulator": "simulation",
  "platform": "plateforme",
  "racing": "course",
  "role-playing (rpg)": "rpg",
  "jeu de role": "rpg",
  "puzzle": "puzzle",
  "sport": "sport",
  "fighting": "combat",
  "shooter": "tir",
  "hack and slash/beat 'em up": "combat",
  // Common topic dupes
  "education": "educatif",
  "educational": "educatif",
}

export function normalizeTag(tag: string): string {
  if (!tag) return ""
  const base = tag
    .toLowerCase()
    .trim()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "") // accent fold
    .replace(/\s+/g, " ")
  return ALIASES[base] ?? base
}

export function normalizeTags(tags: readonly string[]): string[] {
  const out: string[] = []
  const seen = new Set<string>()
  for (const t of tags) {
    const n = normalizeTag(t)
    if (n && !seen.has(n)) {
      seen.add(n)
      out.push(n)
    }
  }
  return out
}
