// Steam-style game "labels" derived deterministically from IGDB metadata
// (player_perspectives + game_modes + genres + themes + keywords). Gives the
// games catalogue the granular style vocabulary the broad IGDB genres miss —
// 2D vs 3D, pixel art, JRPG, CRPG, roguelike, survie, MMO… — used for
// "Dans le même genre" similarity, fiche display and /jeux filtering.
//
// Deterministic (no AI): re-fetching a game from IGDB and re-running this is
// idempotent, which is what makes the games DB "easier to manage".

import type { IGDBGame } from "@/lib/igdb"

// ── Canonical vocabulary (French), grouped for the filter UI ──────────
export const GAME_STYLE_GROUPS: { label: string; tags: string[] }[] = [
  { label: "Visuel", tags: ["Pixel art", "2D", "3D", "Vue isométrique", "Vue de côté", "Vue du dessus", "Vue FPS", "Rétro", "Réaliste", "Cartoon", "VR"] },
  { label: "Style de jeu", tags: ["Roguelike", "Roguelite", "Metroidvania", "Souls-like", "JRPG", "CRPG", "Action-RPG", "Dungeon crawler", "Deck-building", "Tour par tour", "Hack'n'slash", "Bullet hell", "Tower defense", "Visual novel", "Pointer-cliquer", "Gestion", "Construction", "Bac à sable"] },
  { label: "Expérience", tags: ["Monde ouvert", "Survie", "Narratif", "Atmosphérique", "Exploration", "Infiltration", "Artisanat", "Difficile", "Détente", "Humour", "Horreur"] },
  { label: "Multi", tags: ["Solo", "Coopératif", "Multijoueur", "Écran partagé", "MMO", "Battle royale", "Party game"] },
  { label: "Univers", tags: ["Fantasy", "Science-fiction", "Cyberpunk", "Post-apo", "Médiéval", "Historique", "Zombies", "Guerre"] },
]

export const GAME_STYLE_TAGS: string[] = GAME_STYLE_GROUPS.flatMap((g) => g.tags)
const STYLE_TAG_SET = new Set(GAME_STYLE_TAGS)

// ── Structured IGDB fields → tags ─────────────────────────────────────
const PERSPECTIVE_MAP: Record<string, string[]> = {
  "bird view / isometric": ["Vue isométrique", "2D"],
  "side view": ["Vue de côté", "2D"],
  "first person": ["Vue FPS", "3D"],
  "third person": ["3D"],
  "virtual reality": ["VR"],
}
const MODE_MAP: Record<string, string> = {
  "single player": "Solo",
  multiplayer: "Multijoueur",
  "co-operative": "Coopératif",
  "split screen": "Écran partagé",
  "massively multiplayer online (mmo)": "MMO",
  "battle royale": "Battle royale",
}
const THEME_MAP: Record<string, string> = {
  survival: "Survie",
  horror: "Horreur",
  "open world": "Monde ouvert",
  stealth: "Infiltration",
  sandbox: "Bac à sable",
  historical: "Historique",
  "science fiction": "Science-fiction",
  fantasy: "Fantasy",
  comedy: "Humour",
  warfare: "Guerre",
  party: "Party game",
  business: "Gestion",
}

