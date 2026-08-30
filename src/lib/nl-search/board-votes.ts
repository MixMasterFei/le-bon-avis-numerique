/**
 * The ballot on a shared board: badge votes from people who may have no
 * account at all.
 *
 * Identity is deliberately light — a server-issued browser token plus a typed
 * first name — because the whole point is a link in a family group chat, and
 * nobody's grandmother signs up to tap a badge. What keeps that honest:
 *   - a budget of BADGES_PER_VOTER badges per voter per board, enforced in a
 *     transaction (the migration's CHECK is the backstop),
 *   - a cap on distinct voters per board,
 *   - an hourly per-IP limiter at the route,
 *   - names sanitized and length-capped, votes joined to real catalogue ids
 *     by foreign key.
 */
import { randomBytes } from "crypto"
import { prisma } from "@/lib/prisma"
import { sanitizePlainText } from "@/lib/security"
import type { ResolvedBoard } from "./resolve-blocks"

export const BADGES_PER_VOTER = 3
/** Per title per voter — all three badges on one film is allowed. */
export const MAX_BADGES_PER_TITLE = 3
/** A family-and-friends ballot, not a public poll. */
export const MAX_VOTERS_PER_BOARD = 80

const NAME_MAX_LEN = 24

export const VOTER_COOKIE = "totem_votant"

export const MAX_BALLOT_CANDIDATES = 20

export interface BallotCandidate {
  id: string
  title: string
  posterUrl: string | null
  expertAgeRec: number | null
}

/**
 * The titles a board's ballot offers: what is actually on the board, hero
 * first, de-duplicated, capped. Shared by the page (display), the share route
 * (the snapshot the vote route enforces) and nothing else — one definition of
 * "on the board" is the whole point.
 */
export function collectBallotCandidates(board: ResolvedBoard): BallotCandidate[] {
  const seen = new Set<string>()
  const out: BallotCandidate[] = []
  for (const block of board.blocks) {
    const cards =
      block.kind === "hero" ? [block.hero.card] : block.kind === "grid" || block.kind === "rail" ? block.items : []
    for (const card of cards) {
      if (seen.has(card.id)) continue
      seen.add(card.id)
      out.push({ id: card.id, title: card.title, posterUrl: card.posterUrl, expertAgeRec: card.expertAgeRec })
      if (out.length >= MAX_BALLOT_CANDIDATES) return out
    }
  }
  return out
}

export function newVoterToken(): string {
  return randomBytes(24).toString("hex")
}

/** True when the value looks like a token we issued — anything else is ignored. */
export function isValidVoterToken(value: string | undefined | null): value is string {
  return typeof value === "string" && /^[0-9a-f]{48}$/.test(value)
}

export function sanitizeVoterName(raw: unknown): string | null {
  if (typeof raw !== "string") return null
  // sanitizePlainText leaves markup for React to escape at render, which is
  // fine on a page — but a first name also travels into tallies and, one day,
  // share cards, so angle brackets have no business surviving here.
  const clean = sanitizePlainText(raw.replace(/[<>]/g, ""), NAME_MAX_LEN).trim()
  return clean.length >= 2 ? clean : null
}

/** Clamp a requested step to one badge at a time, in either direction. */
export function clampDelta(raw: unknown): 1 | -1 | null {
  if (raw === 1 || raw === "1") return 1
  if (raw === -1 || raw === "-1") return -1
  return null
}

export interface BallotTally {
  mediaId: string
  badges: number
  /** First names, most-badges first — what makes the tally social. */
  voters: string[]
}

export interface BallotState {
  tallies: BallotTally[]
  /** The caller's own spending, so the UI can show the remaining budget. */
  myVotes: Record<string, number>
  myName: string | null
  voterCount: number
}

