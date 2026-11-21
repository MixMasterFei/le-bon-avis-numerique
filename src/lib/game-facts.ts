/**
 * Game « Fiche pratique » facts — pure mapping from the game database's raw
 * records to the nullable columns of sql/add_game_facts.sql.
 *
 * THE RULE: absent data stays null. A mapper here may only return TRUE or a
 * value the source states; it never returns FALSE and never infers a « no »
 * (a game with no multiplayer record is not « solo uniquement », a game with
 * no purchases descriptor is not « sans achats » — the 18 Nov fix on
 * GameInfoCard). The columns therefore read « oui / valeur / non renseigné ».
 *
 * No I/O here: the fetch lives in src/lib/igdb.ts (getGameFactsRecords…), the write in the
 * dispatch-only route POST /api/cron/game-facts.
 */

import type { IGDBAgeRatingEntry } from "./pegi-descriptors"

// ── Raw shapes (only the fields we request) ─────────────────────────────────

/** One `multiplayer_modes` record (IGDB has one per platform). */
export interface IgdbMultiplayerMode {
  campaigncoop?: boolean
  dropin?: boolean
  lancoop?: boolean
  offlinecoop?: boolean
  offlinecoopmax?: number
  offlinemax?: number
  onlinecoop?: boolean
  onlinecoopmax?: number
  onlinemax?: number
  splitscreen?: boolean
  splitscreenonline?: boolean
  platform?: number | { id?: number; name?: string }
}

export interface IgdbGameFactsRecord {
  id: number
  name?: string
  game_modes?: Array<{ id?: number; name?: string }>
  multiplayer_modes?: IgdbMultiplayerMode[]
  involved_companies?: Array<{
    company?: { name?: string }
    developer?: boolean
    publisher?: boolean
  }>
  age_ratings?: IGDBAgeRatingEntry[]
}

/** The series lookup is a separate, isolated request (field names drift). */
export interface IgdbSeriesRecord {
  id: number
  collections?: Array<{ name?: string }>
  collection?: { name?: string }
  franchise?: { name?: string }
  franchises?: Array<{ name?: string }>
}

/** One `game_time_to_beats` record — durations in SECONDS. */
export interface IgdbTimeToBeatRecord {
  game_id?: number
  hastily?: number
  normally?: number
  completely?: number
  count?: number
}

// ── Output ──────────────────────────────────────────────────────────────────

export interface GameFacts {
  onlinePlay: true | null
  localPlay: true | null
  splitScreen: true | null
  minPlayers: number | null
  maxPlayers: number | null
  inGamePurchases: true | null
  developer: string | null
  publisher: string | null
  series: string | null
  timeToBeatHours: number | null
  /** Which source fields produced at least one value (bookkeeping only). */
  sources: string[]
}

export const EMPTY_GAME_FACTS: GameFacts = {
  onlinePlay: null,
  localPlay: null,
  splitScreen: null,
  minPlayers: null,
  maxPlayers: null,
  inGamePurchases: null,
  developer: null,
  publisher: null,
  series: null,
  timeToBeatHours: null,
  sources: [],
}

// IGDB `game_modes` ids (stable enum-like table).
const MODE_SINGLE_PLAYER = 1
const MODE_SPLIT_SCREEN = 4
const MODE_MMO = 5
const MODE_BATTLE_ROYALE = 6

const MODE_NAMES: Record<string, number> = {
  "single player": MODE_SINGLE_PLAYER,
  "split screen": MODE_SPLIT_SCREEN,
  "massively multiplayer online (mmo)": MODE_MMO,
  "battle royale": MODE_BATTLE_ROYALE,
}

function modeIds(modes: IgdbGameFactsRecord["game_modes"]): Set<number> {
  const ids = new Set<number>()
  for (const m of modes ?? []) {
    if (typeof m.id === "number") ids.add(m.id)
    const byName = m.name ? MODE_NAMES[m.name.trim().toLowerCase()] : undefined
    if (byName) ids.add(byName)
  }
  return ids
}

/** A player count the source states, or null (0/1/absurd values are not counts). */
function playerCount(n: unknown): number | null {
  if (typeof n !== "number" || !Number.isInteger(n)) return null
  if (n < 2 || n > 1000) return null
  return n
}

