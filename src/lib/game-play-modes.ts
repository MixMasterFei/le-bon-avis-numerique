/**
 * « Solo / à plusieurs / en ligne » for the game fiche (GameInfoCard).
 *
 * Two vocabularies reach the card:
 * - catalogue games store their modes as French style tags in `topics`
 *   (src/lib/game-style-tags.ts: Solo, Multijoueur, Coopératif, Écran
 *   partagé, MMO, Battle royale, Party game);
 * - off-catalogue IGDB fiches pass IGDB's English `game_modes`.
 * The card only knew the English names, so every catalogue co-op game
 * (Overcooked! 2…) read « Solo uniquement · Se joue seul ».
 *
 * Exact names only: `topics` also carries enrichment themes (« Coopération »,
 * « Amitié »…), which must not read as a game mode. And no guessing: IGDB's
 * « Multiplayer » / « Co-operative » don't say local or online, so online play
 * is only claimed on an explicit signal, and missing data is « non renseigné »,
 * never « se joue seul ».
 */

type Signal = "solo" | "multi" | "coop" | "local" | "online"

const MODE_SIGNALS: Record<string, Signal> = {
  // French style tags (game-style-tags.ts, « Multi » group)
  solo: "solo",
  multijoueur: "multi",
  cooperatif: "coop",
  "ecran partage": "local",
  "party game": "multi",
  mmo: "online",
  "battle royale": "online",
  // IGDB game_modes (English)
  "single player": "solo",
  multiplayer: "multi",
  "co-operative": "coop",
  "split screen": "local",
  "massively multiplayer online (mmo)": "online",
}

/** Genres that are online by nature (IGDB « MOBA », MMORPG-style names). */
const ONLINE_GENRE = /\b(mmo|mmorpg|moba|battle royale)\b/

/** PEGI content descriptor (src/lib/pegi-descriptors.ts) for online play. */
const PEGI_ONLINE = "jeu en ligne"

function normalize(value: string): string {
  return value
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/\s+/g, " ")
    .trim()
}

export interface PlayModeInput {
  gameModes?: string[]
  topics?: string[]
  genres?: string[]
  pegiDescriptors?: string[]
  /** Explicit flag from the caller; overrides what the tags suggest. */
  hasOnlineFeatures?: boolean
}

export interface PlayModeSummary {
  label: string
  status: "yes" | "no" | "unknown" | "warning"
  description: string
  isMultiplayer: boolean
  hasOnline: boolean
}

export function describePlayModes(input: PlayModeInput): PlayModeSummary {
  const signals = new Set<Signal>()
  for (const raw of [...(input.gameModes ?? []), ...(input.topics ?? [])]) {
    const signal = MODE_SIGNALS[normalize(raw)]
    if (signal) signals.add(signal)
  }
  if ((input.genres ?? []).some((g) => ONLINE_GENRE.test(normalize(g)))) signals.add("online")
  if ((input.pegiDescriptors ?? []).some((d) => normalize(d) === PEGI_ONLINE)) signals.add("online")

  const hasOnline = input.hasOnlineFeatures ?? signals.has("online")
  // An online-only tag (MMO, battle royale) still means « à plusieurs », even when
  // the caller overrides the online flag.
  const isMultiplayer = hasOnline || ["online", "multi", "coop", "local"].some((s) => signals.has(s as Signal))
  const together = signals.has("coop") ? "à plusieurs, en coopération" : "à plusieurs"

  if (hasOnline) {
    return { label: "Multijoueur", status: "warning", description: "Interactions en ligne avec d'autres joueurs", isMultiplayer: true, hasOnline }
  }
  if (signals.has("local")) {
    return {
      label: "Multijoueur",
      status: "yes",
      description: `Peut se jouer ${together} sur le même écran ; vérifiez aussi le jeu en ligne`,
      isMultiplayer: true,
      hasOnline,
    }
  }
  if (isMultiplayer) {
    return {
      label: "Multijoueur",
      status: "yes",
      description: `Se joue ${together} : en local ou en ligne, à vérifier selon la plateforme`,
      isMultiplayer: true,
      hasOnline,
    }
  }
  if (signals.has("solo")) {
    return { label: "Solo uniquement", status: "no", description: "Se joue seul", isMultiplayer: false, hasOnline }
  }
  return { label: "Modes de jeu", status: "unknown", description: "Nombre de joueurs non renseigné", isMultiplayer: false, hasOnline }
}