export async function readBallot(boardId: string, voterToken: string | null): Promise<BallotState> {
  const rows = await prisma.decouverteBoardVote.findMany({
    where: { boardId },
    select: { mediaId: true, badges: true, voterName: true, voterToken: true },
  })

  const byMedia = new Map<string, { badges: number; voters: { name: string; badges: number }[] }>()
  const myVotes: Record<string, number> = {}
  let myName: string | null = null
  const voterTokens = new Set<string>()

  for (const row of rows) {
    voterTokens.add(row.voterToken)
    const entry = byMedia.get(row.mediaId) ?? { badges: 0, voters: [] }
    entry.badges += row.badges
    entry.voters.push({ name: row.voterName, badges: row.badges })
    byMedia.set(row.mediaId, entry)
    if (voterToken && row.voterToken === voterToken) {
      myVotes[row.mediaId] = row.badges
      myName = row.voterName
    }
  }

  const tallies: BallotTally[] = Array.from(byMedia.entries())
    .map(([mediaId, entry]) => ({
      mediaId,
      badges: entry.badges,
      voters: entry.voters
        .sort((a, b) => b.badges - a.badges)
        .map((v) => v.name),
    }))
    .sort((a, b) => b.badges - a.badges)

  return { tallies, myVotes, myName, voterCount: voterTokens.size }
}

export type CastVoteResult =
  | { ok: true }
  | { ok: false; reason: "budget" | "board_full" | "not_found" | "invalid" }

/**
 * Applies one badge step for one voter, atomically. The budget is re-checked
 * inside the transaction so two rapid taps cannot spend a fourth badge.
 */
export async function castVote(opts: {
  boardId: string
  voterToken: string
  voterName: string
  mediaId: string
  delta: 1 | -1
}): Promise<CastVoteResult> {
  const { boardId, voterToken, voterName, mediaId, delta } = opts

  try {
    return await prisma.$transaction(async (tx) => {
      // The budget check below is read-then-write across DIFFERENT rows of the
      // unique key, so under READ COMMITTED two concurrent +1 taps on two
      // titles both read "nothing spent yet" and both commit — four badges
      // held. The advisory lock serializes THIS VOTER on THIS BOARD for the
      // rest of the transaction; different voters never contend.
      await tx.$queryRaw`SELECT pg_advisory_xact_lock(hashtextextended(${`${boardId}:${voterToken}`}, 0))`

      const mine = await tx.decouverteBoardVote.findMany({
        where: { boardId, voterToken },
        select: { mediaId: true, badges: true },
      })
      const current = mine.find((r) => r.mediaId === mediaId)?.badges ?? 0
      const spentElsewhere = mine
        .filter((r) => r.mediaId !== mediaId)
        .reduce((sum, r) => sum + r.badges, 0)

      const next = current + delta
      if (next < 0 || next > MAX_BADGES_PER_TITLE) return { ok: false as const, reason: "invalid" as const }
      if (spentElsewhere + next > BADGES_PER_VOTER) return { ok: false as const, reason: "budget" as const }

      // A NEW voter joins the board only while there is room. Racing new
      // voters are different tokens, so the per-voter lock above cannot
      // serialize them — the board-wide lock does, taken only on this first
      // vote so ordinary taps never queue behind it. Lock order is fixed
      // (voter, then board), so the pair cannot deadlock.
      if (mine.length === 0 && delta === 1) {
        await tx.$queryRaw`SELECT pg_advisory_xact_lock(hashtextextended(${`board:${boardId}`}, 0))`
        const voters = await tx.decouverteBoardVote.findMany({
          where: { boardId },
          select: { voterToken: true },
          distinct: ["voterToken"],
        })
        if (voters.length >= MAX_VOTERS_PER_BOARD) return { ok: false as const, reason: "board_full" as const }
      }

      if (next === 0) {
        await tx.decouverteBoardVote.deleteMany({ where: { boardId, voterToken, mediaId } })
      } else {
        await tx.decouverteBoardVote.upsert({
          where: { boardId_voterToken_mediaId: { boardId, voterToken, mediaId } },
          create: { boardId, voterToken, voterName, mediaId, badges: next },
          update: { badges: next, voterName },
        })
      }
      return { ok: true as const }
    })
  } catch (error) {
    // A foreign-key miss means the board or the title is gone.
    console.error("[nl-search] vote failed:", error)
    return { ok: false, reason: "not_found" }
  }
}