const MAX_NAME_LENGTH = 120

function cleanName(raw: unknown): string | null {
  if (typeof raw !== "string") return null
  const s = raw.replace(/\s+/g, " ").trim()
  if (!s || s.length > MAX_NAME_LENGTH) return null
  return s
}

/** Up to two distinct company names, in source order. */
function companies(
  list: IgdbGameFactsRecord["involved_companies"],
  role: "developer" | "publisher",
): string | null {
  const names: string[] = []
  for (const c of list ?? []) {
    if (c[role] !== true) continue
    const name = cleanName(c.company?.name)
    if (name && !names.includes(name)) names.push(name)
    if (names.length === 2) break
  }
  return names.length ? names.join(", ") : null
}

// ── Purchases / online from official rating descriptors ────────────────────

const ORG_ESRB = 1
const ORG_PEGI = 2

function isOrg(entry: IGDBAgeRatingEntry, org: number): boolean {
  return entry.organization === org || entry.category === org
}

// Legacy content-description enum (still served on some records).
const LEGACY_PEGI_ONLINE = 57
const LEGACY_PEGI_PURCHASES = 58

const PURCHASE_TEXT = /\bin[- ]game purchases?\b/i
const ONLINE_TEXT = /\bonline gameplay\b/i

/**
 * TRUE only when PEGI or ESRB states « in-game purchases ». Anything else —
 * no rating, no descriptor, another body — is null, never « no ».
 */
export function purchasesFromAgeRatings(ratings: IGDBAgeRatingEntry[] | null | undefined): true | null {
  for (const entry of ratings ?? []) {
    if (!isOrg(entry, ORG_PEGI) && !isOrg(entry, ORG_ESRB)) continue
    for (const d of entry.rating_content_descriptions ?? []) {
      if (isOrg(entry, ORG_PEGI) && d.category === LEGACY_PEGI_PURCHASES) return true
      if (d.description && PURCHASE_TEXT.test(d.description)) return true
    }
  }
  return null
}

/** TRUE only when PEGI's « online gameplay » descriptor is present. */
export function onlineFromAgeRatings(ratings: IGDBAgeRatingEntry[] | null | undefined): true | null {
  for (const entry of ratings ?? []) {
    if (!isOrg(entry, ORG_PEGI)) continue
    for (const d of entry.rating_content_descriptions ?? []) {
      if (d.category === LEGACY_PEGI_ONLINE) return true
      if (d.description && ONLINE_TEXT.test(d.description)) return true
    }
  }
  return null
}

// ── Series / time to beat ───────────────────────────────────────────────────

/**
 * The series a game belongs to. Prefers a collection (« Mario Kart ») over the
 * broad franchise (« Mario »); among several collections, the longest one
 * whose name is in the game's title.
 */
export function seriesFromIgdb(
  record: IgdbSeriesRecord | null | undefined,
  gameName?: string | null,
): string | null {
  if (!record) return null
  const collections = [
    ...(record.collections ?? []),
    ...(record.collection ? [record.collection] : []),
  ]
    .map((c) => cleanName(c.name))
    .filter((n): n is string => !!n)
  if (collections.length) {
    const title = (gameName ?? "").toLowerCase()
    // The most specific (longest) collection named in the title wins.
    const named = collections
      .filter((c) => title && title.includes(c.toLowerCase()))
      .sort((a, b) => b.length - a.length)
    return named[0] ?? collections[0]
  }
  return cleanName(record.franchise?.name) ?? cleanName(record.franchises?.[0]?.name) ?? null
}

/** Minimum number of submissions before a duration is shown. */
export const TIME_TO_BEAT_MIN_COUNT = 3

/**
 * Main-story duration in hours (« normally »), rounded to the half hour.
 * Null unless the record carries a submission count of at least
 * TIME_TO_BEAT_MIN_COUNT and a plausible duration (30 min – 1 000 h): a
 * shape we don't recognise yields null, never a guess.
 */
