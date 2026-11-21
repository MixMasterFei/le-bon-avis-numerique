import type { StoredGameFacts } from "@/lib/game-facts"

/**
 * « Fiche pratique » of a game fiche (pilot, src/lib/game-pilot.ts) — pure
 * formatting of the game-facts columns (sql/add_game_facts.sql) into the rows
 * a parent reads.
 *
 * THE RULE (same as the writer): a column is « oui » or a stated value, or
 * « Non renseigné ». NULL never reads as « non » — a game with no multiplayer
 * record is not a solo game, a game with no purchases descriptor is not
 * « sans achats ». No row ever names the database the facts come from.
 */

export const NOT_KNOWN = "Non renseigné"

export const PRACTICAL_SHEET_CAVEAT = "Ces informations peuvent varier selon la version et la plateforme."

export interface PracticalSheetInput extends StoredGameFacts {
  /** When the facts were last read; null = never read → the block is hidden. */
  gameFactsCheckedAt: string | Date | null
  /** Stored PEGI descriptors (FR labels) — « Achats intégrés » and « Jeu en
   *  ligne » are official statements, so they also count as « oui ». */
  pegiDescriptors?: string[]
}

export interface PracticalSheetRow {
  key: "players" | "online" | "local" | "splitScreen" | "purchases" | "developer" | "publisher" | "series" | "timeToBeat"
  label: string
  value: string
  known: boolean
}

export interface PracticalSheet {
  /** False until the facts have been read once: an all-« Non renseigné »
   *  block before the first read would say nothing. */
  show: boolean
  rows: PracticalSheetRow[]
  caveat: string
}

function hasDescriptor(descriptors: string[] | undefined, label: string): boolean {
  const wanted = label.toLowerCase()
  return (descriptors ?? []).some((d) => d.trim().toLowerCase() === wanted)
}

function validPlayers(n: number | null): number | null {
  return typeof n === "number" && Number.isInteger(n) && n >= 1 && n <= 1000 ? n : null
}

/** « 1 joueur », « 1 à 4 joueurs », « jusqu'à 8 joueurs », « 2 joueurs ou plus ». */
export function formatPlayers(min: number | null, max: number | null): string | null {
  const lo = validPlayers(min)
  let hi = validPlayers(max)
  if (lo !== null && hi !== null && hi < lo) hi = null
  const word = (n: number) => (n > 1 ? "joueurs" : "joueur")
  if (lo !== null && hi !== null) return lo === hi ? `${lo} ${word(lo)}` : `${lo} à ${hi} joueurs`
  if (hi !== null) return `Jusqu'à ${hi} ${word(hi)}`
  if (lo !== null) return lo === 1 ? "1 joueur ou plus" : `${lo} joueurs ou plus`
  return null
}

/** « Environ 12 h », « Environ 7 h 30 », « Moins d'une heure ». */
export function formatTimeToBeat(hours: number | null): string | null {
  if (typeof hours !== "number" || !Number.isFinite(hours) || hours <= 0 || hours > 1000) return null
  const halfHours = Math.round(hours * 2)
  if (halfHours < 2) return "Moins d'une heure"
  const h = Math.floor(halfHours / 2)
  return halfHours % 2 === 0 ? `Environ ${h} h` : `Environ ${h} h 30`
}

function cleanText(v: string | null): string | null {
  const t = v?.trim()
  return t ? t : null
}

function yes(v: boolean | null, alsoTrue = false): string | null {
  return v === true || alsoTrue ? "Oui" : null
}

/**
 * True when the game is known to sell in-game purchases: the stored fact, or
 * the official PEGI descriptor « Achats intégrés ». False means « not
 * signalled », never « sans achats » (see THE RULE above). Shared with the
 * /noel gift cards so both surfaces answer the same way.
 */
export function hasInGamePurchases(input: {
  gameInGamePurchases?: boolean | null
  pegiDescriptors?: string[] | null
}): boolean {
  return input.gameInGamePurchases === true || hasDescriptor(input.pegiDescriptors ?? undefined, "Achats intégrés")
}

export function buildPracticalSheet(input: PracticalSheetInput): PracticalSheet {
  const purchases = hasInGamePurchases(input) ? "Oui · signalé par la classification d'âge" : null

  const raw: Omit<PracticalSheetRow, "known">[] = [
    { key: "players", label: "Joueurs", value: formatPlayers(input.gameMinPlayers, input.gameMaxPlayers) ?? "" },
    { key: "online", label: "Jeu en ligne", value: yes(input.gameOnlinePlay, hasDescriptor(input.pegiDescriptors, "Jeu en ligne")) ?? "" },
    { key: "local", label: "À plusieurs sur la même console", value: yes(input.gameLocalPlay) ?? "" },
    { key: "splitScreen", label: "Écran partagé", value: yes(input.gameSplitScreen) ?? "" },
    { key: "purchases", label: "Achats intégrés", value: purchases ?? "" },
    { key: "developer", label: "Développeur", value: cleanText(input.gameDeveloper) ?? "" },
    { key: "publisher", label: "Éditeur", value: cleanText(input.gamePublisher) ?? "" },
    { key: "series", label: "Série", value: cleanText(input.gameSeries) ?? "" },
    { key: "timeToBeat", label: "Durée de l'histoire principale", value: formatTimeToBeat(input.gameTimeToBeatHours) ?? "" },
  ]
  const rows = raw.map((r) => (r.value ? { ...r, known: true } : { ...r, value: NOT_KNOWN, known: false }))

  return {
    show: input.gameFactsCheckedAt != null,
    rows,
    caveat: PRACTICAL_SHEET_CAVEAT,
  }
}
