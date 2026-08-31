import { NextResponse } from "next/server"
import { cookies, headers } from "next/headers"
import { auth } from "@/lib/auth"
import { getClientIpFromHeaders } from "@/lib/totem/rate-limit"
import { canUseNlSearch } from "@/lib/nl-search/access"
import { loadBoard } from "@/lib/nl-search/boards"
import {
  BADGES_PER_VOTER,
  castVote,
  clampDelta,
  isValidVoterToken,
  newVoterToken,
  readBallot,
  sanitizeVoterName,
  VOTER_COOKIE,
} from "@/lib/nl-search/board-votes"
import { checkVoteRateLimit } from "@/lib/nl-search/rate-limit"

export const dynamic = "force-dynamic"

/**
 * One badge step on a shared board's ballot. Anonymous by design — the voter
 * is a browser token plus a typed first name — which is exactly why every
 * input is clamped and the budget is re-checked server-side: the client can
 * only ever ask for "one badge more" or "one badge less" on a real title of a
 * real, unexpired board.
 */
export async function POST(request: Request) {
  const session = await auth()

  // The ballot follows the same rollout gate as the boards themselves.
  if (!canUseNlSearch({ isAuthenticated: !!session?.user, role: session?.user?.role })) {
    return NextResponse.json({ error: "Indisponible." }, { status: 403 })
  }

  const ip = getClientIpFromHeaders(await headers())
  const rate = checkVoteRateLimit(ip)
  if (!rate.allowed) {
    return NextResponse.json(
      { error: "Trop de votes d'un coup. Réessayez dans un moment." },
      { status: 429, headers: { "Retry-After": String(rate.retryAfterSec) } },
    )
  }

  let body: { boardId?: unknown; mediaId?: unknown; delta?: unknown; name?: unknown }
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: "Requête invalide." }, { status: 400 })
  }

  const boardId = typeof body.boardId === "string" && /^[a-zA-Z0-9]{12}$/.test(body.boardId) ? body.boardId : null
  const mediaId = typeof body.mediaId === "string" && body.mediaId.length <= 64 ? body.mediaId : null
  const delta = clampDelta(body.delta)
  const name = sanitizeVoterName(body.name)

  if (!boardId || !mediaId || !delta) {
    return NextResponse.json({ error: "Requête invalide." }, { status: 400 })
  }
  if (!name) {
    return NextResponse.json({ error: "Indiquez un prénom (2 lettres minimum) pour voter." }, { status: 400 })
  }

  // Expired or deleted boards do not accept votes — loadBoard already treats
  // an elapsed share window as gone.
  const board = await loadBoard(boardId)
  if (!board) {
    return NextResponse.json({ error: "Ce tableau n'existe plus." }, { status: 404 })
  }

  // Badges land on the board's own titles. Legacy boards (shared before the
  // snapshot column existed) have an empty list and keep the old behavior.
  if (board.ballotMediaIds.length > 0 && !board.ballotMediaIds.includes(mediaId)) {
    return NextResponse.json({ error: "Ce titre ne fait pas partie du tableau." }, { status: 400 })
  }

  const jar = await cookies()
  const existing = jar.get(VOTER_COOKIE)?.value
  const voterToken = isValidVoterToken(existing) ? existing : newVoterToken()

  const result = await castVote({ boardId, voterToken, voterName: name, mediaId, delta })
  if (!result.ok) {
    const message =
      result.reason === "budget"
        ? `Vous avez déjà placé vos ${BADGES_PER_VOTER} badges. Retirez-en un pour changer d'avis.`
        : result.reason === "board_full"
          ? "Ce tableau a atteint son nombre maximal de votants."
          : result.reason === "not_found"
            ? "Ce titre n'est plus disponible."
            : "Vote impossible."
    const status = result.reason === "budget" || result.reason === "board_full" ? 409 : 400
    return NextResponse.json({ error: message }, { status })
  }

  const ballot = await readBallot(boardId, voterToken)
  const response = NextResponse.json({
    tallies: ballot.tallies,
    myVotes: ballot.myVotes,
    myName: ballot.myName,
    voterCount: ballot.voterCount,
    budget: BADGES_PER_VOTER,
  })
  if (existing !== voterToken) {
    response.cookies.set(VOTER_COOKIE, voterToken, {
      httpOnly: true,
      sameSite: "lax",
      secure: process.env.NODE_ENV === "production",
      maxAge: 60 * 60 * 24 * 365,
      path: "/",
    })
  }
  return response
}
