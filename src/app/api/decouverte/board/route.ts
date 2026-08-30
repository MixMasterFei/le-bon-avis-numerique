import { NextResponse } from "next/server"
import { headers } from "next/headers"
import { auth } from "@/lib/auth"
import { sanitizeSearchQuery } from "@/lib/security"
import { getClientIpFromHeaders } from "@/lib/totem/rate-limit"
import { canUseNlSearch } from "@/lib/nl-search/access"
import { createBoard, deleteBoard, listSavedBoards, MAX_SAVED_BOARDS } from "@/lib/nl-search/boards"
import { fallbackPlan } from "@/lib/nl-search/blocks"
import { checkBoardRateLimit } from "@/lib/nl-search/rate-limit"
import { findCachedParse, hashQuery } from "@/lib/nl-search/telemetry"
import {
  hasStructuredParams,
  intentFromSearchParams,
  type NlSearchParams,
} from "@/lib/nl-search/validate"
import { prisma } from "@/lib/prisma"

export const dynamic = "force-dynamic"

/**
 * Creates a shareable or saved board from a page the visitor is already
 * looking at.
 *
 * The client sends the QUESTION and the current filter params — never the
 * interpretation or the plan. Those are rebuilt here from the same cache the
 * page uses, so a crafted request cannot store arbitrary JSON under a URL that
 * renders as a Totem page. It also means creating a board never costs an
 * interpretation call: if the page rendered, the parse is already cached.
 */
export async function POST(request: Request) {
  const session = await auth()
  const userId = session?.user?.id ?? null

  if (!canUseNlSearch({ isAuthenticated: !!session?.user, role: session?.user?.role })) {
    return NextResponse.json({ error: "Indisponible." }, { status: 403 })
  }

  const ip = getClientIpFromHeaders(await headers())
  const rate = checkBoardRateLimit({ userId, ip })
  if (!rate.allowed) {
    return NextResponse.json(
      { error: "Trop de tableaux créés. Réessayez dans un moment." },
      { status: 429, headers: { "Retry-After": String(rate.retryAfterSec) } },
    )
  }

  let body: { q?: unknown; params?: unknown; mode?: unknown; title?: unknown }
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: "Requête invalide." }, { status: 400 })
  }

  const mode = body.mode === "save" ? "save" : "share"
  if (mode === "save" && !userId) {
    return NextResponse.json({ error: "Connectez-vous pour enregistrer un tableau." }, { status: 401 })
  }

  const query = sanitizeSearchQuery(typeof body.q === "string" ? body.q : "")
  const params: NlSearchParams =
    body.params && typeof body.params === "object" && !Array.isArray(body.params)
      ? (body.params as NlSearchParams)
      : {}

  // Rebuild the interpretation exactly as the page did.
  const cached = query ? await findCachedParse(hashQuery(query)) : null
  const intent = hasStructuredParams(params)
    ? intentFromSearchParams(params)
    : cached?.intent ?? null

  if (!intent || intent.mode === "hors_sujet") {
    return NextResponse.json({ error: "Ce tableau ne peut pas être partagé." }, { status: 400 })
  }
  const plan = cached?.plan?.length ? cached.plan : fallbackPlan(intent)

  if (mode === "save" && userId) {
    const count = await prisma.decouverteBoard.count({ where: { userId, saved: true } })
    if (count >= MAX_SAVED_BOARDS) {
      return NextResponse.json(
        { error: `Vous avez atteint ${MAX_SAVED_BOARDS} tableaux enregistrés. Supprimez-en un pour continuer.` },
        { status: 409 },
      )
    }
  }

  const board = await createBoard({
    query,
    intent,
    plan,
    userId,
    mode,
    title: typeof body.title === "string" ? body.title : null,
  })
  if (!board) {
    return NextResponse.json({ error: "Impossible de créer le tableau." }, { status: 500 })
  }

  return NextResponse.json({ id: board.id, url: `/tableau/${board.id}`, saved: board.saved })
}

/** Removes one of the caller's own boards. */
export async function DELETE(request: Request) {
  const session = await auth()
  const userId = session?.user?.id
  if (!userId) return NextResponse.json({ error: "Non autorisé." }, { status: 401 })

  const id = new URL(request.url).searchParams.get("id")
  if (!id) return NextResponse.json({ error: "Identifiant manquant." }, { status: 400 })

  const removed = await deleteBoard(id, userId)
  if (!removed) return NextResponse.json({ error: "Tableau introuvable." }, { status: 404 })
  return NextResponse.json({ ok: true })
}

/** The caller's own saved boards, for the profile listing. */
export async function GET() {
  const session = await auth()
  const userId = session?.user?.id
  if (!userId) return NextResponse.json({ items: [] })
  return NextResponse.json({ items: await listSavedBoards(userId) })
}