export function timeToBeatHoursFromIgdb(record: IgdbTimeToBeatRecord | null | undefined): number | null {
  if (!record) return null
  if (typeof record.count !== "number" || record.count < TIME_TO_BEAT_MIN_COUNT) return null
  const seconds = record.normally
  if (typeof seconds !== "number" || !Number.isFinite(seconds)) return null
  const hours = seconds / 3600
  if (hours < 0.5 || hours > 1000) return null
  return Math.round(hours * 2) / 2
}

// ── Main mapper ─────────────────────────────────────────────────────────────

export function gameFactsFromIgdb(
  game: IgdbGameFactsRecord,
  extra: { series?: IgdbSeriesRecord | null; timeToBeat?: IgdbTimeToBeatRecord | null } = {},
): GameFacts {
  const sources = new Set<string>()
  const modes = modeIds(game.game_modes)
  const mm = game.multiplayer_modes ?? []

  // Online
  let onlinePlay: true | null = null
  if (mm.some((m) => m.onlinecoop === true || m.splitscreenonline === true || playerCount(m.onlinemax) || playerCount(m.onlinecoopmax))) {
    onlinePlay = true
    sources.add("multiplayer_modes")
  } else if (modes.has(MODE_MMO) || modes.has(MODE_BATTLE_ROYALE)) {
    onlinePlay = true
    sources.add("game_modes")
  } else if (onlineFromAgeRatings(game.age_ratings)) {
    onlinePlay = true
    sources.add("age_ratings")
  }

  // Local (same machine). LAN co-op needs several machines: not « local ».
  let localPlay: true | null = null
  if (mm.some((m) => m.offlinecoop === true || m.splitscreen === true || playerCount(m.offlinemax) || playerCount(m.offlinecoopmax))) {
    localPlay = true
    sources.add("multiplayer_modes")
  }

  // Split screen
  let splitScreen: true | null = null
  if (mm.some((m) => m.splitscreen === true)) {
    splitScreen = true
    sources.add("multiplayer_modes")
  } else if (modes.has(MODE_SPLIT_SCREEN)) {
    splitScreen = true
    sources.add("game_modes")
  }
  if (splitScreen && !localPlay) localPlay = true // split screen IS local play

  // Players
  let maxPlayers: number | null = null
  for (const m of mm) {
    for (const n of [m.onlinemax, m.offlinemax, m.onlinecoopmax, m.offlinecoopmax]) {
      const c = playerCount(n)
      if (c !== null && (maxPlayers === null || c > maxPlayers)) maxPlayers = c
    }
  }
  if (maxPlayers !== null) sources.add("multiplayer_modes")
  const minPlayers = modes.has(MODE_SINGLE_PLAYER) ? 1 : null
  if (minPlayers !== null) sources.add("game_modes")

  // Purchases
  const inGamePurchases = purchasesFromAgeRatings(game.age_ratings)
  if (inGamePurchases) sources.add("age_ratings")

  // Companies
  const developer = companies(game.involved_companies, "developer")
  const publisher = companies(game.involved_companies, "publisher")
  if (developer || publisher) sources.add("involved_companies")

  const series = seriesFromIgdb(extra.series, game.name)
  if (series) sources.add("collections")

  const timeToBeatHours = timeToBeatHoursFromIgdb(extra.timeToBeat)
  if (timeToBeatHours !== null) sources.add("time_to_beat")

  return {
    onlinePlay,
    localPlay,
    splitScreen,
    minPlayers,
    maxPlayers,
    inGamePurchases,
    developer,
    publisher,
    series,
    timeToBeatHours,
    sources: [...sources].sort(),
  }
}

/** Bookkeeping string stored in game_facts_source (never rendered). */
export function gameFactsSourceLabel(facts: GameFacts): string {
  return facts.sources.length ? `igdb:${facts.sources.join(",")}` : "igdb:none"
}

/** True when the mapper found nothing at all for this game. */
export function isEmptyGameFacts(facts: GameFacts): boolean {
  return (
    facts.onlinePlay === null &&
    facts.localPlay === null &&
    facts.splitScreen === null &&
    facts.minPlayers === null &&
    facts.maxPlayers === null &&
    facts.inGamePurchases === null &&
    facts.developer === null &&
    facts.publisher === null &&
    facts.series === null &&
    facts.timeToBeatHours === null
  )
}