// IGDB keyword name CONTAINS the trigger → tag. Ordered specific-first.
const KEYWORD_RULES: [string, string][] = [
  ["pixel art", "Pixel art"], ["pixel graphics", "Pixel art"], ["2d pixel", "Pixel art"],
  ["roguelite", "Roguelite"], ["rogue-lite", "Roguelite"],
  ["roguelike", "Roguelike"], ["rogue-like", "Roguelike"],
  ["metroidvania", "Metroidvania"],
  ["soulslike", "Souls-like"], ["souls-like", "Souls-like"], ["soulsborne", "Souls-like"],
  ["jrpg", "JRPG"], ["japanese role", "JRPG"],
  ["crpg", "CRPG"],
  ["action rpg", "Action-RPG"], ["action role-playing", "Action-RPG"],
  ["dungeon crawler", "Dungeon crawler"],
  ["deck-building", "Deck-building"], ["deckbuild", "Deck-building"],
  ["turn-based", "Tour par tour"], ["turn based", "Tour par tour"],
  ["hack and slash", "Hack'n'slash"], ["hack'n'slash", "Hack'n'slash"],
  ["bullet hell", "Bullet hell"], ["shoot 'em up", "Bullet hell"],
  ["tower defense", "Tower defense"], ["tower defence", "Tower defense"],
  ["visual novel", "Visual novel"],
  ["point and click", "Pointer-cliquer"], ["point-and-click", "Pointer-cliquer"],
  ["city builder", "Construction"], ["building", "Construction"],
  ["management", "Gestion"], ["tycoon", "Gestion"],
  ["open world", "Monde ouvert"], ["open-world", "Monde ouvert"],
  ["survival", "Survie"],
  ["sandbox", "Bac à sable"],
  ["stealth", "Infiltration"],
  ["crafting", "Artisanat"],
  ["exploration", "Exploration"],
  ["atmospheric", "Atmosphérique"],
  ["story rich", "Narratif"], ["story-rich", "Narratif"], ["narrative", "Narratif"],
  ["difficult", "Difficile"], ["hardcore", "Difficile"],
  ["relaxing", "Détente"], ["cozy", "Détente"], ["wholesome", "Détente"],
  ["retro", "Rétro"], ["16-bit", "Rétro"], ["8-bit", "Rétro"],
  ["cartoon", "Cartoon"], ["anime", "Cartoon"], ["cel-shading", "Cartoon"],
  ["realistic", "Réaliste"],
  ["horror", "Horreur"],
  ["cyberpunk", "Cyberpunk"],
  ["post-apocalyptic", "Post-apo"], ["post apocalyptic", "Post-apo"],
  ["medieval", "Médiéval"],
  ["zombie", "Zombies"],
  ["science fiction", "Science-fiction"], ["sci-fi", "Science-fiction"],
  ["fantasy", "Fantasy"],
  ["top-down", "Vue du dessus"], ["top down", "Vue du dessus"],
  ["3d", "3D"], ["2d", "2D"],
]

// Some IGDB *genres* already imply a clean style tag.
const GENRE_MAP: Record<string, string> = {
  "point-and-click": "Pointer-cliquer",
  "visual novel": "Visual novel",
  "turn-based strategy (tbs)": "Tour par tour",
  "hack and slash/beat 'em up": "Hack'n'slash",
}

/**
 * Derive the normalized French style tags for an IGDB game. Deduped, capped to
 * keep chips readable, and always a subset of GAME_STYLE_TAGS.
 */
export function deriveGameStyleTags(game: Pick<IGDBGame, "genres" | "themes" | "game_modes" | "player_perspectives" | "keywords" | "name" | "summary">): string[] {
  const tags = new Set<string>()
  const add = (t: string | undefined) => {
    if (t && STYLE_TAG_SET.has(t)) tags.add(t)
  }

  for (const p of game.player_perspectives ?? []) {
    for (const t of PERSPECTIVE_MAP[p.name.toLowerCase()] ?? []) add(t)
  }
  for (const m of game.game_modes ?? []) add(MODE_MAP[m.name.toLowerCase()])
  for (const th of game.themes ?? []) add(THEME_MAP[th.name.toLowerCase()])
  for (const g of game.genres ?? []) add(GENRE_MAP[g.name.toLowerCase()])

  const kwBlob = (game.keywords ?? []).map((k) => k.name.toLowerCase())
  // Also scan name/summary for the strongest style words the keyword list misses.
  const nameBlob = `${game.name ?? ""} ${game.summary ?? ""}`.toLowerCase()
  for (const [trigger, tag] of KEYWORD_RULES) {
    if (kwBlob.some((k) => k.includes(trigger)) || nameBlob.includes(trigger)) add(tag)
  }

  // 2D/3D coherence: a title tagged Pixel art or a side/top view is 2D; drop a
  // spurious 3D if we have strong 2D signals and no first/third-person view.
  if ((tags.has("Pixel art") || tags.has("Vue de côté") || tags.has("Vue du dessus")) && !tags.has("Vue FPS")) {
    tags.add("2D")
  }

  return [...tags].slice(0, 12)
}
