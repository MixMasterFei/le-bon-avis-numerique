/**
 * Saved and shared « Recherche magique » boards.
 *
 * A board persists the QUESTION, the clamped interpretation and the ordered
 * plan — never the rendered page. Opening one re-composes it against live
 * catalogue data, so a board keeps its shape while its ages, scores and
 * availability stay current. Freezing HTML would turn a helpful link into a
 * confidently wrong one a month later.
 *
 * Everything read back out goes through the same validators as a fresh
 * interpretation: a stored row is untrusted input, exactly like a cached parse.
 */
import { randomBytes } from "crypto"
import { prisma } from "@/lib/prisma"
import { sanitizePlainText } from "@/lib/security"
import { buildPlan, type NlPlan } from "./blocks"
import { validateNlIntent } from "./validate"
import type { NlIntent } from "./types"

/** Share links live a month; a kept board lives until its owner deletes it. */
export const SHARE_TTL_DAYS = 30
export const MAX_SAVED_BOARDS = 50
const TITLE_MAX_LEN = 80

/**
 * Unambiguous, URL-safe alphabet (no O/0, I/l/1). 12 characters ≈ 62 bits of
 * entropy, which is what keeps an unlisted board unlisted — the id is the only
 * thing standing between a link and the world.
 */
const ID_ALPHABET = "abcdefghijkmnopqrstuvwxyzABCDEFGHJKLMNPQRSTUVWXYZ23456789"
const ID_LENGTH = 12

export function newBoardId(): string {
  const bytes = randomBytes(ID_LENGTH)
  let out = ""
  for (let i = 0; i < ID_LENGTH; i++) out += ID_ALPHABET[bytes[i] % ID_ALPHABET.length]
  return out
}

export interface BoardRecord {
  id: string
  ownerId: string | null
  query: string
  intent: NlIntent
  plan: NlPlan
  title: string | null
  saved: boolean
  createdAt: Date
}

export interface CreateBoardInput {
  query: string
  intent: NlIntent
  plan: NlPlan
  userId: string | null
  /** "share" → short-lived snapshot. "save" → kept, named, listed. */
  mode: "share" | "save"
  title?: string | null
}

export async function createBoard(input: CreateBoardInput): Promise<BoardRecord | null> {
  const saved = input.mode === "save"
  // Saving is an account feature; sharing works signed out.
  if (saved && !input.userId) return null

  const title = input.title ? sanitizePlainText(input.title, TITLE_MAX_LEN).trim() || null : null
  const expiresAt = saved ? null : new Date(Date.now() + SHARE_TTL_DAYS * 24 * 60 * 60 * 1000)

  try {
    const row = await prisma.decouverteBoard.create({
      data: {
        id: newBoardId(),
        userId: input.userId,
        query: input.query.slice(0, 500),
        intent: input.intent as unknown as object,
        plan: input.plan as unknown as object,
        title,
        saved,
        expiresAt,
      },
      select: { id: true, userId: true, query: true, title: true, saved: true, createdAt: true },
    })
    return {
      id: row.id,
      ownerId: row.userId,
      query: row.query,
      intent: input.intent,
      plan: input.plan,
      title: row.title,
      saved: row.saved,
      createdAt: row.createdAt,
    }
  } catch (error) {
    console.error("[nl-search] board create failed:", error)
    return null
  }
}

/**
 * Loads a board for rendering. Returns null when it does not exist or its share
 * window has closed — an expired link reads as gone rather than as an error.
 */
export async function loadBoard(id: string): Promise<BoardRecord | null> {
  try {
    const row = await prisma.decouverteBoard.findUnique({
      where: { id },
      select: {
        id: true, userId: true, query: true, intent: true, plan: true,
        title: true, saved: true, expiresAt: true, createdAt: true,
      },
    })
    if (!row) return null
    if (row.expiresAt && row.expiresAt.getTime() < Date.now()) return null

    // Re-validated on read for the same reason a cached parse is: the row may
    // predate a vocabulary change, and it is still untrusted input.
    const intent = validateNlIntent(row.intent)
    return {
      id: row.id,
      ownerId: row.userId,
      query: row.query,
      intent,
      plan: buildPlan(row.plan, intent),
      title: row.title,
      saved: row.saved,
      createdAt: row.createdAt,
    }
  } catch (error) {
    console.error("[nl-search] board load failed:", error)
    return null
  }
}

/** Best-effort view counter; never blocks or fails a render. */
export async function noteBoardView(id: string): Promise<void> {
  try {
    await prisma.decouverteBoard.update({ where: { id }, data: { viewCount: { increment: 1 } } })
  } catch {
    // A board that renders is worth more than a counter that increments.
  }
}

export interface SavedBoardSummary {
  id: string
  title: string | null
  query: string
  createdAt: string
}

export async function listSavedBoards(userId: string): Promise<SavedBoardSummary[]> {
  try {
    const rows = await prisma.decouverteBoard.findMany({
      where: { userId, saved: true },
      select: { id: true, title: true, query: true, createdAt: true },
      orderBy: { createdAt: "desc" },
      take: MAX_SAVED_BOARDS,
    })
    return rows.map((row) => ({
      id: row.id,
      title: row.title,
      query: row.query,
      createdAt: row.createdAt.toISOString(),
    }))
  } catch (error) {
    console.error("[nl-search] saved board listing failed:", error)
    return []
  }
}

/** Ownership is checked in the query itself, so a wrong id simply deletes nothing. */
export async function deleteBoard(id: string, userId: string): Promise<boolean> {
  try {
    const result = await prisma.decouverteBoard.deleteMany({ where: { id, userId } })
    return result.count > 0
  } catch (error) {
    console.error("[nl-search] board delete failed:", error)
    return false
  }
}