// ── Run planning (pure) ─────────────────────────────────────────────────────

/** The stored facts of one fiche, as read before the run. */
export interface StoredGameFacts {
  gameOnlinePlay: boolean | null
  gameLocalPlay: boolean | null
  gameSplitScreen: boolean | null
  gameMinPlayers: number | null
  gameMaxPlayers: number | null
  gameInGamePurchases: boolean | null
  gameDeveloper: string | null
  gamePublisher: string | null
  gameSeries: string | null
  gameTimeToBeatHours: number | null
}

export interface GameFactsRow extends StoredGameFacts {
  id: string
  title: string
  igdbId: number
}

export type GameFactsPlan =
  | { id: string; title: string; igdbId: number; outcome: "not-found" }
  | {
      id: string
      title: string
      igdbId: number
      outcome: "changed" | "unchanged"
      facts: GameFacts
      /** Columns whose value moves, as « column: before → after ». */
      changes: string[]
    }

export function storedFromFacts(f: GameFacts): StoredGameFacts {
  return {
    gameOnlinePlay: f.onlinePlay,
    gameLocalPlay: f.localPlay,
    gameSplitScreen: f.splitScreen,
    gameMinPlayers: f.minPlayers,
    gameMaxPlayers: f.maxPlayers,
    gameInGamePurchases: f.inGamePurchases,
    gameDeveloper: f.developer,
    gamePublisher: f.publisher,
    gameSeries: f.series,
    gameTimeToBeatHours: f.timeToBeatHours,
  }
}

/**
 * What a run would write for each fiche. `series` / `timeToBeat` are NULL
 * when that isolated lookup failed: the stored value is then KEPT (a failed
 * request is not « no series »). A game the source no longer returns is
 * reported « not-found » and left untouched.
 */
export function planGameFactsRun(
  rows: GameFactsRow[],
  records: IgdbGameFactsRecord[],
  series: IgdbSeriesRecord[] | null,
  timeToBeat: IgdbTimeToBeatRecord[] | null,
): GameFactsPlan[] {
  const byId = new Map(records.map((r) => [r.id, r]))
  const seriesById = series ? new Map(series.map((r) => [r.id, r])) : null
  const ttbById = new Map<number, IgdbTimeToBeatRecord>()
  for (const t of timeToBeat ?? []) if (typeof t.game_id === "number") ttbById.set(t.game_id, t)

  return rows.map((row): GameFactsPlan => {
    const record = byId.get(row.igdbId)
    if (!record) return { id: row.id, title: row.title, igdbId: row.igdbId, outcome: "not-found" }

    const facts = gameFactsFromIgdb(record, {
      series: seriesById?.get(row.igdbId) ?? null,
      timeToBeat: ttbById.get(row.igdbId) ?? null,
    })
    if (seriesById === null) {
      facts.series = row.gameSeries
      if (row.gameSeries !== null) facts.sources = [...facts.sources, "collections(kept)"].sort()
    }
    if (timeToBeat === null) {
      facts.timeToBeatHours = row.gameTimeToBeatHours
      if (row.gameTimeToBeatHours !== null) facts.sources = [...facts.sources, "time_to_beat(kept)"].sort()
    }

    const next = storedFromFacts(facts)
    const changes: string[] = []
    for (const key of Object.keys(next) as (keyof StoredGameFacts)[]) {
      if (next[key] !== row[key]) changes.push(`${key}: ${String(row[key])} → ${String(next[key])}`)
    }
    return {
      id: row.id,
      title: row.title,
      igdbId: row.igdbId,
      outcome: changes.length ? "changed" : "unchanged",
      facts,
      changes,
    }
  })
}

/** Paces async calls to at most one every `minIntervalMs` (IGDB: 4 req/s). */
export function createPacer(
  minIntervalMs: number,
  now: () => number = Date.now,
  sleep: (ms: number) => Promise<void> = (ms) => new Promise((r) => setTimeout(r, ms)),
) {
  let last = -Infinity
  return async function pace<T>(fn: () => Promise<T>): Promise<T> {
    const wait = last + minIntervalMs - now()
    if (wait > 0) await sleep(wait)
    last = now()
    return fn()
  }
}
