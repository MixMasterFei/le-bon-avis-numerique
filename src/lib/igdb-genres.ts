/**
 * IGDB genres come back in English ("Adventure", "Role-playing (RPG)"…),
 * whereas movies/TV genres are French (TMDB is queried in fr-FR) and the
 * filter UI is French. That mismatch meant `/jeux?topics=Aventure` matched
 * nothing and game personalization (favorite/disliked genres) never fired.
 *
 * This is the single source of truth: import paths normalize stored genres
 * through `normalizeGameGenres`, and the game filter UI uses
 * `GAME_GENRE_TOPICS` — so the two can never drift.
 *
 * Covers the 23 genre values actually present in the catalogue. NOTE: IGDB
 * "themes" (Kids, Educational…) and "game_modes" (Multiplayer, Co-op…) are
 * NOT genres and are out of scope here — a separate themes→topics pass would
 * be needed to filter on those.
 */
export const IGDB_GENRE_FR: Record<string, string> = {
  Adventure: "Aventure",
  Indie: "Indé",
  "Role-playing (RPG)": "RPG",
  Shooter: "Tir",
  Strategy: "Stratégie",
  Simulator: "Simulation",
  Puzzle: "Puzzle",
  Platform: "Plateforme",
  "Real Time Strategy (RTS)": "Stratégie temps réel",
  "Hack and slash/Beat 'em up": "Action",
  Tactical: "Tactique",
  "Turn-based strategy (TBS)": "Stratégie au tour par tour",
  Arcade: "Arcade",
  Racing: "Course",
  "Point-and-click": "Pointer-cliquer",
  Sport: "Sport",
  "Visual Novel": "Visual novel",
  Fighting: "Combat",
  "Card & Board Game": "Cartes & plateau",
  Music: "Musique",
  MOBA: "MOBA",
  "Quiz/Trivia": "Quiz",
  Pinball: "Flipper",
}

/**
 * Map raw IGDB genre names to French. Idempotent: values already French (or
 * unknown) pass through unchanged, and duplicates are de-duped. Use this at
 * every game-import write site so stored `genres[]` is always French.
 */
export function normalizeGameGenres(genres: string[] | null | undefined): string[] {
  if (!genres || genres.length === 0) return []
  const out: string[] = []
  for (const g of genres) {
    const fr = IGDB_GENRE_FR[g] ?? g
    if (!out.includes(fr)) out.push(fr)
  }
  return out
}

/**
 * French genre labels offered in the game filter UI (FilterSidebar +
 * ApercuFilterSidebar), most-common first. Every value here is a
 * `normalizeGameGenres` output, so a selected topic always matches the
 * stored genre. (Modes/themes like "Famille"/"Multijoueur" are intentionally
 * absent — they aren't IGDB genres; the PEGI age filter covers family fit.)
 */
export const GAME_GENRE_TOPICS: string[] = [
  "Aventure",
  "Indé",
  "RPG",
  "Tir",
  "Stratégie",
  "Simulation",
  "Puzzle",
  "Plateforme",
  "Action",
  "Course",
  "Sport",
  "Combat",
]
